import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type GrowthEntry = { id: string; category: string; activity_date: string; title: string | null; note: string | null };
type Mission = { id: string; category: string; title: string; completed_at: string | null };
type Award = { id: string; definition_id: string; awarded_at: string };
type AwardDefinition = { id: string; title: string; category: string };
type ActivityEvent = { id: string; actor_user_id: string | null; event_type: string; occurred_at: string; payload: unknown };
type ChapterItem = { id: string; category: string; title: string; detail: string | null; date: string; kind: 'growth' | 'mission' | 'award' | 'together' };

type Category = {
  id: string;
  title: string;
  icon: string;
  colors: readonly [string, string];
  ink: string;
};

const chapterAges = [11, 12, 13, 14, 15, 16, 17] as const;
const categories: Category[] = [
  { id: 'school', title: 'Школа', icon: '📘', colors: ['#E4F1FB', '#C8E2F4'], ink: '#35698D' },
  { id: 'football', title: 'Футбол', icon: '⚽', colors: ['#E1F3E7', '#C7E5D1'], ink: '#397058' },
  { id: 'chess', title: 'Шахматы', icon: '♞', colors: ['#ECE8FA', '#D7CEF2'], ink: '#5E5495' },
  { id: 'english', title: 'English', icon: 'EN', colors: ['#FFF2CE', '#FFE1A5'], ink: '#96651B' },
  { id: 'leadership', title: 'Лидерство', icon: '🧭', colors: ['#FFE5DC', '#F5C8B9'], ink: '#8D5246' },
  { id: 'together', title: 'Папа & Я', icon: '♥', colors: ['#FBE2E0', '#F0C9C6'], ink: '#96534F' },
];

const annualPrompts = [
  { id: 'proud', icon: '⭐', title: 'Гордость года', question: 'Чем я горжусь в этом году?', note: 'Поступок, усилие или момент, когда получилось не сдаться.' },
  { id: 'hard', icon: '⛰️', title: 'Сложный момент', question: 'Что было самым сложным?', note: 'То, что потребовало сил, терпения или смелости.' },
  { id: 'learned', icon: '💡', title: 'Главный рост', question: 'Чему я научился?', note: 'Навык, вывод о себе или новое понимание людей.' },
  { id: 'next', icon: '🚀', title: 'В следующий год', question: 'Что я хочу попробовать дальше?', note: 'Не обещание — просто направление, которое сейчас интересно.' },
] as const;

const payloadRecord = (payload: unknown): Record<string, unknown> => (
  payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {}
);
const payloadText = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'string' ? value : null;
};
const annualPromptKey = (question: string, age: number) => `${question} · Книга года ${age}`;
const addYears = (date: Date, years: number) => { const next = new Date(date); next.setFullYear(next.getFullYear() + years); return next; };
const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 11;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 11;
  const now = new Date();
  let result = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) result -= 1;
  return Math.max(11, Math.min(17, result));
};
const chapterRange = (birthDate: string | null, age: number) => {
  if (!birthDate) {
    const year = new Date().getFullYear() + (age - 11);
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }
  const birth = new Date(`${birthDate}T00:00:00`);
  return { start: addYears(birth, age), end: addYears(birth, age + 1) };
};
const inRange = (value: string | null, start: Date, end: Date) => {
  if (!value) return false;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return !Number.isNaN(date.getTime()) && date >= start && date < end;
};
const prettyDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const eventCopy = (event: ActivityEvent) => {
  const title = payloadText(event.payload, 'title');
  const preview = payloadText(event.payload, 'preview');
  const message = payloadText(event.payload, 'message');
  if (event.event_type === 'voice_story_added') return { title: title || 'Голосовая история', detail: preview };
  if (event.event_type === 'reflection_added') return { title: 'Сохранённая мысль', detail: preview };
  if (event.event_type === 'five_minutes_ping') return { title: 'Нашли пять минут друг для друга', detail: null };
  if (event.event_type === 'advice_requested') return { title: 'Попросили совета', detail: message };
  if (event.event_type === 'connection_response') return { title: 'Ответили друг другу', detail: null };
  return { title: 'Момент Папа & Я', detail: preview || message };
};

export default function YearBookV2() {
  const { family, members, me } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? members[0] ?? null, [members]);
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const isChild = me?.role === 'child';
  const childName = child?.display_name ?? 'Артур';
  const parentName = parent?.display_name ?? 'Михаил';
  const currentAge = ageFromBirthDate(child?.birth_date ?? null);
  const [selectedAge, setSelectedAge] = useState(currentAge);
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [definitions, setDefinitions] = useState<AwardDefinition[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => setSelectedAge(currentAge), [currentAge]);

  const load = useCallback(async () => {
    if (!supabase || !family || !child) {
      setLoading(false);
      return;
    }
    const [growthResult, missionsResult, awardsResult, definitionsResult, eventsResult] = await Promise.all([
      supabase.from('growth_entries').select('id,category,activity_date,title,note').eq('family_id', family.id).eq('user_id', child.user_id).order('activity_date', { ascending: false }).limit(700),
      supabase.from('missions').select('id,category,title,completed_at').eq('family_id', family.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(300),
      supabase.from('achievement_awards').select('id,definition_id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', child.user_id).order('awarded_at', { ascending: false }).limit(200),
      supabase.from('achievement_definitions').select('id,title,category'),
      supabase.from('activity_events').select('id,actor_user_id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['voice_story_added', 'reflection_added', 'five_minutes_ping', 'advice_requested', 'connection_response']).order('occurred_at', { ascending: false }).limit(500),
    ]);
    const error = growthResult.error ?? missionsResult.error ?? awardsResult.error ?? definitionsResult.error ?? eventsResult.error;
    if (error) Alert.alert('Не удалось собрать книгу года', error.message);
    else {
      setGrowthEntries((growthResult.data ?? []) as GrowthEntry[]);
      setMissions((missionsResult.data ?? []) as Mission[]);
      setAwards((awardsResult.data ?? []) as Award[]);
      setDefinitions((definitionsResult.data ?? []) as AwardDefinition[]);
      setEvents((eventsResult.data ?? []) as ActivityEvent[]);
    }
    setLoading(false);
  }, [family, child]);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const { start, end } = useMemo(() => chapterRange(child?.birth_date ?? null, selectedAge), [child?.birth_date, selectedAge]);
  const definitionsById = useMemo(() => new Map(definitions.map((item) => [item.id, item])), [definitions]);

  const chapterItems = useMemo<ChapterItem[]>(() => {
    const result: ChapterItem[] = [];
    for (const entry of growthEntries) if (inRange(entry.activity_date, start, end)) result.push({ id: `growth-${entry.id}`, category: entry.category, title: entry.title || 'Сохранённый момент', detail: entry.note, date: entry.activity_date, kind: 'growth' });
    for (const mission of missions) if (mission.completed_at && inRange(mission.completed_at, start, end)) result.push({ id: `mission-${mission.id}`, category: mission.category, title: `Миссия: ${mission.title}`, detail: null, date: mission.completed_at, kind: 'mission' });
    for (const award of awards) {
      if (!inRange(award.awarded_at, start, end)) continue;
      const definition = definitionsById.get(award.definition_id);
      if (definition) result.push({ id: `award-${award.id}`, category: definition.category || 'leadership', title: `Веха: ${definition.title}`, detail: null, date: award.awarded_at, kind: 'award' });
    }
    for (const event of events) {
      if (!inRange(event.occurred_at, start, end)) continue;
      const copy = eventCopy(event);
      result.push({ id: `event-${event.id}`, category: 'together', title: copy.title, detail: copy.detail, date: event.occurred_at, kind: 'together' });
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [growthEntries, missions, awards, events, definitionsById, start, end]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of chapterItems) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [chapterItems]);

  const annualAnswers = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const prompt of annualPrompts) {
      const answered = new Set<string>();
      const key = annualPromptKey(prompt.question, selectedAge);
      for (const event of events) {
        if ((event.event_type === 'reflection_added' || event.event_type === 'voice_story_added') && payloadText(event.payload, 'prompt') === key && event.actor_user_id) answered.add(event.actor_user_id);
      }
      map.set(prompt.id, answered);
    }
    return map;
  }, [events, selectedAge]);

  const missionCount = chapterItems.filter((item) => item.kind === 'mission').length;
  const awardCount = chapterItems.filter((item) => item.kind === 'award').length;
  const togetherCount = chapterItems.filter((item) => item.kind === 'together').length;
  const canReflect = selectedAge <= currentAge;
  const endDisplay = new Date(end); endDisplay.setDate(endDisplay.getDate() - 1);
  const period = `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} — ${endDisplay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  if (loading) return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
        <StoryHero
          kicker="КНИГА ГОДА · НАША ИСТОРИЯ"
          title={`${childName} · ${selectedAge} лет`}
          subtitle={isChild
            ? 'Здесь остаётся не «сколько процентов пройдено», а каким был этот год: что получилось, что было трудно и что мы прожили вместе.'
            : `Через много лет вы сможете открыть эту главу и снова услышать, каким был ${childName} в ${selectedAge}.`}
          emblem="📖"
          variant="book"
          footer={(
            <View style={styles.heroFooter}>
              <Text style={styles.heroPeriod}>{period}</Text>
              <View style={styles.heroStats}><Text style={styles.heroStat}>{chapterItems.length} моментов</Text><Text style={styles.heroStat}>·</Text><Text style={styles.heroStat}>{awardCount} вех</Text></View>
            </View>
          )}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageRow}>
          {chapterAges.map((age) => {
            const active = age === selectedAge;
            const future = age > currentAge;
            return (
              <Pressable key={age} onPress={() => setSelectedAge(age)} style={[styles.ageChip, active && styles.ageChipActive, future && styles.ageChipFuture]}>
                <Text style={[styles.ageText, active && styles.ageTextActive]}>{age}</Text>
                <Text style={[styles.ageLabel, active && styles.ageLabelActive]}>{future ? 'впереди' : age === currentAge ? 'сейчас' : 'глава'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHead}>
          <View><Text style={styles.kicker}>КАРТА ГЛАВЫ</Text><Text style={styles.sectionTitle}>Что осталось в памяти</Text></View>
          <Text style={styles.sectionNote}>{chapterItems.length} событий</Text>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <LinearGradient key={category.id} colors={category.colors} style={[styles.categoryCard, shadows.soft]}>
              <View style={styles.categoryTop}><Text style={styles.categoryIcon}>{category.icon}</Text><Text style={[styles.categoryCount, { color: category.ink }]}>{categoryCounts.get(category.id) ?? 0}</Text></View>
              <Text style={[styles.categoryTitle, { color: category.ink }]}>{category.title}</Text>
            </LinearGradient>
          ))}
        </View>

        <LinearGradient colors={['#FFF1C8', '#F8DDA8', '#F0C78A']} style={[styles.summaryRibbon, shadows.soft]}>
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{missionCount}</Text><Text style={styles.summaryLabel}>миссий</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{awardCount}</Text><Text style={styles.summaryLabel}>вех</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Text style={styles.summaryValue}>{togetherCount}</Text><Text style={styles.summaryLabel}>моментов вместе</Text></View>
        </LinearGradient>

        <View style={styles.sectionHead}>
          <View><Text style={styles.kicker}>ЛИЧНЫЕ ИТОГИ</Text><Text style={styles.sectionTitle}>Два голоса об одном годе</Text></View>
        </View>
        <Text style={styles.introText}>На каждый вопрос могут ответить и {parentName}, и {childName}. Текстом или голосом. Ответы не оцениваются и не сравниваются.</Text>

        <View style={styles.promptList}>
          {annualPrompts.map((prompt) => {
            const answered = annualAnswers.get(prompt.id) ?? new Set<string>();
            const meAnswered = me ? answered.has(me.user_id) : false;
            const parentAnswered = parent ? answered.has(parent.user_id) : false;
            const childAnswered = child ? answered.has(child.user_id) : false;
            return (
              <View key={prompt.id} style={[styles.promptCard, shadows.soft]}>
                <View style={styles.promptTop}><View style={styles.promptIcon}><Text style={styles.promptIconText}>{prompt.icon}</Text></View><View style={styles.promptCopy}><Text style={styles.promptTitle}>{prompt.title}</Text><Text style={styles.promptQuestion}>{prompt.question}</Text></View></View>
                <Text style={styles.promptNote}>{prompt.note}</Text>
                <View style={styles.voiceRow}>
                  <View style={[styles.voiceBadge, parentAnswered && styles.voiceBadgeDone]}><Text style={[styles.voiceBadgeText, parentAnswered && styles.voiceBadgeTextDone]}>{parentName}: {parentAnswered ? '✓' : '…'}</Text></View>
                  <View style={[styles.voiceBadge, childAnswered && styles.voiceBadgeDone]}><Text style={[styles.voiceBadgeText, childAnswered && styles.voiceBadgeTextDone]}>{childName}: {childAnswered ? '✓' : '…'}</Text></View>
                </View>
                {canReflect ? (
                  <Pressable
                    style={[styles.answerButton, meAnswered && styles.answerButtonSecondary]}
                    onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: annualPromptKey(prompt.question, selectedAge) } })}
                  >
                    <Text style={[styles.answerButtonText, meAnswered && styles.answerButtonTextSecondary]}>{meAnswered ? 'Добавить ещё одну мысль' : 'Ответить текстом или голосом'}</Text>
                  </Pressable>
                ) : <Text style={styles.futureHint}>Эта глава откроется, когда наступит этот возраст.</Text>}
              </View>
            );
          })}
        </View>

        <View style={[styles.timelineCard, shadows.soft]}>
          <View style={styles.sectionHead}><View><Text style={styles.kicker}>ХРОНОЛОГИЯ</Text><Text style={styles.sectionTitle}>Лента года</Text></View></View>
          {chapterItems.slice(0, 18).map((item, index) => {
            const category = categories.find((entry) => entry.id === item.category) ?? categories[5]!;
            return (
              <View key={item.id} style={[styles.timelineRow, index > 0 && styles.timelineBorder]}>
                <View style={[styles.timelineIcon, { backgroundColor: category.colors[0] }]}><Text style={styles.timelineIconText}>{category.icon}</Text></View>
                <View style={styles.timelineCopy}><Text style={styles.timelineTitle}>{item.title}</Text>{item.detail ? <Text style={styles.timelineDetail}>{item.detail}</Text> : null}<Text style={styles.timelineDate}>{prettyDate(item.date)}</Text></View>
              </View>
            );
          })}
          {!chapterItems.length ? (
            <View style={styles.emptyState}><Text style={styles.emptyIcon}>🌱</Text><Text style={styles.emptyTitle}>Глава пока тихая</Text><Text style={styles.emptyText}>Миссии, заметки, достижения и моменты «Папа & Я» будут собираться здесь автоматически.</Text></View>
          ) : null}
          {chapterItems.length > 18 ? <Pressable onPress={() => router.push('/(tabs)/history')} style={styles.historyButton}><Text style={styles.historyButtonText}>Открыть всю историю →</Text></Pressable> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroPeriod: { color: '#E4ECEE', fontSize: 9, fontWeight: '800', flex: 1 },
  heroStats: { flexDirection: 'row', gap: 5 },
  heroStat: { color: colors.white, fontSize: 9, fontWeight: '900' },
  ageRow: { gap: 8, paddingVertical: 2 },
  ageChip: { width: 62, minHeight: 58, borderRadius: 20, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E7DFD2', alignItems: 'center', justifyContent: 'center' },
  ageChipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep, transform: [{ translateY: -2 }] },
  ageChipFuture: { opacity: 0.6 },
  ageText: { color: colors.navyDeep, fontSize: 17, fontWeight: '900' },
  ageTextActive: { color: colors.white },
  ageLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', marginTop: 2 },
  ageLabelActive: { color: '#D7E5E5' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  kicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  sectionNote: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  categoryCard: { width: '31.6%', minHeight: 105, borderRadius: 22, padding: 12 },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryIcon: { fontSize: 20, fontWeight: '900' },
  categoryCount: { fontSize: 20, fontWeight: '900' },
  categoryTitle: { fontSize: 10, fontWeight: '900', marginTop: 18 },
  summaryRibbon: { minHeight: 86, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: colors.navyDeep, fontSize: 21, fontWeight: '900' },
  summaryLabel: { color: '#72562B', fontSize: 8, fontWeight: '800', marginTop: 2, textAlign: 'center' },
  summaryDivider: { width: 1, height: 37, backgroundColor: 'rgba(87,64,32,0.18)' },
  introText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: -8 },
  promptList: { gap: 10 },
  promptCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, borderWidth: 1, borderColor: '#E8DFD1', padding: 17 },
  promptTop: { flexDirection: 'row', gap: 11 },
  promptIcon: { width: 45, height: 45, borderRadius: 16, backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center' },
  promptIconText: { fontSize: 21 },
  promptCopy: { flex: 1 },
  promptTitle: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  promptQuestion: { color: colors.navyDeep, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  promptNote: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 10 },
  voiceRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  voiceBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#F1ECE4' },
  voiceBadgeDone: { backgroundColor: '#DDEEE4' },
  voiceBadgeText: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  voiceBadgeTextDone: { color: colors.green },
  answerButton: { minHeight: 43, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  answerButtonSecondary: { backgroundColor: '#EEF2EF', borderWidth: 1, borderColor: '#D6E0D9' },
  answerButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  answerButtonTextSecondary: { color: colors.green },
  futureHint: { color: colors.muted, fontSize: 9, fontStyle: 'italic', marginTop: 12 },
  timelineCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, borderWidth: 1, borderColor: '#E8DFD1', padding: 18 },
  timelineRow: { flexDirection: 'row', gap: 11, paddingVertical: 12 },
  timelineBorder: { borderTopWidth: 1, borderTopColor: '#EEE7DC' },
  timelineIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineIconText: { fontSize: 17, fontWeight: '900' },
  timelineCopy: { flex: 1 },
  timelineTitle: { color: colors.navyDeep, fontSize: 11, lineHeight: 15, fontWeight: '900' },
  timelineDetail: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  timelineDate: { color: '#96A1A0', fontSize: 8, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 12 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 7 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },
  historyButton: { minHeight: 42, borderRadius: 14, backgroundColor: '#F1ECE4', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  historyButtonText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
});
