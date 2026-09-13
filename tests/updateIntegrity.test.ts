import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertApkSizeMatches,
  assertSha256Matches,
  bytesToHex,
  normalizeSha256,
} from '../src/lib/updateIntegrity.ts';

test('normalizeSha256 accepts a valid hash and normalizes case/whitespace', () => {
  const hash = 'A'.repeat(64);
  assert.equal(normalizeSha256(`  ${hash}  `), 'a'.repeat(64));
});

test('normalizeSha256 rejects missing and malformed hashes', () => {
  assert.equal(normalizeSha256(null), null);
  assert.equal(normalizeSha256('abc'), null);
  assert.equal(normalizeSha256('g'.repeat(64)), null);
});

test('bytesToHex converts digest bytes to lowercase hexadecimal', () => {
  const bytes = new Uint8Array([0, 1, 15, 16, 254, 255]);
  assert.equal(bytesToHex(bytes.buffer), '00010f10feff');
});

test('assertApkSizeMatches accepts an exact positive integer size', () => {
  assert.doesNotThrow(() => assertApkSizeMatches(42_000_000, 42_000_000));
});

test('assertApkSizeMatches rejects missing or malformed expected size', () => {
  assert.throws(() => assertApkSizeMatches(42_000_000, null), /APK_SIZE_INVALID/);
  assert.throws(() => assertApkSizeMatches(42_000_000, 0), /APK_SIZE_INVALID/);
  assert.throws(() => assertApkSizeMatches(42_000_000, 42.5), /APK_SIZE_INVALID/);
});

test('assertApkSizeMatches rejects a different or invalid actual size', () => {
  assert.throws(() => assertApkSizeMatches(41_999_999, 42_000_000), /APK_SIZE_MISMATCH/);
  assert.throws(() => assertApkSizeMatches(0, 42_000_000), /APK_SIZE_MISMATCH/);
  assert.throws(() => assertApkSizeMatches(42.5, 42_000_000), /APK_SIZE_MISMATCH/);
});

test('assertSha256Matches accepts equal hashes regardless of case', () => {
  const hash = 'ab'.repeat(32);
  assert.doesNotThrow(() => assertSha256Matches(hash.toUpperCase(), hash));
});

test('assertSha256Matches rejects missing metadata', () => {
  assert.throws(
    () => assertSha256Matches('ab'.repeat(32), null),
    /APK_SHA256_MISSING/,
  );
});

test('assertSha256Matches rejects malformed metadata', () => {
  assert.throws(
    () => assertSha256Matches('ab'.repeat(32), 'invalid'),
    /APK_SHA256_INVALID/,
  );
});

test('assertSha256Matches rejects a different digest', () => {
  assert.throws(
    () => assertSha256Matches('ab'.repeat(32), 'cd'.repeat(32)),
    /APK_SHA256_MISMATCH/,
  );
});
