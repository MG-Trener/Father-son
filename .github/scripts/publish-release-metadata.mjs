const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const supabaseUrl = required('EXPO_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const publishableKey = required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const secretKey = required('SUPABASE_RELEASE_SECRET_KEY');
const version = required('VERSION');
const versionCode = Number(required('VERSION_CODE'));
const downloadUrl = required('DOWNLOAD_URL');
const sha256 = required('SHA256');
const sizeBytes = Number(required('SIZE_BYTES'));
const releasesRepo = process.env.RELEASES_REPO || 'MG-Trener/Father-son-releases';
const expectedPrefix = `https://github.com/${releasesRepo}/releases/download/`;

if (!Number.isInteger(versionCode) || versionCode <= 0) {
  throw new Error(`Invalid VERSION_CODE: ${process.env.VERSION_CODE}`);
}
if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
  throw new Error(`Invalid SIZE_BYTES: ${process.env.SIZE_BYTES}`);
}
if (!downloadUrl.startsWith(expectedPrefix)) {
  throw new Error(`DOWNLOAD_URL must point to public release repository ${releasesRepo}: ${downloadUrl}`);
}

async function assertOk(response, label) {
  if (response.ok) return;
  const body = await response.text().catch(() => '');
  throw new Error(`${label} failed: HTTP ${response.status}${body ? ` ${body}` : ''}`);
}

const row = {
  platform: 'android',
  channel: 'preview',
  version_name: version,
  version_code: versionCode,
  minimum_supported_code: 1,
  title: `Папа & Я ${version}`,
  notes: 'Подписанный ARM64 Android-релиз. APK хранится в публичном GitHub Releases репозитории; Supabase хранит только метаданные обновления.',
  download_url: downloadUrl,
  storage_bucket: null,
  storage_path: null,
  sha256,
  size_bytes: sizeBytes,
  is_enabled: true,
  published_at: new Date().toISOString(),
};

const upsert = await fetch(
  `${supabaseUrl}/rest/v1/app_releases?on_conflict=platform,channel,version_code`,
  {
    method: 'POST',
    headers: {
      apikey: secretKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  },
);
await assertOk(upsert, 'Release metadata upsert');
console.log(`Release metadata published: ${version} (${versionCode})`);
console.log(`APK: ${downloadUrl}`);

const feed = await fetch(`${supabaseUrl}/rest/v1/rpc/get_latest_app_release`, {
  method: 'POST',
  headers: {
    apikey: publishableKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_platform: 'android', p_channel: 'preview' }),
});
await assertOk(feed, 'Update feed verification');

const payload = await feed.json();
const latest = Array.isArray(payload) ? payload[0] : payload;
if (!latest) throw new Error('Update feed returned no release');
if (String(latest.version_name) !== version || Number(latest.version_code) !== versionCode) {
  throw new Error(`Update feed mismatch: ${latest.version_name} (${latest.version_code})`);
}
if (latest.download_url !== downloadUrl) {
  throw new Error(`Update feed download_url mismatch: ${latest.download_url}`);
}
if (latest.storage_bucket || latest.storage_path) {
  throw new Error('Update feed still references Supabase Storage');
}
console.log(`Update feed verified: ${latest.version_name} (${latest.version_code}) -> ${releasesRepo}`);
