import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type GrowthCategory = 'school' | 'football' | 'chess' | 'english' | 'leadership';

type GrowthEntry = {
  id: string;
  user_id: string;
  category: GrowthCategory;
  entry_type: string;
  activity_date: string;
  title: string | null;
  note: string | null;
  metrics: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

type ModuleConfig = {
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
  strong: string;
  deep: string;
  gradient: readonly [string, string];
  entryLabels: Record<string, string>;
};

const configs: Record<GrowthCategory, ModuleConfig> = {
  school: {
    icon: '✎', title: 'Школа', subtitle: 'Цели, подготовка, усилия и выводы — не просто оценки.', accent: '#DCE7F6', strong: '#477FA3', deep: '#27465F', gradient: ['#3D7195', '#294B67'],
    entryLabels: { goal: 'Цель', study: 'Подготовка', result: 'Результат', reflection: 'Вывод' },
  },
  football: {
    icon: '⚽', title: 'Футбол', subtitle: 'Тренировки, матчи, командность и то, что хочется улучшить.', accent: '#DCEFE4', strong: '#4F8D70', deep: '#2C5942', gradient: ['#4C8D6F', '#2E6651'],
    entryLabels: { training: 'Тренировка', match: 'Матч', teamwork: 'Командная работа', tactics: 'Понимание игры' },
  },
  chess: {
    icon: '♞', title: 'Шахматы', subtitle: 'Партии, разбор ошибок, тактика и решения под давлением.', accent: '#E7E2F6', strong: '#7167A8', deep: '#4C456B', gradient: ['#7167A8', '#4B456E'],
    entryLabels: { game: 'Партия', analysis: 'Разбор', puzzle: 'Задачи', tournament: 'Турнир' },
  },
  english: {
    icon: 'EN', title: 'English', subtitle: 'Главное — говорить, понимать и замечать рост уверенности.', accent: '#FFF0CF', strong: '#D89A2B', deep: '#74511B', gradient: ['#D89A2B', '#A9701D'],
    entryLabels: { speaking: 'Разговор', lesson: 'Занятие', vocabulary: 'Новые слова', real_life: 'English в жизни' },
  },
  leadership: {
    icon: '⌁', title: 'Лидерство', subtitle: 'Инициатива, решения, ответственность и отношение к другим.', accent: '#F7DDD5', strong: '#C76D5A', deep: '#70443A', gradient: ['#C76D5A', '#8F4A3E'],
    entryLabels: { initiative: 'Инициатива', decision: 'Решение', teamwork: 'Команда', reflection: 'Вывод' },
  },
};

const isCategory = (value: unknown): value is GrowthCategory => (
  value === 'school' || value === 'football' || value === 'chess' || value === 'english' || value === 'leadership'
);

const metricLabels: Record<string, string> = {
  duration_min: 'время', effort: 'усилие', confidence: 'уверенность', goals: 'голы', assists: 'передачи', speaking_min: 'речь', new_words: 'новые слова', moves: 'ходы', result: 'результат', impact: 'влияние',
};

const metricValue = (key: string, value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (key === 'duration_min' || key === 'speaking_min') return `${value} мин`;
  if (key === 'confidence' || key === 'effort' || key === 'impact') return `${value}/5`;
  if (key === 'result') {
    if (value === 'win') return 'победа';
    if (value === 'draw') return 'ничья';
    if (value === 'loss') return 'поражение';
  }
  return String(value);
};

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
});

export default function GrowthJournalScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { family, members, me } = useFamily();
  const category: GrowthCategory = isCategory(params.category) ? params.category : 'football';
  const config = configs[category];
  const target = useMemo(() => members.find((member) => member.role === 'child') ?? me ?? null, [members, me]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !family || !target) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('growth_entries')
      .select('id,user_id,category,entry_type,activity_date,title,note,metrics,created_by,created_at')
      .eq('family_id', family.id)
      .eq('user_id', target.user_id)
      .eq('category', category)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80);

    if (!error) setEntries((data ?? []) as GrowthEntry[]);
    setLoading(false);
  }, [family, target, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const recent30 = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 29);
    threshold.setHours(0, 0, 0, 0);
    return entries.filter((entry) => new Date(`${entry.activity_date}T00:00:00`) >= threshold).length;
  }, [entries]);

  const totalMinutes = useMemo(() => entries.reduce((sum, entry) => {
    const value = entry.metrics?.duration_min;
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0), [entries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={config.strong} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={[styles.backButton, shadows.soft]}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topText}><Text style={styles.topKicker}>ЖУРНАЛ РОСТА</Text><Text style={styles.topTitle}>{config.title}</Text></View>
          <View style={[styles.topIcon, { backgroundColor: config.accent }]}><Text style={[styles.topIconText, { color: config.deep }]}>{config.icon}</Text></View>
        </View>

        <LinearGradient colors={config.gradient} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} />
          <View style={styles.heroOrbit} />
          <Text style={styles.heroKicker}>{target?.display_name ?? 'Артур'} · {config.title.toUpperCase()}</Text>
          <Text style={styles.heroTitle}>{config.subtitle}</Text>
          <View style={styles.heroNumbers}>
            <View style={styles.heroNumber}><Text style={styles.heroNumberValue}>{entries.length}</Text><Text style={styles.heroNumberLabel}>всего моментов</Text></View>
            <View style={styles.heroDivider} />
            <View style={styles.heroNumber}><Text style={styles.heroNumberValue}>{recent30}</Text><Text style={styles.heroNumberLabel}>за 30 дней</Text></View>
            {totalMinutes > 0 ? <><View style={styles.heroDivider} /><View style={styles.heroNumber}><Text style={styles.heroNumberValue}>{totalMinutes}</Text><Text style={styles.heroNumberLabel}>минут</Text></View></> : null}
          </View>
        </LinearGradient>

        <Pressable style={[styles.addCard, { backgroundColor: config.accent }, shadows.soft]} onPress={() => router.push({ pathname: '/growth-entry-new', params: { category } })}>
          <View style={[styles.addIcon, { backgroundColor: config.strong }]}><Text style={styles.addIconText}>＋</Text></View>
          <View style={styles.addCopy}><Text style={[styles.addTitle, { color: config.deep }]}>Сохранить новый момент</Text><Text style={[styles.addText, { color: config.deep }]}>Тренировка, вывод, победа, ошибка или то, что просто хочется запомнить.</Text></View>
          <Text style={[styles.addArrow, { color: config.strong }]}>↗</Text>
        </Pressable>

        <View style={styles.sectionHead}>
          <View><Text style={styles.sectionKicker}>ЛЕТОПИСЬ НАПРАВЛЕНИЯ</Text><Text style={styles.sectionTitle}>Что происходило</Text></View>
          <View style={[styles.sectionBadge, { backgroundColor: config.accent }]}><Text style={[styles.sectionBadgeText, { color: config.deep }]}>{entries.length}</Text></View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={config.strong} style={styles.loader} />
        ) : entries.length ? (
          <View style={styles.timeline}>
            {entries.map((entry, index) => {
              const metrics = Object.entries(entry.metrics ?? {})
                .map(([key, value]) => ({ key, label: metricLabels[key] ?? key, value: metricValue(key, value) }))
                .filter((item) => item.value !== null)
                .slice(0, 5);
              return (
                <View key={entry.id} style={styles.timelineRow}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: config.strong }]}><Text style={styles.dotText}>{index + 1}</Text></View>
                    {index < entries.length - 1 ? <View style={[styles.line, { backgroundColor: config.accent }]} /> : null}
                  </View>
                  <View style={[styles.card, shadows.soft]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardText}>
                        <View style={[styles.typePill, { backgroundColor: config.accent }]}><Text style={[styles.entryType, { color: config.deep }]}>{config.entryLabels[entry.entry_type] ?? entry.entry_type}</Text></View>
                        <Text style={styles.entryTitle}>{entry.title || 'Без заголовка'}</Text>
                      </View>
                      <Text style={styles.date}>{formatDate(entry.activity_date)}</Text>
                    </View>
                    {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
                    {metrics.length ? (
                      <View style={styles.metrics}>
                        {metrics.map((metric) => (
                          <View key={metric.key} style={[styles.metricChip, { borderColor: config.accent }]}>
                            <Text style={styles.metricLabel}>{metric.label}</Text>
                            <Text style={[styles.metricValue, { color: config.deep }]}>{metric.value}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text style={styles.author}>сохранил · {names.get(entry.created_by) ?? 'участник команды'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.empty, { backgroundColor: config.accent }, shadows.soft]}>
            <View style={[styles.emptyIconBox, { backgroundColor: config.strong }]}><Text style={styles.emptyIcon}>{config.icon}</Text></View>
            <Text style={[styles.emptyTitle, { color: config.deep }]}>Первая запись ещё впереди</Text>
            <Text style={[styles.emptyText, { color: config.deep }]}>Сохраняйте не только успехи. Сложный матч, непонятная тема или неудачная партия тоже становятся частью роста.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  topText: { flex: 1 }, topKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, topTitle: { color: colors.navyDeep, fontSize: 25, fontWeight: '900', marginTop: 1 },
  topIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, topIconText: { fontSize: 18, fontWeight: '900' },
  hero: { minHeight: 270, borderRadius: radius.xl, padding: 20, overflow: 'hidden' }, heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -58, top: -70, backgroundColor: 'rgba(255,255,255,0.10)' }, heroOrbit: { position: 'absolute', width: 190, height: 82, borderRadius: 100, right: -20, top: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.13)', transform: [{ rotate: '-18deg' }] }, heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, heroTitle: { color: colors.white, fontSize: 24, lineHeight: 29, fontWeight: '900', maxWidth: '82%', marginTop: 10 }, heroNumbers: { minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, paddingHorizontal: 8, marginTop: 'auto' }, heroNumber: { flex: 1, alignItems: 'center' }, heroNumberValue: { color: colors.white, fontSize: 20, fontWeight: '900' }, heroNumberLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '800', marginTop: 2 }, heroDivider: { width: 1, height: 31, backgroundColor: 'rgba(255,255,255,0.16)' },
  addCard: { minHeight: 105, borderRadius: radius.xl, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }, addIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, addIconText: { color: colors.white, fontSize: 24, fontWeight: '500' }, addCopy: { flex: 1 }, addTitle: { fontSize: 15, fontWeight: '900' }, addText: { fontSize: 9, lineHeight: 14, opacity: 0.72, marginTop: 3 }, addArrow: { fontSize: 20, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 3 }, sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.05 }, sectionTitle: { color: colors.navyDeep, fontSize: 22, fontWeight: '900', marginTop: 3 }, sectionBadge: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, sectionBadgeText: { fontSize: 11, fontWeight: '900' },
  loader: { marginVertical: 38 }, timeline: { gap: 0 }, timelineRow: { flexDirection: 'row' }, rail: { width: 35, alignItems: 'center' }, dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, dotText: { color: colors.white, fontSize: 8, fontWeight: '900' }, line: { width: 2, flex: 1, marginVertical: 4 }, card: { flex: 1, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 15, gap: 10, marginBottom: 12 }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, cardText: { flex: 1 }, typePill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 }, entryType: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, entryTitle: { color: colors.navyDeep, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 7 }, date: { color: colors.muted, fontSize: 8, fontWeight: '800', maxWidth: 74, textAlign: 'right' }, note: { color: colors.muted, fontSize: 11, lineHeight: 17 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, metricChip: { backgroundColor: colors.white, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', gap: 4 }, metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' }, metricValue: { fontSize: 8, fontWeight: '900' }, author: { color: colors.muted, fontSize: 8, fontWeight: '700', marginTop: 1 },
  empty: { borderRadius: radius.xl, padding: 25, alignItems: 'center' }, emptyIconBox: { width: 64, height: 64, borderRadius: 23, alignItems: 'center', justifyContent: 'center' }, emptyIcon: { color: colors.white, fontSize: 25, fontWeight: '900' }, emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 14 }, emptyText: { fontSize: 10, lineHeight: 16, textAlign: 'center', opacity: 0.72, marginTop: 5, maxWidth: '88%' },
});