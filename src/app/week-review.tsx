import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type Mood = { user_id: string; mood: string; note: string | null; created_at: string };
type Focus = { target_user_id: string | null; category: string; title: string; note: string | null };
type RitualMoment = { ritual_id: string; created_by: string; happened_on: string; created_at: string };
type Ritual = { id: string; title: string; symbol: string };
type Recognition = { id: string; from_user_id: string; to_user_id: string; quality: string; title: string; note: string; created_at: string };
type ActivityEvent = { id: string; actor_user_id: string | null; event_type: string; occurred_at: string; payload: unknown };

const moodMeta: Record<string, { label: string; icon: string }> = {
  great: { label: 'Отлично', icon: '☀' },
  good: { label: 'Хорошо', icon: '🙂' },
  ok: { label: 'Нормально', icon: '○' },
  tired: { label: 'Устал', icon: '◌' },
  sad: { label: 'Грустно', icon: '☂' },
  angry: { label: 'Злюсь', icon: '⚡' },
};

const localIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const currentMonday = () => {
  const date = new Date(); date.setHours(12, 0, 0, 0);
  const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return localIso(date);
};
const addDays = (iso: string, amount: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + amount); return localIso(d); };
const weekLabel = (start: string) => {
  const end = addDays(start, 6);
  const a = new Date(`${start}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const b = new Date(`${end}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${a} — ${b}`;
};
const payloadRecord = (payload: unknown): Record<string, unknown> => payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
const payloadText = (payload: unknown, key: string) => typeof payloadRecord(payload)[key] === 'string' ? payloadRecord(payload)[key] as string : null;

export default function WeekReviewScreen() {
  const { family, members } = useFamily();
  const weekStart = useMemo(currentMonday, []);
  const nextWeek = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.display_name])), [members]);
  const child = useMemo(() => members.find((m) => m.role === 'child') ?? null, [members]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [focuses, setFocuses] = useState<Focus[]>([]);
  const [moments, setMoments] = useState<RitualMoment[]>([]);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) { setLoading(false); return; }
    setLoading(true);
    const startTs = `${weekStart}T00:00:00.000Z`;
    const endTs = `${nextWeek}T00:00:00.000Z`;
    const [moodResult, focusResult, momentResult, recognitionResult, eventResult] = await Promise.all([
      client.from('moods').select('user_id,mood,note,created_at').eq('family_id', family.id).gte('created_at', startTs).lt('created_at', endTs).order('created_at', { ascending: false }).limit(40),
      client.from('weekly_focuses').select('target_user_id,category,title,note').eq('family_id', family.id).eq('week_start', weekStart),
      client.from('ritual_moments').select('ritual_id,created_by,happened_on,created_at').eq('family_id', family.id).gte('happened_on', weekStart).lt('happened_on', nextWeek).order('happened_on', { ascending: false }).limit(40),
      client.from('recognitions').select('id,from_user_id,to_user_id,quality,title,note,created_at').eq('family_id', family.id).gte('created_at', startTs).lt('created_at', endTs).order('created_at', { ascending: false }).limit(12),
      client.from('activity_events').select('id,actor_user_id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['reflection_added', 'voice_story_added', 'meeting_completed']).gte('occurred_at', startTs).lt('occurred_at', endTs).order('occurred_at', { ascending: false }).limit(12),
    ]);
    if (moodResult.error || focusResult.error || momentResult.error || recognitionResult.error || eventResult.error) {
      Alert.alert('Не всё загрузилось', 'Часть итогов недели пока недоступна. Потяни экран позже, чтобы обновить данные.');
    }
    setMoods((moodResult.data ?? []) as Mood[]);
    setFocuses((focusResult.data ?? []) as Focus[]);
    const momentRows = (momentResult.data ?? []) as RitualMoment[];
    setMoments(momentRows);
    setRecognitions((recognitionResult.data ?? []) as Recognition[]);
    setEvents((eventResult.data ?? []) as ActivityEvent[]);
    const ritualIds = [...new Set(momentRows.map((m) => m.ritual_id))];
    if (ritualIds.length) {
      const ritualResult = await client.from('family_rituals').select('id,title,symbol').in('id', ritualIds);
      if (!ritualResult.error) setRituals((ritualResult.data ?? []) as Ritual[]);
    } else setRituals([]);
    setLoading(false);
  }, [family, nextWeek, weekStart]);

  useEffect(() => { void load(); }, [load]);

  const latestMood = useMemo(() => {
    const map = new Map<string, Mood>();
    for (const mood of moods) if (!map.has(mood.user_id)) map.set(mood.user_id, mood);
    return map;
  }, [moods]);
  const ritualMap = useMemo(() => new Map(rituals.map((r) => [r.id, r])), [rituals]);
  const ritualSummary = useMemo(() => {
    const map = new Map<string, { ritual: Ritual; count: number }>();
    for (const moment of moments) {
      const ritual = ritualMap.get(moment.ritual_id);
      if (!ritual) continue;
      const current = map.get(ritual.id);
      map.set(ritual.id, { ritual, count: (current?.count ?? 0) + 1 });
    }
    return [...map.values()];
  }, [moments, ritualMap]);

  const momentTitle = (event: ActivityEvent) => {
    const actor = event.actor_user_id ? names.get(event.actor_user_id) ?? 'Кто-то из команды' : 'Команда';
    const title = payloadText(event.payload, 'title');
    if (event.event_type === 'voice_story_added') return title ? `${actor}: «${title}»` : `${actor} оставил голосовую историю`;
    if (event.event_type === 'meeting_completed') return title ? `Встреча «${title}»` : 'Встреча состоялась';
    const preview = payloadText(event.payload, 'preview');
    return preview ? `${actor}: ${preview}` : `${actor} сохранил важную мысль`;
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.topKicker}>НЕ ОТЧЁТ · А ПАМЯТЬ</Text><Text style={styles.topTitle}>Итог недели</Text></View></View>
      <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
        <Text style={styles.heroKicker}>{weekLabel(weekStart).toUpperCase()}</Text>
        <Text style={styles.heroTitle}>Что осталось от этой недели?</Text>
        <Text style={styles.heroText}>Не считаем продуктивность. Собираем несколько настоящих следов: состояние, ориентиры, традиции, поддержку и моменты, которые захотелось сохранить.</Text>
        <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>Папа & Я · одна неделя жизни</Text></View>
      </LinearGradient>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Наши ориентиры</Text><Text style={styles.sectionMark}>◎</Text></View>
      {focuses.length ? <View style={styles.stack}>{focuses.map((f, i) => <View key={`${f.target_user_id ?? 'together'}-${i}`} style={[styles.itemCard, shadows.soft]}><Text style={styles.itemKicker}>{f.target_user_id ? (names.get(f.target_user_id) ?? child?.display_name ?? 'Артур').toUpperCase() : 'ПАПА & Я'}</Text><Text style={styles.itemTitle}>{f.title}</Text>{f.note ? <Text style={styles.itemText}>{f.note}</Text> : null}</View>)}</View> : <Text style={styles.emptyText}>На этой неделе фокус не задавали — и это тоже нормально.</Text>}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Как мы были</Text><Text style={styles.sectionMark}>♥</Text></View>
      <View style={styles.peopleGrid}>{members.map((member) => { const mood = latestMood.get(member.user_id); const m = mood ? moodMeta[mood.mood] : null; return <View key={member.user_id} style={[styles.personCard, shadows.soft]}><Text style={styles.personName}>{member.display_name}</Text><Text style={styles.moodIcon}>{m?.icon ?? '·'}</Text><Text style={styles.moodLabel}>{m?.label ?? 'Не отмечал'}</Text>{mood?.note ? <Text style={styles.moodNote}>{mood.note}</Text> : null}</View>; })}</View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Наши ритуалы</Text><Text style={styles.sectionMark}>↻</Text></View>
      {ritualSummary.length ? <View style={[styles.listCard, shadows.soft]}>{ritualSummary.map(({ ritual, count }, i) => <View key={ritual.id} style={[styles.listRow, i > 0 && styles.border]}><Text style={styles.listIcon}>{ritual.symbol}</Text><View style={{ flex: 1 }}><Text style={styles.listTitle}>{ritual.title}</Text><Text style={styles.listMeta}>{count === 1 ? 'случилось один раз' : `случилось ${count} раза`}</Text></View></View>)}</View> : <Text style={styles.emptyText}>Ритуалы этой недели не отмечали. Никаких потерянных серий.</Text>}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Что заметили друг в друге</Text><Text style={styles.sectionMark}>✦</Text></View>
      {recognitions.length ? <View style={[styles.listCard, shadows.soft]}>{recognitions.slice(0, 5).map((r, i) => <View key={r.id} style={[styles.recognition, i > 0 && styles.border]}><Text style={styles.recognitionTitle}>{r.title}</Text><Text style={styles.recognitionMeta}>{names.get(r.from_user_id) ?? 'Участник'} → {names.get(r.to_user_id) ?? 'другому'} · {r.quality}</Text>{r.note ? <Text style={styles.itemText}>{r.note}</Text> : null}</View>)}</View> : <Text style={styles.emptyText}>На этой неделе ещё не сохраняли «Я заметил».</Text>}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Сохранённые моменты</Text><Text style={styles.sectionMark}>▤</Text></View>
      {events.length ? <View style={[styles.listCard, shadows.soft]}>{events.slice(0, 6).map((e, i) => <View key={e.id} style={[styles.listRow, i > 0 && styles.border]}><Text style={styles.listIcon}>{e.event_type === 'voice_story_added' ? '🎙' : e.event_type === 'meeting_completed' ? '🤝' : '✎'}</Text><Text style={[styles.listTitle, { flex: 1 }]}>{momentTitle(e)}</Text></View>)}</View> : <Text style={styles.emptyText}>Ничего не обязаны сохранять. Пустая неделя тоже часть настоящей жизни.</Text>}

      <Pressable style={styles.reflectButton} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: 'Что из этой недели хочется запомнить через год?' } })}><LinearGradient colors={gradients.connection} style={styles.reflectGradient}><View><Text style={styles.reflectKicker}>ОДНА МЫСЛЬ НА БУДУЩЕЕ</Text><Text style={styles.reflectText}>Сохранить итог своими словами</Text></View><Text style={styles.reflectArrow}>→</Text></LinearGradient></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, content: { padding: 16, paddingBottom: 40, gap: 15 }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.navyDeep, fontSize: 31 }, topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  hero: { minHeight: 250, borderRadius: radius.xl, padding: 21 }, heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: colors.white, fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 10 }, heroText: { color: '#D8E6E7', fontSize: 11, lineHeight: 17, marginTop: 8 }, heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, marginTop: 'auto' }, heroBadgeText: { color: '#DDEBEC', fontSize: 8, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }, sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' }, sectionMark: { color: colors.amber, fontSize: 18, fontWeight: '900' }, stack: { gap: 8 }, itemCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 14 }, itemKicker: { color: colors.teal, fontSize: 7, fontWeight: '900', letterSpacing: 1 }, itemTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 4 }, itemText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 4 }, emptyText: { color: colors.muted, fontSize: 10, lineHeight: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, borderRadius: radius.lg, padding: 14 },
  peopleGrid: { flexDirection: 'row', gap: 9 }, personCard: { flex: 1, minHeight: 145, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 14 }, personName: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' }, moodIcon: { color: colors.teal, fontSize: 30, fontWeight: '900', marginTop: 12 }, moodLabel: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 4 }, moodNote: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 5 },
  listCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 14 }, listRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 }, border: { borderTopWidth: 1, borderTopColor: colors.lineWarm }, listIcon: { width: 28, color: colors.teal, fontSize: 16, fontWeight: '900' }, listTitle: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' }, listMeta: { color: colors.muted, fontSize: 8, marginTop: 2 }, recognition: { paddingVertical: 12 }, recognitionTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' }, recognitionMeta: { color: colors.purple, fontSize: 8, fontWeight: '800', marginTop: 3 },
  reflectButton: { borderRadius: radius.xl, overflow: 'hidden', marginTop: 5 }, reflectGradient: { minHeight: 76, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, reflectKicker: { color: '#76551A', fontSize: 7, fontWeight: '900', letterSpacing: 1 }, reflectText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 3 }, reflectArrow: { color: colors.navyDeep, fontSize: 24, fontWeight: '900' },
});
