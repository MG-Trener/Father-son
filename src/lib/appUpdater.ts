import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { supabase } from './supabase';

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

const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';
const currentCode = Number(Application.nativeBuildVersion ?? 0) || 0;

const stringOrNull = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : null;
const positiveNumberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export async function checkForAppUpdate(): Promise<UpdateStatus> {
  const fallback: UpdateStatus = {
    currentVersion,
    currentCode,
    release: null,
    available: false,
    required: false,
  };

  if (Platform.OS !== 'android' || !supabase) return fallback;

  const { data, error } = await supabase.rpc('get_latest_app_release', {
    p_platform: 'android',
    p_channel: 'preview',
  });
  if (error) throw error;

  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first !== 'object') return fallback;

  const row = first as Partial<AppRelease>;
  if (typeof row.version_code !== 'number' || typeof row.version_name !== 'string') return fallback;

  const release: AppRelease = {
    version_name: row.version_name,
    version_code: row.version_code,
    minimum_supported_code: typeof row.minimum_supported_code === 'number' ? row.minimum_supported_code : 1,
    title: stringOrNull(row.title),
    notes: stringOrNull(row.notes),
    download_url: stringOrNull(row.download_url),
    storage_bucket: stringOrNull(row.storage_bucket),
    storage_path: stringOrNull(row.storage_path),
    sha256: stringOrNull(row.sha256),
    size_bytes: positiveNumberOrNull(row.size_bytes),
    published_at: typeof row.published_at === 'string' ? row.published_at : new Date().toISOString(),
  };

  return {
    currentVersion,
    currentCode,
    release,
    available: release.version_code > currentCode,
    required: currentCode < release.minimum_supported_code,
  };
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

  const sideLoadingEnabled = await Device.isSideLoadingEnabledAsync();
  if (!sideLoadingEnabled) {
    const packageName = Application.applicationId ?? 'com.mgtrener.fatherson';
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:${packageName}`,
    });
    const allowedAfterSettings = await Device.isSideLoadingEnabledAsync();
    if (!allowedAfterSettings) throw new Error('APK_INSTALL_PERMISSION_REQUIRED');
  }

  const directory = new Directory(Paths.cache, 'papa-i-ya-updates');
  if (!directory.exists) directory.create();

  const downloaded = await File.downloadFileAsync(downloadUrl, directory);
  if (!downloaded.exists || downloaded.size <= 0) throw new Error('APK_DOWNLOAD_FAILED');
  if (release.size_bytes && downloaded.size !== release.size_bytes) throw new Error('APK_SIZE_MISMATCH');

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: downloaded.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
}
