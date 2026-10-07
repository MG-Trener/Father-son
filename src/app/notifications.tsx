import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageSourcePropType, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

const artwork = {
  family: require('../../assets/generated/feature-family.png'),
  together: require('../../assets/generated/feature-together.png'),
  path: require('../../assets/generated/feature-path.png'),
  home: require('../../assets/generated/feature-home.png'),
  voice: require('../../assets/generated/utility-voice.png'),
  recognition: require('../../assets/generated/utility-recognition.png'),
  calendar: require('../../assets/generated/utility-calendar.png'),
  goal: require('../../assets/generated/utility-goal.png'),
  agreements: require('../../assets/generated/utility-agreements.png'),
  achievement: require('../../assets/generated/badge-planner.png'),
  mission: require('../../assets/generated/badge-adventure.png'),
} as const satisfies Record<string, ImageSourcePropType>;

type EventRow = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  category: string | null;
  occurred_at: string;
  payload: unknown;
};

type EventView = {
  image: ImageSourcePropType;
  title: string;
  text: string;
  base: string;
};

const interestingTypes = new Set([
  'five_minutes_ping',
  'advice_requested',
  'connection_response',
  'voice_story_added',
  'recognition_added',
  'meeting_created',
  'meeting_completed',
  'mood_shared',
  'ritual_moment_added',
  'weekly_focus_added',
  'agreement_proposed',
  'agreement_activated',
  'agreement_archived',
  'achievement_awarded',
  'mission_completed',
]);

const payloadRecord = (payload: unknown): Record<string, unknown> => payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
const payloadText = (payload: unknown, key: string) => typeof payloadRecord(payload)[key] === 'string' ? payloadRecord(payload)[key] as string : null;

const viewFor = (event: EventRow, actorName: string): EventView => {
  const title = payloadText(event.payload, 'title');
  switch (event.event_type) {
    case 'five_minutes_ping': return { image: artwork.together, title: `${actorName}: есть 5 минут?`, text: 'Есть повод ненадолго выйти на связь.', base: '#FFF0CF' };
    case 'advice_requested': return { image: artwork.recognition, title: `${actorName} просит совета`, text: payloadText(event.payload, 'message') ?? 'Есть тема, которую хочется обсудить вместе.', base: '#F8E1E5' };
    case 'connection_response': return { image: artwork.family, title: `${actorName} ответил`, text: payloadText(event.payload, 'response') === 'here' ? 'Сейчас можно связаться.' : 'Вернётся к разговору чуть позже.', base: colors.mint };
    case 'voice_story_added': return { image: artwork.voice, title: title || 'Новая голосовая история', text: `${actorName} сохранил голосовой момент в вашей общей истории.`, base: '#DDEDEF' };
    case 'recognition_added': return { image: artwork.recognition, title: title || 'Я заметил', text: `${actorName} сохранил важный момент про тебя.`, base: colors.lavender };
    case 'meeting_created': return { image: artwork.calendar, title: 'Появилась новая встреча', text: title ? `${actorName} запланировал «${title}».` : `${actorName} добавил встречу.`, base: colors.sky };
    case 'meeting_completed': return { image: artwork.calendar, title: 'Встреча осталась в истории', text: title ? `«${title}» отмечена как состоявшаяся.` : 'Совместный момент сохранён.', base: colors.mint };
    case 'mood_shared': return { image: artwork.together, title: `${actorName} поделился состоянием`, text: 'Можно просто заметить это — не обязательно сразу задавать вопросы.', base: '#E6F0F2' };
    case 'ritual_moment_added': return { image: artwork.goal, title: title || 'Ваш ритуал случился', text: `${actorName} отметил этот момент сегодня.`, base: '#FFF0CF' };
    case 'weekly_focus_added': return { image: artwork.goal, title: 'Новый фокус недели', text: title ? `${actorName}: «${title}».` : `${actorName} выбрал ориентир на неделю.`, base: '#DCEFFF' };
    case 'agreement_proposed': return { image: artwork.agreements, title: 'Новая договорённость', text: title ? `${actorName} предлагает: «${title}».` : `${actorName} предложил новую договорённость.`, base: '#FFF0CF' };
    case 'agreement_activated': return { image: artwork.agreements, title: 'Вы договорились', text: title ? `«${title}» теперь подтверждена обоими.` : 'Договорённость подтверждена обоими.', base: colors.mint };
    case 'agreement_archived': return { image: artwork.agreements, title: 'Договорённость завершена', text: title ? `${actorName} убрал «${title}» из действующих.` : `${actorName} завершил одну из прежних договорённостей.`, base: colors.sandWarm };
    case 'achievement_awarded': return { image: artwork.achievement, title: title || 'Новая веха', text: 'В пути появилась новая заметная точка.', base: '#FFF0C2' };
    case 'mission_completed': return { image: artwork.mission, title: title || 'Шаг завершён', text: `${actorName} завершил один из текущих шагов.`, base: colors.mint };
    default: return { image: artwork.path, title: 'Новый момент', text: `${actorName} добавил событие в вашу историю.`, base: '#E6F0F2' };
  }
};

const when = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const today = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (today) return `Сегодня · ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function NotificationsScreen() {
  const { family, members, me } = useFamily();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family || !me) {
      setLoading(false);
      return;
    }
    const [eventResult, readResult] = await Promise.all([
      client.from('activity_events').select('id,actor_user_id,event_type,category,occurred_at,payload').eq('family_id', family.id).order('occurred_at', { ascending: false }).limit(100),
      client.from('activity_event_reads').select('event_id').eq('family_id', family.id).eq('user_id', me.user_id),
    ]);
    if (!eventResult.error) {
      const filtered = ((eventResult.data ?? []) as EventRow[])
        .filter((event) => interestingTypes.has(event.event_type))
        .filter((event) => event.actor_user_id !== me.user_id)
        .slice(0, 50);
      setEvents(filtered);
    }
    if (!readResult.error) setReadIds(new Set((readResult.data ?? []).map((row) => row.event_id as string)));
    setLoading(false);
  }, [family, me]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unread = events.filter((event) => !readIds.has(event.id));

  const markIds = async (ids: string[]) => {
    const client = supabase;
    if (!client || !family || !me || !ids.length) return true;
    const unique = ids.filter((id) => !readIds.has(id));
    if (!unique.length) return true;
    const { error } = await client.rpc('mark_activity_events_read', {
      p_family_id: family.id,
      p_event_ids: unique,
    });
    if (error) {
      Alert.alert('Не удалось отметить прочитанным', error.message);
      return false;
    }
    setReadIds((current) => new Set([...current, ...unique]));
    return true;
  };

  const markAll = async () => {
    if (busy || !unread.length) return;
    setBusy(true);
    await markIds(unread.map((event) => event.id));
    setBusy(false);
  };

  const openEvent = async (event: EventRow) => {
    await markIds([event.id]);
    switch (event.event_type) {
      case 'five_minutes_ping':
      case 'advice_requested':
      case 'connection_response': router.push('/(tabs)/together'); return;
      case 'recognition_added': router.push('/recognitions'); return;
      case 'meeting_created':
      case 'meeting_completed': router.push('/meeting-plan'); return;
      case 'mood_shared': router.push('/mood-check-in'); return;
      case 'ritual_moment_added': router.push('/rituals'); return;
      case 'weekly_focus_added': router.push('/weekly-focus'); return;
      case 'agreement_proposed':
      case 'agreement_activated':
      case 'agreement_archived': router.push('/agreements'); return;
      case 'voice_story_added': router.push('/voice-stories'); return;
      case 'achievement_awarded':
      case 'mission_completed': router.push('/(tabs)/development'); return;
      default: router.push('/(tabs)/history');
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.topKicker}>НЕ ПРОПУСТИТЬ ВАЖНОЕ</Text><Text style={styles.topTitle}>События</Text></View>
          <View style={[styles.unreadBadge, !unread.length && styles.unreadBadgeEmpty]}><Text style={styles.unreadCount}>{unread.length}</Text></View>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroArtworkShell}><Image source={artwork.family} style={styles.heroArtwork} resizeMode="contain" /></View>
          <Text style={styles.heroKicker}>ВНУТРИ ПРИЛОЖЕНИЯ</Text>
          <Text style={styles.heroTitle}>{unread.length ? `${unread.length} ${unread.length === 1 ? 'новое событие' : 'новых событий'}` : 'Всё важное уже просмотрено'}</Text>
          <Text style={styles.heroText}>Push может потеряться среди уведомлений Android. Здесь важные действия второго человека остаются, пока ты сам их не увидишь.</Text>
          {unread.length ? (
            <Pressable disabled={busy} onPress={() => void markAll()} style={[styles.markAll, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color={colors.navyDeep} /> : <Text style={styles.markAllText}>Прочитать всё ✓</Text>}
            </Pressable>
          ) : null}
        </LinearGradient>

        <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>ПОСЛЕДНЕЕ</Text><Text style={styles.sectionTitle}>Что произошло</Text></View></View>

        {events.length ? (
          <View style={styles.list}>
            {events.map((event) => {
              const isRead = readIds.has(event.id);
              const actor = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Ваша команда' : 'Ваша команда';
              const view = viewFor(event, actor);
              return (
                <Pressable key={event.id} onPress={() => void openEvent(event)} style={[styles.eventCard, !isRead && styles.eventUnread, shadows.soft]}>
                  <View style={[styles.eventIcon, { backgroundColor: view.base }]}><Image source={view.image} style={styles.eventIconImage} resizeMode="contain" /></View>
                  <View style={styles.eventCopy}>
                    <View style={styles.eventTop}><Text style={styles.eventDate}>{when(event.occurred_at)}</Text>{!isRead ? <View style={styles.newDot} /> : null}</View>
                    <Text style={styles.eventTitle}>{view.title}</Text>
                    <Text style={styles.eventText}>{view.text}</Text>
                  </View>
                  <Text style={styles.eventArrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.empty, shadows.soft]}>
            <View style={styles.emptyIconShell}><Image source={artwork.home} style={styles.emptyIcon} resizeMode="contain" /></View>
            <Text style={styles.emptyTitle}>Пока тихо</Text>
            <Text style={styles.emptyText}>Когда второй участник сохранит важный момент, ответит, предложит встречу или договорённость — это появится здесь.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topCopy: { flex: 1 },
  topKicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.1 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 1 },
  unreadBadge: { minWidth: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeEmpty: { backgroundColor: colors.mint },
  unreadCount: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  hero: { minHeight: 245, borderRadius: radius.xl, padding: 21, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,215,106,0.10)', right: -65, top: -70 },
  heroArtworkShell: { position: 'absolute', right: 16, top: 14, width: 76, height: 76, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  heroArtwork: { width: 68, height: 68 },
  heroKicker: { color: colors.sun, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 11, maxWidth: '92%' },
  heroText: { color: '#D8E6E7', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: '92%' },
  markAll: { alignSelf: 'flex-start', minHeight: 39, borderRadius: radius.pill, backgroundColor: colors.sun, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  markAllText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.15 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  list: { gap: 9 },
  eventCard: { minHeight: 102, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventUnread: { backgroundColor: '#FFFDF5', borderColor: '#E6C97F' },
  eventIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eventIconImage: { width: 45, height: 45 },
  eventCopy: { flex: 1 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventDate: { color: colors.mutedSoft, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  eventTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 4 },
  eventText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  eventArrow: { color: colors.mutedSoft, fontSize: 23 },
  empty: { minHeight: 210, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyIconShell: { width: 74, height: 74, borderRadius: 24, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 66, height: 66 },
  emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 9 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 5, maxWidth: '88%' },
});
