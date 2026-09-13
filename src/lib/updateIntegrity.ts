export function normalizeSha256(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

export function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function assertApkSizeMatches(
  actualSize: number,
  expectedSize: number | null | undefined,
): void {
  if (!expectedSize || !Number.isInteger(expectedSize) || expectedSize <= 0) {
    throw new Error('APK_SIZE_INVALID');
  }
  if (!Number.isInteger(actualSize) || actualSize <= 0 || actualSize !== expectedSize) {
    throw new Error('APK_SIZE_MISMATCH');
  }
}

export function assertSha256Matches(
  actualSha256: string,
  expectedSha256: string | null | undefined,
): void {
  if (!expectedSha256) {
    throw new Error('APK_SHA256_MISSING');
  }

  const normalizedExpected = normalizeSha256(expectedSha256);
  if (!normalizedExpected) {
    throw new Error('APK_SHA256_INVALID');
  }

  const normalizedActual = normalizeSha256(actualSha256);
  if (!normalizedActual || normalizedActual !== normalizedExpected) {
    throw new Error('APK_SHA256_MISMATCH');
  }
}
