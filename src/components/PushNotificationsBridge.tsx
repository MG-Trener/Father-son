import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent, registerPushDevice } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

const pushEventTypes = new Set([
  'five_minutes_ping',
  'advice_requested',
  'connection_response',
]);

const openNotification = async (response: Notifications.NotificationResponse | null) => {
  if (!response) return;

  const url = response.notification.request.content.data?.url;
  if (url === '/together') {
    router.push('/together');
  }

  await Notifications.clearLastNotificationResponseAsync();
};

export function PushNotificationsBridge() {
  const { session } = useAuth();
  const { family } = useFamily();

  useEffect(() => {
    if (!session || !family) return;
    void registerPushDevice(session);
  }, [family?.id, session?.user.id]);

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      void openNotification(response);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openNotification(response);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !session || !family) return;

    const channel = client
      .channel(`push-outbox-${family.id}-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `family_id=eq.${family.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            actor_user_id?: string | null;
            event_type?: string;
          };

          if (
            typeof row.id === 'string'
            && row.actor_user_id === session.user.id
            && typeof row.event_type === 'string'
            && pushEventTypes.has(row.event_type)
          ) {
            void notifyFamilyEvent(row.id);
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [family?.id, session?.user.id]);

  return null;
}
