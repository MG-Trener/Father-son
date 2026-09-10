import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { registerPushDevice } from '../lib/pushNotifications';

export function PushNotificationsBridge() {
  const { session } = useAuth();
  const { family } = useFamily();

  useEffect(() => {
    if (!session || !family) return;
    void registerPushDevice(session);
  }, [family, session]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/together') {
        router.push('/together');
      }
    });

    return () => subscription.remove();
  }, []);

  return null;
}
