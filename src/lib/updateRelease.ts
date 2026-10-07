export type AppRelease = {
  version_name: string;
  version_code: number;
  minimum_supported_code: number;
  title: string | null;
  notes: string | null;
  download_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  sha256: string | null;
  size_bytes: number | null;
  published_at: string;
};

export type UpdateStatus = {
  currentVersion: string;
  currentCode: number;
  release: AppRelease | null;
  available: boolean;
  required: boolean;
};

const RELEASE_DOWNLOAD_PREFIX = 'https://github.com/MG-Trener/Father-son-releases/releases/download/';
const LEGACY_RELEASE_BUCKET = 'app-releases';
const LEGACY_RELEASE_PATH_PREFIX = 'android/preview/';

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const normalizeSha256 = (value: unknown): string | null => {
  const normalized = stringOrNull(value)?.toLowerCase() ?? null;
  return normalized && /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
};

const normalizeDirectDownloadUrl = (value: unknown): string | null => {
  const normalized = stringOrNull(value);
  if (!normalized) return null;
  if (!normalized.startsWith(RELEASE_DOWNLOAD_PREFIX)) return null;
  if (!normalized.toLowerCase().endsWith('.apk')) return null;
  if (/[?#\s]/.test(normalized)) return null;
  return normalized;
};

const normalizeLegacyStoragePath = (value: unknown): string | null => {
  const normalized = stringOrNull(value);
  if (!normalized) return null;
  if (!normalized.startsWith(LEGACY_RELEASE_PATH_PREFIX)) return null;
  if (!normalized.toLowerCase().endsWith('.apk')) return null;
  if (normalized.includes('..') || normalized.includes('\\') || normalized.includes('//')) return null;
  if (/[?#\s]/.test(normalized)) return null;
  return normalized;
};

export function normalizeAppRelease(
  value: unknown,
  fallbackPublishedAt = new Date().toISOString(),
): AppRelease | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as Partial<AppRelease>;
  const versionCode = positiveIntegerOrNull(row.version_code);
  const versionName = stringOrNull(row.version_name);
  if (!versionCode || !versionName) return null;

  const minimumSupportedCode = positiveIntegerOrNull(row.minimum_supported_code) ?? 1;
  if (minimumSupportedCode > versionCode) return null;

  const rawDownloadUrl = stringOrNull(row.download_url);
  const downloadUrl = rawDownloadUrl ? normalizeDirectDownloadUrl(rawDownloadUrl) : null;
  if (rawDownloadUrl && !downloadUrl) return null;

  const rawStorageBucket = stringOrNull(row.storage_bucket);
  const rawStoragePath = stringOrNull(row.storage_path);
  const hasAnyStorageSource = Boolean(rawStorageBucket || rawStoragePath);
  const hasCompleteStorageSource = Boolean(rawStorageBucket && rawStoragePath);
  if (hasAnyStorageSource && !hasCompleteStorageSource) return null;

  const storageBucket = hasCompleteStorageSource ? rawStorageBucket : null;
  const storagePath = hasCompleteStorageSource ? normalizeLegacyStoragePath(rawStoragePath) : null;
  if (hasCompleteStorageSource && (storageBucket !== LEGACY_RELEASE_BUCKET || !storagePath)) return null;
  if (downloadUrl && hasCompleteStorageSource) return null;
  if (!downloadUrl && !hasCompleteStorageSource) return null;

  const sha256 = normalizeSha256(row.sha256);
  const sizeBytes = positiveIntegerOrNull(row.size_bytes);
  if (!sha256 || !sizeBytes) return null;

  return {
    version_name: versionName,
    version_code: versionCode,
    minimum_supported_code: minimumSupportedCode,
    title: stringOrNull(row.title),
    notes: stringOrNull(row.notes),
    download_url: downloadUrl,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    sha256,
    size_bytes: sizeBytes,
    published_at: stringOrNull(row.published_at) ?? fallbackPublishedAt,
  };
}

export function evaluateUpdateStatus(
  currentVersion: string,
  currentCode: number,
  release: AppRelease | null,
): UpdateStatus {
  return {
    currentVersion,
    currentCode,
    release,
    available: release ? release.version_code > currentCode : false,
    required: release ? currentCode < release.minimum_supported_code : false,
  };
}
