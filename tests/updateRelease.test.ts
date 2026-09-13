import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateUpdateStatus, normalizeAppRelease } from '../src/lib/updateRelease.ts';

const validRow = {
  version_name: '0.4.2',
  version_code: 16,
  minimum_supported_code: 10,
  title: 'Обновление',
  notes: 'Исправления',
  download_url: 'https://github.com/MG-Trener/Father-son-releases/releases/download/v0.4.2/papa-i-ya-0.4.2.apk',
  storage_bucket: null,
  storage_path: null,
  sha256: 'ab'.repeat(32),
  size_bytes: 42_000_000,
  published_at: '2026-09-13T00:00:00.000Z',
};

test('normalizeAppRelease accepts a valid row and trims strings', () => {
  const release = normalizeAppRelease({ ...validRow, version_name: ' 0.4.2 ', title: '  Обновление  ' });
  assert.equal(release?.version_name, '0.4.2');
  assert.equal(release?.title, 'Обновление');
  assert.equal(release?.version_code, 16);
});

test('normalizeAppRelease rejects invalid version codes and names', () => {
  assert.equal(normalizeAppRelease({ ...validRow, version_code: 0 }), null);
  assert.equal(normalizeAppRelease({ ...validRow, version_code: 16.5 }), null);
  assert.equal(normalizeAppRelease({ ...validRow, version_name: '   ' }), null);
});

test('normalizeAppRelease rejects an impossible minimum supported code', () => {
  assert.equal(
    normalizeAppRelease({ ...validRow, minimum_supported_code: validRow.version_code + 1 }),
    null,
  );
});

test('normalizeAppRelease normalizes optional metadata safely', () => {
  const release = normalizeAppRelease(
    {
      ...validRow,
      minimum_supported_code: undefined,
      title: '',
      notes: '   ',
      published_at: '',
    },
    '2026-09-13T01:02:03.000Z',
  );

  assert.equal(release?.minimum_supported_code, 1);
  assert.equal(release?.title, null);
  assert.equal(release?.notes, null);
  assert.equal(release?.published_at, '2026-09-13T01:02:03.000Z');
});

test('normalizeAppRelease rejects incomplete integrity metadata', () => {
  assert.equal(normalizeAppRelease({ ...validRow, sha256: null }), null);
  assert.equal(normalizeAppRelease({ ...validRow, sha256: 'invalid' }), null);
  assert.equal(normalizeAppRelease({ ...validRow, size_bytes: null }), null);
  assert.equal(normalizeAppRelease({ ...validRow, size_bytes: 42.5 }), null);
  assert.equal(normalizeAppRelease({ ...validRow, size_bytes: -1 }), null);
});

test('normalizeAppRelease rejects untrusted direct download URLs', () => {
  assert.equal(normalizeAppRelease({ ...validRow, download_url: 'http://github.com/MG-Trener/Father-son-releases/releases/download/v0.4.2/app.apk' }), null);
  assert.equal(normalizeAppRelease({ ...validRow, download_url: 'https://example.test/app.apk' }), null);
  assert.equal(normalizeAppRelease({ ...validRow, download_url: 'https://github.com/MG-Trener/Father-son-releases/releases/download/v0.4.2/app.zip' }), null);
  assert.equal(normalizeAppRelease({ ...validRow, download_url: `${validRow.download_url}?token=unexpected` }), null);
});

test('normalizeAppRelease accepts a complete legacy private-storage source', () => {
  const release = normalizeAppRelease({
    ...validRow,
    download_url: null,
    storage_bucket: 'app-releases',
    storage_path: 'android/preview/0.4.2/app.apk',
  });

  assert.equal(release?.download_url, null);
  assert.equal(release?.storage_bucket, 'app-releases');
  assert.equal(release?.storage_path, 'android/preview/0.4.2/app.apk');
});

test('normalizeAppRelease rejects missing, partial, or ambiguous download sources', () => {
  assert.equal(normalizeAppRelease({ ...validRow, download_url: null }), null);
  assert.equal(normalizeAppRelease({ ...validRow, download_url: null, storage_bucket: 'app-releases', storage_path: null }), null);
  assert.equal(normalizeAppRelease({ ...validRow, storage_bucket: 'app-releases', storage_path: 'app.apk' }), null);
});

test('evaluateUpdateStatus reports no update when release is absent', () => {
  const status = evaluateUpdateStatus('0.4.1', 15, null);
  assert.equal(status.available, false);
  assert.equal(status.required, false);
  assert.equal(status.release, null);
});

test('evaluateUpdateStatus distinguishes optional update', () => {
  const release = normalizeAppRelease({ ...validRow, minimum_supported_code: 1 });
  assert.ok(release);

  const status = evaluateUpdateStatus('0.4.1', 15, release);
  assert.equal(status.available, true);
  assert.equal(status.required, false);
});

test('evaluateUpdateStatus marks an update required below minimum code', () => {
  const release = normalizeAppRelease({ ...validRow, minimum_supported_code: 15 });
  assert.ok(release);

  const status = evaluateUpdateStatus('0.4.0', 14, release);
  assert.equal(status.available, true);
  assert.equal(status.required, true);
});

test('evaluateUpdateStatus does not offer the currently installed build', () => {
  const release = normalizeAppRelease({ ...validRow, version_code: 15, minimum_supported_code: 1 });
  assert.ok(release);

  const status = evaluateUpdateStatus('0.4.1', 15, release);
  assert.equal(status.available, false);
  assert.equal(status.required, false);
});
