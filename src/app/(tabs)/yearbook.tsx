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
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, gradients, radius, shadows } from '../../theme';

type GrowthEntry = {
  id: string;
  category: string;
  activity_date: string;
  title: string | null;
  note: string | null;
};

type Mission = {
  id: string;
  category: string;
  title: string;
  completed_at: string | null;
};

type Award = {
  id: string;
  definition_id: string;
  awarded_at: string;
};

type AwardDefinition = {
  id: string;
  title: string;
  category: string;
};

type ActivityEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  payload: unknown;
};

type ChapterItem = {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  date: string;
  kind: 'growth' | 'mission' | 'award' | 'together';
};

type CategoryMeta = {
  title: string;
  icon: string;
  accent: string;
  strong: string;
  text: string;
};

const chapterAges = [11, 12, 13, 14, 15, 16, 17] as const;

const categoryMeta: Record<string, CategoryMeta> = {
  school: { title: 'Школа', icon: '✎', accent: '#DCE7F6', strong: '#477FA3', text: '#27465F' },
  football: { title: 'Футбол', icon: '⚽', accent: '#DCEFE4', strong: '#4F8D70', text: '#2C5942' },
  chess: { title: 'Шахматы', icon: '♞', accent: '#E7E2F6', strong: '#7167A8', text: '#4C456B' },
  english: { title: 'English', icon: 'EN', accent: '#FFF0CF', strong: '#D89A2B', text: '#74511B' },
  leadership: { title: 'Лидерство', icon: '⌁', accent: '#F7DDD5', strong: '#C76D5A', text: '#70443A' },
  together: { title: 'Папа & Я', icon: '♥', accent: '#F3E2DF', strong: '#C76D5A', text: '#70443A' },
};

const payloadRecord = (payload: unknown): Record<string, unknown> => (
  payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
);

const payloadText = (payload: unknown, key: string) => {
  const value = payloadRecord(payload)[key];
  return typeof value === 'string' ? value : null;
};

const addYears = (date: Date, years: number) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 11;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 11;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(11, Math.min(17, age));
};

const chapterRange = (birthDate: string | null, age: number) => {
  if (!birthDate) {
    const year = new Date().getFullYear();
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

const prettyDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value)
  .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const eventTitle = (event: ActivityEvent) => {
  const title = payloadText(event.payload, 'title');
  const preview = payloadText(event.payload, 'preview');
  const message = payloadText(event.payload, 'message');
  if (event.event_type === 'voice_story_added') return { title: title || 'Голосовая история', detail: preview };
  if (event.event_type === 'reflection_added') return { title: title || 'Сохранили важный момент', detail: preview };
  if (event.event_type === 'five_minutes_ping') return { title: 'Нашли пять минут друг для друга', detail: null };
  if (event.event_type === 'advice_requested') return { title: 'Попросили совета', detail: message };
  if (event.event_type === 'connection_response') return { title: 'Ответили друг другу', detail: null };
  return { title: 'Момент Папа & Я', detail: preview || message };
};

export default function YearBookScreen() {
  const { family, members } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? members[0] ?? null, [members]);
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

    setLoading(true);
    const [growthResult, missionsResult, awardsResult, definitionsResult, eventsResult] = await Promise.all([
      supabase.from('growth_entries').select('id,category,activity_date,title,note').eq('family_id', family.id).eq('user_id', child.user_id).order('activity_date', { ascending: false }).limit(700),
      supabase.from('missions').select('id,category,title,completed_at').eq('family_id', family.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(300),
      supabase.from('achievement_awards').select('id,definition_id,awarded_at').eq('family_id', family.id).eq('recipient_user_id', child.user_id).order('awarded_at', { ascending: false }).limit(200),
      supabase.from('achievement_definitions').select('id,title,category'),
      supabase.from('activity_events').select('id,event_type,occurred_at,payload').eq('family_id', family.id).in('event_type', ['voice_story_added', 'reflection_added', 'five_minutes_ping', 'advice_requested', 'connection_response']).order('occurred_at', { ascending: false }).limit(400),
    ]);

    const error = growthResult.error ?? missionsResult.error ?? awardsResult.error ?? definitionsResult.error ?? eventsResult.error;
    if (error) {
      Alert.alert('Не удалось собрать книгу года', error.message);
    } else {
      setGrowthEntries((growthResult.data ?? []) as GrowthEntry[]);
      setMissions((missionsResult.data ?? []) as Mission[]);
      setAwards((awardsResult.data ?? []) as Award[]);
      setDefinitions((definitionsResult.data ?? []) as AwardDefinition[]);
      setEvents((eventsResult.data ?? []) as ActivityEvent[]);
    }
    setLoading(false);
  }, [family, child]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const { start, end } = useMemo(
    () => chapterRange(child?.birth_date ?? null, selectedAge),
    [child?.birth_date, selectedAge],
  );

  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );

  const chapterItems = useMemo<ChapterItem[]>(() => {
    const items: ChapterItem[] = [];

    for (const entry of growthEntries) {
      if (!inRange(entry.activity_date, start, end)) continue;
      items.push({ id: `growth-${entry.id}`, category: entry.category, title: entry.title || 'Сохранённый момент', detail: entry.note, date: entry.activity_date, kind: 'growth' });
    }

    for (const mission of missions) {
      if (!inRange(mission.completed_at, start, end) || !mission.completed_at) continue;
      items.push({ id: `mission-${mission.id}`, category: mission.category, title: `Миссия: ${mission.title}`, detail: null, date: mission.completed_at, kind: 'mission' });
    }

    for (const award of awards) {
      if (!inRange(award.awarded_at, start, end)) continue;
      const definition = definitionsById.get(award.definition_id);
      if (!definition) continue;
      items.push({ id: `award-${award.id}`, category: definition.category || 'leadership', title: `Веха: ${definition.title}`, detail: null, date: award.awarded_at, kind: 'award' });
    }

    for (const event of events) {
      if (!inRange(event.occurred_at, start, end)) continue;
      const copy = eventTitle(event);
      items.push({ id: `event-${event.id}`, category: 'together', title: copy.title, detail: copy.detail, date: event.occurred_at, kind: 'together' });
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [growthEntries, missions, awards, events, definitionsById, start, end]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of chapterItems) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, [chapterItems]);

  const awardCount = useMemo(() => chapterItems.filter((item) => item.kind === 'award').length, [chapterItems]);
  const missionCount = useMemo(() => chapterItems.filter((item) => item.kind === 'mission').length, [chapterItems]);
  const startLabel = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  const endDisplay = new Date(end); endDisplay.setDate(endDisplay.getDate() - 1);
  const endLabel = endDisplay.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} />
          <Text style={styles.kicker}>КНИГА ГОДА · ПАПА & Я</Text>
          <Text style={styles.heroTitle}>{child?.display_name ?? 'Артур'} в {selectedAge} лет</Text>
          <Text style={styles.heroText}>Глава собирается из реальных моментов, а не из процентов: чему научился, где проявил характер и что вы прожили вместе.</Text>
          <Text style={styles.period}>{startLabel} — {endLabel}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{chapterItems.length}</Text><Text style={styles.statLabel}>моментов</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>{missionCount}</Text><Text style={styles.statLabel}>миссий</Text></View>
            <View style={styles.divider} />
            <View style={styles.stat}><Text style={styles.statValue}>{awardCount}</Text><Text style={styles.statLabel}>вех</Text></View>
          </View>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageRail}>
          {chapterAges.map((age) => {
            const active = age === selectedAge;
            return (
              <Pressable key={age} onPress={() => setSelectedAge(age)} style={[styles.ageChip, active && styles.ageChipActive]}>
                <Text style={[styles.ageText, active && styles.ageTextActive]}>{age} лет</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? <ActivityIndicator size="large" color={colors.navy} style={styles.loader} /> : (
          <>
            <View style={styles.sectionHead}>
              <View><Text style={styles.sectionKicker}>ШЕСТЬ ЛИНИЙ ГЛАВЫ</Text><Text style={styles.sectionTitle}>Чем запомнился год</Text></View>
            </View>

            <View style={styles.categoryGrid}>
              {Object.entries(categoryMeta).map(([id, meta]) => (
                <View key={id} style={[styles.categoryCard, { backgroundColor: meta.accent }, shadows.soft]}>
                  <View style={[styles.categoryIcon, { backgroundColor: meta.strong }]}><Text style={styles.categoryIconText}>{meta.icon}</Text></View>
                  <Text style={[styles.categoryTitle, { color: meta.text }]}>{meta.title}</Text>
                  <Text style={[styles.categoryCount, { color: meta.text }]}>{categoryCounts.get(id) ?? 0} моментов</Text>
                </View>
              ))}
            </View>

            <View style={styles.sectionHead}>
              <View><Text style={styles.sectionKicker}>ХРОНОЛОГИЯ</Text><Text style={styles.sectionTitle}>История этого возраста</Text></View>
              <Text style={styles.sectionCount}>{chapterItems.length}</Text>
            </View>

            {chapterItems.length ? (
              <View style={styles.timeline}>
                {chapterItems.slice(0, 80).map((item, index) => {
                  const meta = categoryMeta[item.category] ?? categoryMeta.together;
                  return (
                    <View key={item.id} style={styles.timelineRow}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, { backgroundColor: meta.strong }]} />
                        {index < Math.min(chapterItems.length, 80) - 1 ? <View style={styles.line} /> : null}
                      </View>
                      <View style={[styles.itemCard, shadows.soft]}>
                        <View style={styles.itemTop}>
                          <View style={[styles.itemPill, { backgroundColor: meta.accent }]}><Text style={[styles.itemPillText, { color: meta.text }]}>{meta.title}</Text></View>
                          <Text style={styles.itemDate}>{prettyDate(item.date)}</Text>
                        </View>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyCard, shadows.soft]}>
                <Text style={styles.emptyIcon}>✦</Text>
                <Text style={styles.emptyTitle}>Эта глава пока пустая</Text>
                <Text style={styles.emptyText}>Как только появятся записи роста, выполненные миссии, достижения или ваши общие истории, они автоматически соберутся здесь.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 38, gap: 18 },
  hero: { minHeight: 330, borderRadius: radius.xl, padding: 22, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,210,94,0.11)', right: -90, top: -85 },
  kicker: { color: '#BBD1D2', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: colors.white, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  heroText: { color: '#D5E3E3', fontSize: 11, lineHeight: 17, marginTop: 12, maxWidth: '88%' },
  period: { color: colors.sun, fontSize: 10, fontWeight: '900', marginTop: 14 },
  stats: { minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, marginTop: 22, paddingHorizontal: 10 },
  stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.white, fontSize: 20, fontWeight: '900' }, statLabel: { color: '#BFD0D1', fontSize: 8, fontWeight: '800', marginTop: 2 }, divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },
  ageRail: { gap: 8, paddingHorizontal: 2 },
  ageChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 15, paddingVertical: 10 },
  ageChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  ageText: { color: colors.muted, fontSize: 10, fontWeight: '900' }, ageTextActive: { color: colors.white },
  loader: { marginTop: 40 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 3, marginTop: 2 },
  sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 },
  sectionCount: { color: colors.muted, fontSize: 11, fontWeight: '900', paddingBottom: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '48.4%', minHeight: 132, borderRadius: radius.xl, padding: 15 },
  categoryIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  categoryTitle: { fontSize: 16, fontWeight: '900', marginTop: 12 },
  categoryCount: { fontSize: 9, fontWeight: '800', marginTop: 4, opacity: 0.8 },
  timeline: { gap: 0 }, timelineRow: { flexDirection: 'row' }, rail: { width: 26, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 18 }, line: { width: 1, flex: 1, minHeight: 72, backgroundColor: colors.line },
  itemCard: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.lg, padding: 14, marginBottom: 10 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  itemPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 }, itemPillText: { fontSize: 8, fontWeight: '900' },
  itemDate: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  itemTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 9 },
  itemDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 24, alignItems: 'center' },
  emptyIcon: { color: colors.orange, fontSize: 24, fontWeight: '900' }, emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 8 }, emptyText: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 7 },
});
