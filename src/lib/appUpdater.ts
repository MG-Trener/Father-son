import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { supabase } from './supabase';
import { assertApkSizeMatches, assertSha256Matches, bytesToHex } from './updateIntegrity';
import {
  evaluateUpdateStatus,
  normalizeAppRelease,
  type AppRelease,
  type UpdateStatus,
} from './updateRelease';

export type { AppRelease, UpdateStatus } from './updateRelease';

const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
const currentCode = Number(Application.nativeBuildVersion ?? 0) || 0;

const deleteQuietly = (file: File) => {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cache cleanup must not hide the integrity error that caused it.
  }
};

async function verifyDownloadedApk(file: File, release: AppRelease) {
  try {
    assertApkSizeMatches(file.size, release.size_bytes);
  } catch (error) {
    deleteQuietly(file);
    throw error;
  }

  const bytes = await file.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const actualSha256 = bytesToHex(digest);

  try {
    assertSha256Matches(actualSha256, release.sha256);
  } catch (error) {
    deleteQuietly(file);
    throw error;
  }
}

export async function checkForAppUpdate(): Promise<UpdateStatus> {
  const fallback = evaluateUpdateStatus(currentVersion, currentCode, null);

  if (Platform.OS !== 'android' || !supabase) return fallback;

  const { data, error } = await supabase.rpc('get_latest_app_release', {
    p_platform: 'android',
    p_channel: 'preview',
  });
  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : data;
  const release = normalizeAppRelease(first);
  if (!release) return fallback;

  return evaluateUpdateStatus(currentVersion, currentCode, release);
}

async function resolveReleaseDownloadUrl(release: AppRelease) {
  if (release.download_url) return release.download_url;
  if (!supabase || !release.storage_bucket || !release.storage_path) {
    throw new Error('APK_URL_NOT_PUBLISHED');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error('APK_AUTH_REQUIRED');

  const { data, error } = await supabase.storage
    .from(release.storage_bucket)
    .createSignedUrl(release.storage_path, 10 * 60);

  if (error || !data?.signedUrl) throw new Error('APK_SIGNED_URL_FAILED');
  return data.signedUrl;
}

export async function installReleaseApk(release: AppRelease) {
  if (Platform.OS !== 'android') throw new Error('APK_INSTALL_ANDROID_ONLY');

  const downloadUrl = await resolveReleaseDownloadUrl(release);
  const directory = new Directory(Paths.cache, 'papa-i-ya-updates');
  if (!directory.exists) directory.create();

  const downloaded = await File.downloadFileAsync(downloadUrl, directory, { idempotent: true });
  if (!downloaded.exists || downloaded.size <= 0) throw new Error('APK_DOWNLOAD_FAILED');

  await verifyDownloadedApk(downloaded, release);

  const sideLoadingEnabled = await Device.isSideLoadingEnabledAsync();
  if (!sideLoadingEnabled) {
    const packageName = Application.applicationId ?? 'com.mgtrener.fatherson';
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:${packageName}`,
    });
    const allowedAfterSettings = await Device.isSideLoadingEnabledAsync();
    if (!allowedAfterSettings) throw new Error('APK_INSTALL_PERMISSION_REQUIRED');
  }

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: downloaded.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
}
