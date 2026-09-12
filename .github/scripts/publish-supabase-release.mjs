import fs from 'node:fs';
import path from 'node:path';

const required = (name, fallbackName) => {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const secretKey = required('SUPABASE_RELEASE_SECRET_KEY');
const apkPath = required('APK_PATH');
const version = required('VERSION');
const versionCode = Number(required('VERSION_CODE'));
const storagePath = required('STORAGE_PATH');
const expectedSha256 = required('SHA256');
const expectedSize = Number(required('SIZE_BYTES'));
const channel = process.env.RELEASE_CHANNEL || 'preview';
const bucket = process.env.STORAGE_BUCKET || 'app-releases';

if (!Number.isInteger(versionCode) || versionCode <= 0) throw new Error('VERSION_CODE must be a positive integer');
if (!Number.isFinite(expectedSize) || expectedSize <= 0) throw new Error('SIZE_BYTES must be positive');
if (!fs.existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}`);

const actualSize = fs.statSync(apkPath).size;
if (actualSize !== expectedSize) throw new Error(`APK size mismatch before upload: ${actualSize} != ${expectedSize}`);

const base64 = (value) => Buffer.from(String(value), 'utf8').toString('base64');
const textBody = async (response) => {
  try { return await response.text(); } catch { return ''; }
};
const assertResponse = async (response, label, allowed = []) => {
  if (response.ok || allowed.includes(response.status)) return response;
  const body = await textBody(response);
  throw new Error(`${label} failed: HTTP ${response.status}${body ? ` ${body}` : ''}`);
};

async function uploadTus() {
  const endpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
  const metadata = [
    ['bucketName', bucket],
    ['objectName', storagePath],
    ['contentType', 'application/vnd.android.package-archive'],
    ['cacheControl', 'no-cache'],
  ].map(([key, value]) => `${key} ${base64(value)}`).join(',');

  console.log(`Starting resumable APK upload: ${path.basename(apkPath)} (${actualSize} bytes)`);
  const createResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(actualSize),
      'Upload-Metadata': metadata,
      'x-upsert': 'true',
    },
  });
  await assertResponse(createResponse, 'Create resumable upload', [201]);

  const location = createResponse.headers.get('location');
  if (!location) throw new Error('Supabase TUS response did not include a Location header');
  const uploadUrl = new URL(location, endpoint).toString();

  const chunkSize = 6 * 1024 * 1024;
  const fd = fs.openSync(apkPath, 'r');
  let offset = 0;
  try {
    while (offset < actualSize) {
      const length = Math.min(chunkSize, actualSize - offset);
      const chunk = Buffer.allocUnsafe(length);
      const bytesRead = fs.readSync(fd, chunk, 0, length, offset);
      if (bytesRead !== length) throw new Error(`Could not read APK chunk at offset ${offset}`);

      const patchResponse = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          apikey: secretKey,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      });
      await assertResponse(patchResponse, `Upload APK chunk at ${offset}`, [204]);

      const serverOffsetRaw = patchResponse.headers.get('upload-offset');
      const serverOffset = serverOffsetRaw ? Number(serverOffsetRaw) : offset + length;
      if (!Number.isFinite(serverOffset) || serverOffset <= offset) {
        throw new Error(`Invalid Upload-Offset returned by Supabase: ${serverOffsetRaw}`);
      }
      offset = serverOffset;
      console.log(`Uploaded ${offset}/${actualSize} bytes (${Math.round((offset / actualSize) * 100)}%)`);
    }
  } finally {
    fs.closeSync(fd);
  }

  if (offset !== actualSize) throw new Error(`Resumable upload ended at ${offset}, expected ${actualSize}`);
}

async function upsertReleaseMetadata() {
  const row = {
    platform: 'android',
    channel,
    version_name: version,
    version_code: versionCode,
    minimum_supported_code: 1,
    title: `Папа & Я ${version}`,
    notes: 'ARM64 Android-релиз из main, подписанный постоянным release-ключом.',
    download_url: null,
    storage_bucket: bucket,
    storage_path: storagePath,
    sha256: expectedSha256,
    size_bytes: expectedSize,
    is_enabled: true,
    published_at: new Date().toISOString(),
  };

  const response = await fetch(`${supabaseUrl}/rest/v1/app_releases?on_conflict=platform,channel,version_code`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  await assertResponse(response, 'Upsert app release metadata');
}

async function verifyStorageObject() {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/info/${bucket}/${storagePath}`, {
    headers: { apikey: secretKey },
  });
  await assertResponse(response, 'Verify private Storage object');
  const info = await response.json();
  const storedSize = Number(info?.metadata?.size ?? info?.metadata?.contentLength ?? 0);
  if (storedSize && storedSize !== expectedSize) {
    throw new Error(`Stored APK size mismatch: ${storedSize} != ${expectedSize}`);
  }
}

async function verifyUpdateFeed() {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_latest_app_release`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_platform: 'android', p_channel: channel }),
  });
  await assertResponse(response, 'Verify app update feed');
  const data = await response.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Update feed returned no release');
  if (String(row.version_name) !== version) throw new Error(`Update feed version mismatch: ${row.version_name}`);
  if (Number(row.version_code) !== versionCode) throw new Error(`Update feed code mismatch: ${row.version_code}`);
  if (row.storage_bucket !== bucket || row.storage_path !== storagePath) {
    throw new Error('Update feed Storage coordinates do not match the published APK');
  }
  if (row.sha256 && row.sha256 !== expectedSha256) throw new Error('Update feed SHA-256 mismatch');
  if (row.size_bytes && Number(row.size_bytes) !== expectedSize) throw new Error('Update feed APK size mismatch');
  console.log(`Update feed verified: ${row.version_name} (${row.version_code})`);
}

await uploadTus();
await upsertReleaseMetadata();
await verifyStorageObject();
await verifyUpdateFeed();
console.log(`Supabase release publication complete: ${version} (${versionCode})`);
