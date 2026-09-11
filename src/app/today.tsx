import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type WeeklyFocus = { id: string; target_user_id: string | null; category: string; title: string; week_start: string };
type Meeting = { id: string; meeting_date: string; title: string };
type Ritual = { id: string; title: string; symbol: string; cadence: 'weekly' | 'monthly' | 'flexible'; cadence_value: number | null };
type RitualMoment = { ritual_id: string; happened_on: string };
type Mood = { user_id: string; mood: string; created_at: string };

const moodMeta: Record<string, { emoji: string; label: string }> = {
  great: { emoji: '😄', label: 'Отлично' },
  good: { emoji: '🙂', label: 'Хорошо' },
  okay: { emoji: '😐', label: 'Нормально' },
  ok: { emoji: '😐', label: 'Нормально' },
  low: { emoji: '😕', label: 'Так себе' },
  tired: { emoji: '😴', label: 'Устал' },
  sad: { emoji: '😔', label: 'Грустно' },
  angry: { emoji: '😤', label: 'Злюсь' },
};

const localIso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const todayIso = () => localIso(new Date());

const mondayIso = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return localIso(date);
};

const localDayBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
};

const meetingLabel = (meeting: Meeting | null) => {
  if (!meeting) return 'Пока не запланирована';
  const target = new Date(`${meeting.meeting_date}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  if (days < 5) return `Через ${days} дня`;
  return target.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

export default function TodayScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [focuses, setFocuses] = useState<WeeklyFocus[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [moments, setMoments] = useState<RitualMoment[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';
  const isChild = me?.role === 'child';
  const weekStart = useMemo(mondayIso, []);
  const today = useMemo(todayIso, []);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }
    const bounds = localDayBounds();
    const [focusResult, meetingResult, ritualResult, momentResult, moodResult] = await Promise.all([
      client.from('weekly_focuses').select('id,target_user_id,category,title,week_start').eq('family_id', family.id).eq('week_start', weekStart),
      client.from('meetings').select('id,meeting_date,title').eq('family_id', family.id).eq('status', 'planned').gte('meeting_date', today).order('meeting_date', { ascending: true }).limit(1).maybeSingle(),
      client.from('family_rituals').select('id,title,symbol,cadence,cadence_value').eq('family_id', family.id).eq('active', true).order('created_at', { ascending: true }),
      client.from('ritual_moments').select('ritual_id,happened_on').eq('family_id', family.id).eq('happened_on', today),
      client.from('moods').select('user_id,mood,created_at').eq('family_id', family.id).gte('created_at', bounds.start).lt('created_at', bounds.end).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!focusResult.error) setFocuses((focusResult.data ?? []) as WeeklyFocus[]);
    if (!meetingResult.error) setMeeting((meetingResult.data as Meeting | null) ?? null);
    if (!ritualResult.error) setRituals((ritualResult.data ?? []) as Ritual[]);
    if (!momentResult.error) setMoments((momentResult.data ?? []) as RitualMoment[]);
    if (!moodResult.error) setMoods((moodResult.data ?? []) as Mood[]);
    setLoading(false);
  }, [family, today, weekStart]);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const childFocus = focuses.find((item) => item.target_user_id === child?.user_id) ?? null;
  const togetherFocus = focuses.find((item) => item.target_user_id === null) ?? null;

  const latestMood = (userId?: string) => {
    if (!userId) return null;
    const row = moods.find((item) => item.user_id === userId);
    return row ? moodMeta[row.mood] ?? { emoji: '○', label: 'Есть отметка' } : null;
  };

  const parentMood = latestMood(parent?.user_id);
  const childMood = latestMood(child?.user_id);
  const myMood = latestMood(me?.user_id);

  const dueRituals = rituals.filter((ritual) => {
    if (ritual.cadence === 'weekly') return ritual.cadence_value === new Date().getDay();
    if (ritual.cadence === 'monthly') return ritual.cadence_value === new Date().getDate();
    return false;
  });
  const doneIds = new Set(moments.map((item) => item.ritual_id));

  const nextAction = !myMood
    ? { icon: '♥', kicker: 'ОДИН МАЛЕНЬКИЙ ШАГ', title: 'Отметить, как ты сегодня', text: 'Одной отметки достаточно. Никакого обязательного комментария.', route: '/mood-check-in' as const }
    : dueRituals.some((ritual) => !doneIds.has(ritual.id))
      ? { icon: '∞', kicker: 'МОЖНО СЕГОДНЯ', title: 'Не забыть ваш ритуал', text: 'Если случится — просто отметьте момент. Если нет, ничего не потеряется.', route: '/rituals' as const }
      : { icon: '?', kicker: 'ЕСЛИ ЕСТЬ 5 МИНУТ', title: 'Вытянуть карточку разговора', text: 'Один вопрос без правильного ответа — просто повод узнать друг друга ещё чуть лучше.', route: '/conversation-cards' as const };

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
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
          <View><Text style={styles.topKicker}>ПАПА & Я</Text><Text style={styles.topTitle}>Сегодня</Text></View>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{isChild ? `${childName}, что сегодня действительно важно?` : `${parentName}, что сегодня поможет быть ближе?`}</Text>
          <Text style={styles.heroText}>Не список дел. Только несколько ориентиров вашей общей жизни на сегодня.</Text>
          <View style={styles.heroPeople}>
            <View style={styles.personPill}><Text style={styles.personPillText}>{parentMood?.emoji ?? '○'} {parentName}</Text></View>
            <View style={styles.personPill}><Text style={styles.personPillText}>{childMood?.emoji ?? '○'} {childName}</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHead}><View><Text style={styles.eyebrow}>НА ЭТОЙ НЕДЕЛЕ</Text><Text style={styles.sectionTitle}>Держим в поле зрения</Text></View></View>
        <View style={styles.focusGrid}>
          <Pressable style={[styles.focusCard, styles.focusChild, shadows.soft]} onPress={() => router.push('/weekly-focus')}>
            <Text style={styles.focusIcon}>◎</Text>
            <Text style={styles.focusKicker}>ФОКУС {childName.toUpperCase()}</Text>
            <Text style={styles.focusTitle}>{childFocus?.title ?? 'Пока не выбран'}</Text>
            <Text style={styles.focusOpen}>{childFocus ? 'Открыть →' : 'Выбрать →'}</Text>
          </Pressable>
          <Pressable style={[styles.focusCard, styles.focusTogether, shadows.soft]} onPress={() => router.push('/weekly-focus')}>
            <Text style={styles.focusIconTogether}>♥</Text>
            <Text style={styles.focusKickerTogether}>ПАПА & Я</Text>
            <Text style={styles.focusTitle}>{togetherFocus?.title ?? 'Пока без общего ориентира'}</Text>
            <Text style={styles.focusOpenTogether}>{togetherFocus ? 'Открыть →' : 'Выбрать →'}</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.meetingCard, shadows.soft]} onPress={() => router.push('/meeting-plan')}>
          <View style={styles.meetingIcon}><Text style={styles.meetingIconText}>⌁</Text></View>
          <View style={styles.meetingCopy}>
            <Text style={styles.eyebrow}>СЛЕДУЮЩАЯ ВСТРЕЧА</Text>
            <Text style={styles.meetingTitle}>{meetingLabel(meeting)}</Text>
            <Text style={styles.meetingText} numberOfLines={2}>{meeting?.title ?? 'Можно выбрать дату и придумать, что сделать вместе.'}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <View style={styles.sectionHead}>
          <View><Text style={styles.eyebrow}>НАШИ РИТУАЛЫ</Text><Text style={styles.sectionTitle}>Что может случиться сегодня</Text></View>
          <Pressable onPress={() => router.push('/rituals')}><Text style={styles.link}>Все →</Text></Pressable>
        </View>
        {dueRituals.length ? (
          <View style={[styles.ritualCard, shadows.soft]}>
            {dueRituals.slice(0, 3).map((ritual, index) => {
              const done = doneIds.has(ritual.id);
              return (
                <View key={ritual.id} style={[styles.ritualRow, index > 0 && styles.ritualBorder]}>
                  <View style={[styles.ritualSymbol, done && styles.ritualSymbolDone]}><Text style={styles.ritualSymbolText}>{ritual.symbol}</Text></View>
                  <View style={styles.ritualCopy}><Text style={styles.ritualTitle}>{ritual.title}</Text><Text style={[styles.ritualState, done && styles.ritualStateDone]}>{done ? 'Уже было сегодня ✓' : 'Если получится — просто проживите этот момент'}</Text></View>
                </View>
              );
            })}
          </View>
        ) : (
          <Pressable onPress={() => router.push('/rituals')} style={[styles.emptyRitual, shadows.soft]}>
            <Text style={styles.emptyRitualIcon}>∞</Text>
            <View style={styles.emptyRitualCopy}><Text style={styles.emptyRitualTitle}>Сегодня ничего не обязано повторяться</Text><Text style={styles.emptyRitualText}>Гибкие ритуалы можно отметить в любой день, когда они действительно случились.</Text></View>
          </Pressable>
        )}

        <Pressable style={[styles.nextCard, shadows.lift]} onPress={() => router.push(nextAction.route)}>
          <View style={styles.nextIcon}><Text style={styles.nextIconText}>{nextAction.icon}</Text></View>
          <View style={styles.nextCopy}><Text style={styles.nextKicker}>{nextAction.kicker}</Text><Text style={styles.nextTitle}>{nextAction.title}</Text><Text style={styles.nextText}>{nextAction.text}</Text></View>
          <Text style={styles.nextArrow}>→</Text>
        </Pressable>

        <View style={styles.quickRow}>
          <Pressable style={styles.quick} onPress={() => router.push('/week-review')}><Text style={styles.quickIcon}>▤</Text><Text style={styles.quickText}>Итог недели</Text></Pressable>
          <Pressable style={styles.quick} onPress={() => router.push('/recognitions')}><Text style={styles.quickIcon}>✦</Text><Text style={styles.quickText}>Я заметил</Text></Pressable>
          <Pressable style={styles.quick} onPress={() => router.push('/conversation-cards')}><Text style={styles.quickIcon}>?</Text><Text style={styles.quickText}>Карточка</Text></Pressable>
        </View>

        {!session ? <Text style={styles.demo}>После входа здесь появятся ваши реальные данные.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 1 },
  hero: { minHeight: 270, borderRadius: radius.xl, padding: 21, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.10)', right: -70, top: -75 },
  heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 11, maxWidth: '92%' },
  heroText: { color: '#D8E6E7', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: '91%' },
  heroPeople: { flexDirection: 'row', gap: 8, marginTop: 'auto' },
  personPill: { backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  personPillText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  link: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  focusGrid: { flexDirection: 'row', gap: 10 },
  focusCard: { flex: 1, minHeight: 178, borderRadius: radius.xl, padding: 15 },
  focusChild: { backgroundColor: '#DCEFFF' },
  focusTogether: { backgroundColor: '#FFF0CF' },
  focusIcon: { color: '#2E6286', fontSize: 24, fontWeight: '900' },
  focusIconTogether: { color: '#A7751E', fontSize: 22, fontWeight: '900' },
  focusKicker: { color: '#2E6286', fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 12 },
  focusKickerTogether: { color: '#956719', fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 12 },
  focusTitle: { color: colors.navyDeep, fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 6 },
  focusOpen: { color: '#2E6286', fontSize: 9, fontWeight: '900', marginTop: 'auto' },
  focusOpenTogether: { color: '#956719', fontSize: 9, fontWeight: '900', marginTop: 'auto' },
  meetingCard: { minHeight: 96, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  meetingIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#F8E0AA', alignItems: 'center', justifyContent: 'center' },
  meetingIconText: { color: colors.navyDeep, fontSize: 28, fontWeight: '900', transform: [{ rotate: '-12deg' }] },
  meetingCopy: { flex: 1 },
  meetingTitle: { color: colors.navyDeep, fontSize: 17, fontWeight: '900', marginTop: 2 },
  meetingText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  arrow: { color: colors.muted, fontSize: 28 },
  ritualCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 15 },
  ritualRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ritualBorder: { borderTopWidth: 1, borderTopColor: colors.lineWarm },
  ritualSymbol: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  ritualSymbolDone: { backgroundColor: colors.mint },
  ritualSymbolText: { color: colors.navyDeep, fontSize: 17, fontWeight: '900' },
  ritualCopy: { flex: 1 },
  ritualTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  ritualState: { color: colors.muted, fontSize: 8, marginTop: 3 },
  ritualStateDone: { color: colors.green, fontWeight: '800' },
  emptyRitual: { minHeight: 88, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emptyRitualIcon: { width: 43, color: colors.amber, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  emptyRitualCopy: { flex: 1 },
  emptyRitualTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  emptyRitualText: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 3 },
  nextCard: { minHeight: 125, backgroundColor: colors.navyDeep, borderRadius: radius.xl, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  nextIconText: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  nextCopy: { flex: 1 },
  nextKicker: { color: '#9FC3CA', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  nextTitle: { color: colors.white, fontSize: 16, fontWeight: '900', marginTop: 3 },
  nextText: { color: '#D4E2E4', fontSize: 9, lineHeight: 14, marginTop: 4 },
  nextArrow: { color: colors.sun, fontSize: 20, fontWeight: '900' },
  quickRow: { flexDirection: 'row', gap: 8 },
  quick: { flex: 1, minHeight: 70, backgroundColor: colors.paper, borderRadius: 18, borderWidth: 1, borderColor: colors.lineWarm, alignItems: 'center', justifyContent: 'center', gap: 4 },
  quickIcon: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  quickText: { color: colors.navyDeep, fontSize: 8, fontWeight: '900' },
  demo: { color: colors.muted, fontSize: 9, textAlign: 'center' },
});