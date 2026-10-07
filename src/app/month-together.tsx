import { AppScrollView as ScrollView } from '../components/AppScrollView';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type EventRow = {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  category: string | null;
  occurred_at: string;
  payload: unknown;
};

type MeetingRow = {
  id: string;
  meeting_date: string;
  title: string;
};

type StatCard = {
  key: string;
  label: string;
  value: number;
  image: ImageSourcePropType;
  base: string;
  ink: string;
};

const artwork = {
  family: require('../../assets/generated/feature-family.png'),
  path: require('../../assets/generated/feature-path.png'),
  book: require('../../assets/generated/feature-book.png'),
  calendar: require('../../assets/generated/utility-calendar.png'),
  voice: require('../../assets/generated/utility-voice.png'),
  recognition: require('../../assets/generated/utility-recognition.png'),
  goal: require('../../assets/generated/utility-goal.png'),
  agreements: require('../../assets/generated/utility-agreements.png'),
  team: require('../../assets/generated/badge-team.png'),
} as const satisfies Record<string, ImageSourcePropType>;

const monthStartIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return start.toISOString();
};

const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const monthTitle = () => new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

const payloadRecord = (payload: unknown): Record<string, unknown> => (
  payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
);

const payloadText = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'string' ? value : null;
};

const prettyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
});

const eventLabel = (event: EventRow) => {
  const title = payloadText(event.payload, 'title');
  switch (event.event_type) {
    case 'meeting_completed': return title ? `Встреча «${title}»` : 'Встреча осталась в истории';
    case 'meeting_created': return title ? `Запланировали «${title}»` : 'Запланировали встречу';
    case 'voice_story_added': return title || 'Сохранили голосовую историю';
    case 'recognition_added': return title || 'Заметили важный поступок';
    case 'growth_entry_added': return title || 'Сохранили момент роста';
    case 'achievement_awarded': return title || 'Открылась новая веха';
    case 'mission_completed': return title || 'Завершили один из шагов';
    case 'ritual_moment_added': return title || 'Случился ваш ритуал';
    case 'agreement_activated': return title ? `Договорились: «${title}»` : 'Подтвердили договорённость';
    case 'five_minutes_ping': return 'Нашли пять минут друг для друга';
    case 'connection_response': return 'Ответили друг другу';
    case 'reflection_added': return 'Сохранили мысль в общей истории';
    default: return title || 'Ещё один общий момент';
  }
};

const eventArtwork = (event: EventRow): ImageSourcePropType => {
  switch (event.event_type) {
    case 'meeting_completed':
    case 'meeting_created': return artwork.calendar;
    case 'voice_story_added': return artwork.voice;
    case 'recognition_added': return artwork.recognition;
    case 'agreement_activated': return artwork.agreements;
    case 'growth_entry_added':
    case 'mission_completed':
    case 'achievement_awarded': return artwork.goal;
    case 'ritual_moment_added': return artwork.team;
    default: return artwork.family;
  }
};

export default function MonthTogetherScreen() {
  const { family, members } = useFamily();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [nextMeeting, setNextMeeting] = useState<MeetingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }

    const [eventResult, meetingResult] = await Promise.all([
      client
        .from('activity_events')
        .select('id,actor_user_id,event_type,category,occurred_at,payload')
        .eq('family_id', family.id)
        .gte('occurred_at', monthStartIso())
        .order('occurred_at', { ascending: false })
        .limit(160),
      client
        .from('meetings')
        .select('id,meeting_date,title')
        .eq('family_id', family.id)
        .eq('status', 'planned')
        .gte('meeting_date', todayIso())
        .order('meeting_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!eventResult.error) setEvents((eventResult.data ?? []) as EventRow[]);
    if (!meetingResult.error) setNextMeeting((meetingResult.data as MeetingRow | null) ?? null);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo<StatCard[]>(() => {
    const count = (...types: string[]) => events.filter((event) => types.includes(event.event_type)).length;
    return [
      { key: 'connection', label: 'сигналов связи', value: count('five_minutes_ping', 'connection_response'), image: artwork.family, base: '#DDEDEF', ink: '#2D6D73' },
      { key: 'meeting', label: 'встреч в истории', value: count('meeting_completed'), image: artwork.calendar, base: '#DCEFFF', ink: '#2E6286' },
      { key: 'voice', label: 'голосовых историй', value: count('voice_story_added'), image: artwork.voice, base: '#EDE8F7', ink: '#66579C' },
      { key: 'recognition', label: 'моментов «Я заметил»', value: count('recognition_added'), image: artwork.recognition, base: '#F8E1E5', ink: '#9B5660' },
      { key: 'growth', label: 'шагов роста', value: count('growth_entry_added', 'mission_completed', 'achievement_awarded'), image: artwork.goal, base: '#DDF0E4', ink: '#356B50' },
      { key: 'ritual', label: 'ритуалов и договорённостей', value: count('ritual_moment_added', 'agreement_activated'), image: artwork.agreements, base: '#FFF0CF', ink: '#956719' },
    ];
  }, [events]);

  const meaningfulCount = useMemo(() => stats.reduce((sum, item) => sum + item.value, 0), [stats]);
  const recent = events.slice(0, 5);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.topKicker}>ПАПА & Я</Text>
            <Text style={styles.topTitle}>Месяц вместе</Text>
          </View>
          <View style={styles.topIcon}><Image source={artwork.family} style={styles.topIconImage} resizeMode="contain" /></View>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroImageShell}><Image source={artwork.path} style={styles.heroImage} resizeMode="contain" /></View>
          <Text style={styles.heroKicker}>{monthTitle().toUpperCase()}</Text>
          <Text style={styles.heroTitle}>Не отчёт. Просто следы того, что вы были рядом.</Text>
          <Text style={styles.heroText}>Здесь нет процентов, серий и сравнения. Только реальные общие моменты, которые уже случились в этом месяце.</Text>
          <View style={styles.heroNumberRow}>
            <Text style={styles.heroNumber}>{meaningfulCount}</Text>
            <Text style={styles.heroNumberLabel}>заметных моментов{meaningfulCount === 0 ? ' пока нет' : ''}</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionHead}>
          <View><Text style={styles.eyebrow}>ЧТО БЫЛО</Text><Text style={styles.sectionTitle}>Месяц в моментах</Text></View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View key={item.key} style={[styles.statCard, { backgroundColor: item.base }, shadows.soft]}>
              <View style={styles.statIconShell}><Image source={item.image} style={styles.statIcon} resizeMode="contain" /></View>
              <Text style={[styles.statValue, { color: item.ink }]}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Pressable style={[styles.nextCard, shadows.soft]} onPress={() => router.push('/meeting-plan')}>
          <View style={styles.nextIconShell}><Image source={artwork.calendar} style={styles.nextIcon} resizeMode="contain" /></View>
          <View style={styles.nextCopy}>
            <Text style={styles.eyebrow}>СЛЕДУЮЩАЯ ТОЧКА</Text>
            <Text style={styles.nextTitle}>{nextMeeting ? nextMeeting.title : 'Запланировать встречу'}</Text>
            <Text style={styles.nextText}>{nextMeeting ? prettyDate(nextMeeting.meeting_date) : 'Добавьте что-то небольшое, чего приятно ждать вместе.'}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <View style={styles.sectionHead}>
          <View><Text style={styles.eyebrow}>СВЕЖИЕ СЛЕДЫ</Text><Text style={styles.sectionTitle}>Последние моменты</Text></View>
          <Pressable onPress={() => router.push('/(tabs)/history')}><Text style={styles.sectionLink}>Вся история →</Text></Pressable>
        </View>

        {recent.length ? (
          <View style={styles.recentList}>
            {recent.map((event) => (
              <View key={event.id} style={[styles.recentCard, shadows.soft]}>
                <View style={styles.recentIconShell}><Image source={eventArtwork(event)} style={styles.recentIcon} resizeMode="contain" /></View>
                <View style={styles.recentCopy}>
                  <Text style={styles.recentDate}>{new Date(event.occurred_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</Text>
                  <Text style={styles.recentTitle}>{eventLabel(event)}</Text>
                  <Text style={styles.recentActor}>{event.actor_user_id ? names.get(event.actor_user_id) ?? 'Участник команды' : 'Команда'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.empty, shadows.soft]}>
            <Image source={artwork.book} style={styles.emptyImage} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Этот месяц только начинается</Text>
            <Text style={styles.emptyText}>Первая встреча, голосовая история, договорённость или маленький шаг автоматически появятся здесь.</Text>
          </View>
        )}

        <View style={styles.footerCard}>
          <Image source={artwork.team} style={styles.footerImage} resizeMode="contain" />
          <View style={styles.footerCopy}>
            <Text style={styles.footerTitle}>Главное не количество</Text>
            <Text style={styles.footerText}>Даже один настоящий разговор важнее десятка отметок. Этот экран — память, а не оценка вашей близости.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 17 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -2 },
  topCopy: { flex: 1 },
  topKicker: { color: colors.teal, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', marginTop: 1 },
  topIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#E6F0F2', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topIconImage: { width: 42, height: 42 },
  hero: { minHeight: 300, borderRadius: radius.xl, padding: 21, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,215,106,0.12)', right: -65, top: -72 },
  heroImageShell: { width: 66, height: 66, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  heroImage: { width: 60, height: 60 },
  heroKicker: { color: colors.sun, fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 6, maxWidth: '92%' },
  heroText: { color: '#D7E6E8', fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: '92%' },
  heroNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 'auto', paddingTop: 18 },
  heroNumber: { color: colors.sun, fontSize: 34, fontWeight: '900' },
  heroNumberLabel: { color: colors.white, fontSize: 14, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  eyebrow: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3 },
  sectionLink: { color: colors.teal, fontSize: 14, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statCard: { width: '48.5%', minHeight: 138, borderRadius: radius.lg, padding: 13 },
  statIconShell: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  statIcon: { width: 40, height: 40 },
  statValue: { fontSize: 24, fontWeight: '900', marginTop: 10 },
  statLabel: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 2 },
  nextCard: { minHeight: 92, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  nextIconShell: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  nextIcon: { width: 49, height: 49 },
  nextCopy: { flex: 1 },
  nextTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 2 },
  nextText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  arrow: { color: colors.teal, fontSize: 25 },
  recentList: { gap: 8 },
  recentCard: { minHeight: 78, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  recentIconShell: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  recentIcon: { width: 43, height: 43 },
  recentCopy: { flex: 1 },
  recentDate: { color: colors.teal, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  recentTitle: { color: colors.navyDeep, fontSize: 14, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  recentActor: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 2 },
  empty: { minHeight: 190, borderRadius: radius.xl, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyImage: { width: 70, height: 70 },
  emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 5, maxWidth: '90%' },
  footerCard: { minHeight: 100, borderRadius: radius.lg, backgroundColor: '#EFE7DA', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerImage: { width: 58, height: 58 },
  footerCopy: { flex: 1 },
  footerTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  footerText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
});
