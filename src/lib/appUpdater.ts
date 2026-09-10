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
    title: typeof row.title === 'string' ? row.title : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    download_url: typeof row.download_url === 'string' ? row.download_url : null,
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

export async function installReleaseApk(release: AppRelease) {
  if (Platform.OS !== 'android') throw new Error('APK_INSTALL_ANDROID_ONLY');
  if (!release.download_url) throw new Error('APK_URL_NOT_PUBLISHED');

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

  const downloaded = await File.downloadFileAsync(release.download_url, directory);
  if (!downloaded.exists || downloaded.size <= 0) throw new Error('APK_DOWNLOAD_FAILED');

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: downloaded.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1,
  });
}
