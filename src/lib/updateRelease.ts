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

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const positiveIntegerOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const positiveNumberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

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

  return {
    version_name: versionName,
    version_code: versionCode,
    minimum_supported_code: minimumSupportedCode,
    title: stringOrNull(row.title),
    notes: stringOrNull(row.notes),
    download_url: stringOrNull(row.download_url),
    storage_bucket: stringOrNull(row.storage_bucket),
    storage_path: stringOrNull(row.storage_path),
    sha256: stringOrNull(row.sha256),
    size_bytes: positiveNumberOrNull(row.size_bytes),
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
