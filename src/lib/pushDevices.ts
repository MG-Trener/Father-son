import { supabase } from './supabase';

export async function registerPushDeviceToken(
  expoPushToken: string,
  platform: 'android' | 'ios',
) {
  if (!supabase) return false;

  const { error } = await supabase.rpc('register_push_device', {
    p_expo_push_token: expoPushToken,
    p_platform: platform,
  });

  return !error;
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
