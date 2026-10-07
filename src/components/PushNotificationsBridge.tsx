import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent, registerPushDevice } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

const pushEventTypes = new Set([
  'chat_message',
  'chess_move',
  'five_minutes_ping',
  'advice_requested',
  'connection_response',
  'voice_story_added',
  'recognition_added',
  'agreement_proposed',
  'agreement_activated',
]);

const openNotification = async (response: Notifications.NotificationResponse | null) => {
  if (!response) return;

  const url = response.notification.request.content.data?.url;
  if (url === '/chess') {
    router.navigate('/chess');
  } else if (url === '/chat' || url === '/together') {
    router.navigate('/chat');
  } else if (url === '/voice-stories') {
    router.push('/voice-stories');
  } else if (url === '/recognitions') {
    router.push('/recognitions');
  } else if (url === '/agreements') {
    router.push('/agreements');
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
    // Expo's notification-response API only exists in native builds.
    if (Platform.OS === 'web') return;

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

    const userId = session.user.id;
    const familyId = family.id;
    const retrySince = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    void client
      .from('activity_events')
      .select('id,event_type')
      .eq('family_id', familyId)
      .eq('actor_user_id', userId)
      .in('event_type', Array.from(pushEventTypes))
      .gte('occurred_at', retrySince)
      .order('occurred_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) return;
        for (const event of data ?? []) {
          if (typeof event.id === 'string') {
            void notifyFamilyEvent(event.id);
          }
        }
      });

    const channel = client
      .channel(`push-outbox-${familyId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            actor_user_id?: string | null;
            event_type?: string;
          };

          if (
            typeof row.id === 'string'
            && row.actor_user_id === userId
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
