import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard } from '../../components/AppCard';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme';

type TimelineEvent = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  category: string | null;
  occurred_at: string;
  payload: unknown;
};

const payloadRecord = (payload: unknown): Record<string, unknown> => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
};

const payloadText = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'string' ? value : null;
};

const payloadNumber = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'number' ? value : null;
};

const eventView = (event: TimelineEvent, actorName: string) => {
  const title = payloadText(event.payload, 'title');
  const xp = payloadNumber(event.payload, 'xp_reward');

  switch (event.event_type) {
    case 'family_created':
      return { icon: '❤️', title: 'Команда создана', text: `${actorName} открыл вашу общую историю.` };
    case 'family_joined':
      return { icon: '🤝', title: 'Команда в сборе', text: `${actorName} присоединился к «Папа & Я».` };
    case 'five_minutes_ping':
      return { icon: '💬', title: 'Есть 5 минут?', text: `${actorName} предложил немного побыть вместе.` };
    case 'advice_requested': {
      const message = payloadText(event.payload, 'message');
      return {
        icon: '🧭',
        title: 'Нужен совет',
        text: message ? `${actorName}: ${message}` : `${actorName} попросил немного помочь советом.`,
      };
    }
    case 'reflection_added': {
      const preview = payloadText(event.payload, 'preview');
      const prompt = payloadText(event.payload, 'prompt');
      return {
        icon: '✍️',
        title: prompt ? 'Ответ друг другу' : 'История дня',
        text: preview ? `${actorName}: ${preview}` : `${actorName} сохранил новую историю для вашей команды.`,
      };
    }
    case 'meeting_created':
      return { icon: '📅', title: 'Запланирована встреча', text: title ? `${actorName} запланировал «${title}».` : `${actorName} добавил следующую встречу.` };
    case 'mission_created':
      return { icon: '🎯', title: 'Новая миссия', text: title ? `${actorName} запустил миссию «${title}».` : `${actorName} добавил новую миссию.` };
    case 'mission_completed':
      return {
        icon: '✅',
        title: title ? `Миссия: ${title}` : 'Миссия выполнена',
        text: `${actorName} завершил шаг${xp !== null ? ` и заработал +${xp} XP` : ''}.`,
      };
    case 'achievement_awarded':
      return { icon: '🏅', title: 'Новое достижение', text: title ? `Открыто достижение «${title}».` : 'Открыто новое достижение.' };
    case 'recognition_added':
      return { icon: '🧭', title: 'Важный поступок', text: `${actorName} сохранил момент, который стоит помнить.` };
    default:
      return { icon: '✦', title: 'Момент команды', text: `${actorName} добавил новое событие.` };
  }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) {
    return `Сегодня · ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

export default function HistoryScreen() {
  const { family, members } = useFamily();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase && family));
  const [refreshing, setRefreshing] = useState(false);

  const names = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.display_name])),
    [members],
  );
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);
  const childAge = ageFromBirthDate(child?.birth_date ?? null);

  const loadEvents = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('activity_events')
      .select('id,actor_user_id,event_type,category,occurred_at,payload')
      .eq('family_id', family.id)
      .order('occurred_at', { ascending: false })
      .limit(80);

    if (!error) setEvents((data ?? []) as TimelineEvent[]);
    setLoading(false);
  }, [family]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <Text style={styles.title}>Наша история</Text>
        <Text style={styles.subtitle}>Не лента контроля, а летопись моментов, которые вы захотите помнить.</Text>

        <AppCard
          title={`${child?.display_name ?? 'Артур'}${childAge !== null ? ` · ${childAge} лет` : ''}`}
          subtitle="Первая глава · Исследователь"
        >
          <Text style={styles.body}>Здесь постепенно соберутся разговоры, футбол, шахматы, English, лидерские поступки, встречи, миссии и ваши заметки друг о друге.</Text>
        </AppCard>

        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : events.length ? (
          <View style={styles.timeline}>
            {events.map((event, index) => {
              const actorName = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Кто-то из команды' : 'Команда';
              const view = eventView(event, actorName);
              return (
                <View key={event.id} style={styles.event}>
                  <View style={styles.rail}>
                    <View style={styles.dot} />
                    {index < events.length - 1 ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={styles.date}>{formatDate(event.occurred_at)}</Text>
                    <Text style={styles.eventTitle}>{view.icon} {view.title}</Text>
                    <Text style={styles.eventText}>{view.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <AppCard title="История начинается сейчас">
            <Text style={styles.body}>Первое сохранённое действие появится здесь автоматически.</Text>
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 32, gap: 16 },
  title: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: -9 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  loader: { marginVertical: 28 },
  timeline: { marginTop: 3 },
  event: { flexDirection: 'row', minHeight: 104 },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.amber, marginTop: 6 },
  line: { width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 4 },
  eventContent: { flex: 1, paddingLeft: 8, paddingBottom: 20 },
  date: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  eventTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  eventText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
});
