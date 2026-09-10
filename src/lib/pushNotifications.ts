import type { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'permission_denied' }
  | { status: 'project_unconfigured' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

const getProjectId = () => (
  Constants.easConfig?.projectId
  ?? Constants.expoConfig?.extra?.eas?.projectId
  ?? null
);

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('connection', {
    name: 'Связь с семьёй',
    description: 'Сигналы «Есть 5 минут?», просьбы о совете и ответы на них.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    sound: 'default',
  });
};

export async function registerPushDevice(session: Session): Promise<PushRegistrationResult> {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice) {
    return { status: 'unsupported' };
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return { status: 'permission_denied' };
    }

    const projectId = getProjectId();
    if (!projectId) {
      return { status: 'project_unconfigured' };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    if (!session.user.id) {
      return { status: 'error', message: 'Нет активного пользователя для регистрации уведомлений.' };
    }

    const { error } = await supabase.rpc('register_push_device', {
      p_expo_push_token: token,
      p_platform: platform,
    });

    if (error) throw error;
    return { status: 'registered', token };
  } catch (caught) {
    return {
      status: 'error',
      message: caught instanceof Error ? caught.message : 'Не удалось зарегистрировать push-уведомления.',
    };
  }
}

export async function unregisterAllPushDevices() {
  if (!supabase) return false;

  try {
    const { error } = await supabase.rpc('unregister_all_push_devices');
    return !error;
  } catch {
    return false;
  }
}

export async function notifyFamilyEvent(eventId: string) {
  if (!supabase || !eventId) return false;

  try {
    const { error } = await supabase.functions.invoke('send-family-push', {
      body: { event_id: eventId },
    });
    return !error;
  } catch {
    return false;
  }
}
