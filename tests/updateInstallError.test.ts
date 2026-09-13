import assert from 'node:assert/strict';
import test from 'node:test';
import { getApkInstallErrorCopy } from '../src/lib/updateInstallError.ts';

test('maps install permission errors', () => {
  const copy = getApkInstallErrorCopy(new Error('APK_INSTALL_PERMISSION_REQUIRED'));
  assert.equal(copy.title, 'Разреши установку');
});

test('maps authentication errors', () => {
  const copy = getApkInstallErrorCopy(new Error('APK_AUTH_REQUIRED'));
  assert.equal(copy.title, 'Нужно войти');
});

test('maps size integrity errors', () => {
  assert.equal(getApkInstallErrorCopy(new Error('APK_SIZE_INVALID')).title, 'Файл не прошёл проверку');
  assert.equal(getApkInstallErrorCopy(new Error('APK_SIZE_MISMATCH')).title, 'Файл не прошёл проверку');
});

test('maps sha integrity errors', () => {
  const copy = getApkInstallErrorCopy(new Error('APK_SHA256_MISMATCH'));
  assert.equal(copy.title, 'Файл не прошёл проверку');
  assert.match(copy.message, /Контрольная сумма/);
});

test('maps signed URL and unpublished URL errors', () => {
  assert.equal(getApkInstallErrorCopy(new Error('APK_SIGNED_URL_FAILED')).title, 'Ссылка устарела');
  assert.equal(getApkInstallErrorCopy(new Error('APK_URL_NOT_PUBLISHED')).title, 'Сборка ещё публикуется');
});

test('maps download and Android-only errors', () => {
  assert.equal(getApkInstallErrorCopy('APK_DOWNLOAD_FAILED').title, 'Не удалось скачать обновление');
  assert.equal(getApkInstallErrorCopy(new Error('APK_INSTALL_ANDROID_ONLY')).title, 'Обновление недоступно');
});

test('falls back for unknown values', () => {
  assert.equal(getApkInstallErrorCopy(new Error('SOMETHING_ELSE')).title, 'Не удалось обновить');
  assert.equal(getApkInstallErrorCopy(null).title, 'Не удалось обновить');
});
