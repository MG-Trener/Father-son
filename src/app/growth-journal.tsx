import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  type ImageSourcePropType,
  Text
} from 'react-native';
import { ActionRow, Button, Card, Heading, LoadError, Page, Section, ui } from '../components/Everyday';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';

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
  image: ImageSourcePropType;
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
    image: require('../../assets/generated/direction-school.png'), title: 'Школа', subtitle: 'Цели, подготовка, усилия и выводы — не просто оценки.', accent: '#DCE7F6', strong: '#477FA3', deep: '#27465F', gradient: ['#3D7195', '#294B67'],
    entryLabels: { goal: 'Цель', study: 'Подготовка', result: 'Результат', reflection: 'Вывод' },
  },
  football: {
    image: require('../../assets/generated/direction-football.png'), title: 'Футбол', subtitle: 'Тренировки, матчи, командность и то, что хочется улучшить.', accent: '#DCEFE4', strong: '#4F8D70', deep: '#2C5942', gradient: ['#4C8D6F', '#2E6651'],
    entryLabels: { training: 'Тренировка', match: 'Матч', teamwork: 'Командная работа', tactics: 'Понимание игры' },
  },
  chess: {
    image: require('../../assets/generated/direction-chess.png'), title: 'Шахматы', subtitle: 'Партии, разбор ошибок, тактика и решения под давлением.', accent: '#E7E2F6', strong: '#7167A8', deep: '#4C456B', gradient: ['#7167A8', '#4B456E'],
    entryLabels: { game: 'Партия', analysis: 'Разбор', puzzle: 'Задачи', tournament: 'Турнир' },
  },
  english: {
    image: require('../../assets/generated/direction-english.png'), title: 'English', subtitle: 'Главное — говорить, понимать и замечать рост уверенности.', accent: '#FFF0CF', strong: '#D89A2B', deep: '#74511B', gradient: ['#D89A2B', '#A9701D'],
    entryLabels: { speaking: 'Разговор', lesson: 'Занятие', vocabulary: 'Новые слова', real_life: 'English в жизни' },
  },
  leadership: {
    image: require('../../assets/generated/direction-leadership.png'), title: 'Лидерство', subtitle: 'Инициатива, решения, ответственность и отношение к другим.', accent: '#F7DDD5', strong: '#C76D5A', deep: '#70443A', gradient: ['#C76D5A', '#8F4A3E'],
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
  const target = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members, me]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entries, setEntries] = useState<GrowthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !family || !target) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('growth_entries')
        .select('id,user_id,category,entry_type,activity_date,title,note,metrics,created_by,created_at')
        .eq('family_id', family.id)
        .eq('user_id', target.user_id)
        .eq('category', category)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;
      setEntries((data ?? []) as GrowthEntry[]);
    } catch { setLoadError('Не удалось обновить записи. Проверьте интернет.'); }
    finally { setLoading(false); }
  }, [family, target, category]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return <Page refreshing={loading || refreshing} onRefresh={onRefresh}>
    <Heading title={category === 'english' ? 'Английский' : config.title} subtitle={config.subtitle} back />
    {category === 'chess' ? <ActionRow title="Сыграть друг с другом" description="Общая доска без счёта побед" to="/chess" /> : null}
    {category === 'school' ? <ActionRow title="Школьное расписание" description="Уроки, время и кабинеты" to="/school-schedule" /> : null}
    {loadError ? <LoadError message={loadError} retry={() => void load()} /> : null}
    <Button label="Добавить запись о занятии" onPress={() => router.push({ pathname: '/growth-entry-new', params: { category } })} />
    <Section title="Последние записи">
      {!loading && !loadError && !entries.length ? <Card><Text style={ui.rowTitle}>Здесь появятся первые шаги</Text><Text style={ui.body}>Расскажи, что получилось, что было трудно или что хочется попробовать в следующий раз.</Text></Card> : null}
      {entries.map(entry => <Card key={entry.id}>
        <Text style={ui.caption}>{formatDate(entry.activity_date)} · {config.entryLabels[entry.entry_type] ?? entry.entry_type}</Text>
        <Text style={ui.rowTitle}>{entry.title || 'Заметка о занятии'}</Text>
        {entry.note ? <Text style={ui.body}>{entry.note}</Text> : null}
        {Object.entries(entry.metrics ?? {}).map(([key, value]) => metricValue(key, value) === null ? null : <Text key={key} style={ui.body}>{metricLabels[key] ?? key}: {metricValue(key, value)}</Text>)}
        <Text style={ui.caption}>Сохранил: {names.get(entry.created_by) ?? 'участник семьи'}</Text>
      </Card>)}
    </Section>
  </Page>;
}
