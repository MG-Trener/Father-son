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
import { router, useLocalSearchParams } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

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
  entryLabels: Record<string, string>;
};

const configs: Record<GrowthCategory, ModuleConfig> = {
  school: {
    icon: '📚',
    title: 'Школа',
    subtitle: 'Цели, подготовка, усилия и выводы — не просто оценки.',
    accent: '#DCE7F6',
    entryLabels: { goal: 'Цель', study: 'Подготовка', result: 'Результат', reflection: 'Вывод' },
  },
  football: {
    icon: '⚽',
    title: 'Футбол',
    subtitle: 'Тренировки, матчи, командность и то, что хочется улучшить.',
    accent: '#DCECE3',
    entryLabels: { training: 'Тренировка', match: 'Матч', teamwork: 'Командная работа', tactics: 'Понимание игры' },
  },
  chess: {
    icon: '♟',
    title: 'Шахматы',
    subtitle: 'Партии, разбор ошибок, тактика и решения под давлением.',
    accent: '#E5E0F2',
    entryLabels: { game: 'Партия', analysis: 'Разбор', puzzle: 'Задачи', tournament: 'Турнир' },
  },
  english: {
    icon: 'EN',
    title: 'English',
    subtitle: 'Главное — говорить, понимать и замечать рост уверенности.',
    accent: '#FFF0CF',
    entryLabels: { speaking: 'Разговор', lesson: 'Занятие', vocabulary: 'Новые слова', real_life: 'English в жизни' },
  },
  leadership: {
    icon: '🧭',
    title: 'Лидерство',
    subtitle: 'Инициатива, решения, ответственность и отношение к другим.',
    accent: '#F5DED7',
    entryLabels: { initiative: 'Инициатива', decision: 'Решение', teamwork: 'Команда', reflection: 'Вывод' },
  },
};

const isCategory = (value: unknown): value is GrowthCategory => (
  value === 'school' || value === 'football' || value === 'chess' || value === 'english' || value === 'leadership'
);

const metricLabels: Record<string, string> = {
  duration_min: 'время',
  effort: 'усилие',
  confidence: 'уверенность',
  goals: 'голы',
  assists: 'передачи',
  speaking_min: 'речь',
  new_words: 'новые слова',
  moves: 'ходы',
  result: 'результат',
  impact: 'влияние',
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
  day: 'numeric',
  month: 'long',
  year: 'numeric',
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{config.icon} {config.title}</Text>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          </View>
        </View>

        <View style={[styles.hero, { backgroundColor: config.accent }]}>
          <View>
            <Text style={styles.heroKicker}>{target?.display_name ?? 'Артур'} · ЖУРНАЛ</Text>
            <Text style={styles.heroValue}>{entries.length}</Text>
            <Text style={styles.heroLabel}>сохранённых моментов</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.statBubble}>
              <Text style={styles.statValue}>{recent30}</Text>
              <Text style={styles.statLabel}>за 30 дней</Text>
            </View>
            {totalMinutes > 0 ? (
              <View style={styles.statBubble}>
                <Text style={styles.statValue}>{totalMinutes}</Text>
                <Text style={styles.statLabel}>минут</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          style={styles.primary}
          onPress={() => router.push({ pathname: '/growth-entry-new', params: { category } })}
        >
          <Text style={styles.primaryText}>+ Добавить запись</Text>
        </Pressable>

        <View>
          <Text style={styles.sectionTitle}>История направления</Text>
          <Text style={styles.sectionSubtitle}>Записи не пропадают при паузах и со временем складываются в реальную картину роста.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : entries.length ? (
          <View style={styles.list}>
            {entries.map((entry) => {
              const metrics = Object.entries(entry.metrics ?? {})
                .map(([key, value]) => ({ key, label: metricLabels[key] ?? key, value: metricValue(key, value) }))
                .filter((item) => item.value !== null)
                .slice(0, 5);
              return (
                <View key={entry.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardText}>
                      <Text style={styles.entryType}>{config.entryLabels[entry.entry_type] ?? entry.entry_type}</Text>
                      <Text style={styles.entryTitle}>{entry.title || 'Без заголовка'}</Text>
                    </View>
                    <Text style={styles.date}>{formatDate(entry.activity_date)}</Text>
                  </View>
                  {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
                  {metrics.length ? (
                    <View style={styles.metrics}>
                      {metrics.map((metric) => (
                        <View key={metric.key} style={styles.metricChip}>
                          <Text style={styles.metricLabel}>{metric.label}</Text>
                          <Text style={styles.metricValue}>{metric.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.author}>записал: {names.get(entry.created_by) ?? 'участник команды'}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{config.icon}</Text>
            <Text style={styles.emptyTitle}>Первая запись ещё впереди</Text>
            <Text style={styles.emptyText}>Сохраняйте не только успехи. Сложный матч, непонятная тема или неудачная партия тоже показывают рост через несколько месяцев.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  hero: { borderRadius: radius.lg, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14 },
  heroKicker: { color: colors.navyDeep, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroValue: { color: colors.navyDeep, fontSize: 36, fontWeight: '900', marginTop: 3 },
  heroLabel: { color: colors.navyDeep, fontSize: 11, fontWeight: '800' },
  heroStats: { flexDirection: 'row', gap: 7 },
  statBubble: { minWidth: 66, backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center' },
  statValue: { color: colors.navyDeep, fontSize: 17, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  primary: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  loader: { marginVertical: 36 },
  list: { gap: 11 },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 15, gap: 9 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardText: { flex: 1 },
  entryType: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  entryTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  date: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metricChip: { backgroundColor: colors.sand, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', gap: 5 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  metricValue: { color: colors.text, fontSize: 10, fontWeight: '900' },
  author: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  empty: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 34, fontWeight: '900', color: colors.navy },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
