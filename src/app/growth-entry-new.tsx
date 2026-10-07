import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  type ImageSourcePropType,
  Text,
  TextInput,
  View
} from 'react-native';
import { brandAssets } from '../brandAssets';
import { Button, Card, Chip, Heading, Page, Section, ui } from '../components/Everyday';
import { useFamily } from '../context/FamilyContext';
import { createGrowthEntry, type GrowthCategory } from '../data/growthRepository';
import { localDay } from '../domain/presentation';
import { supabase } from '../lib/supabase';

type EntryOption = { id: string; label: string };
type NumberField = { key: string; label: string; placeholder: string; min: number; max: number; suffix?: string };
type ChoiceField = { key: string; label: string; options: Array<{ id: string; label: string }> };

type FormConfig = {
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  titlePlaceholder: string;
  notePlaceholder: string;
  accent: string;
  strong: string;
  deep: string;
  gradient: readonly [string, string];
  entries: EntryOption[];
  numbers: NumberField[];
  choices: ChoiceField[];
};

const configs: Record<GrowthCategory, FormConfig> = {
  school: {
    image: brandAssets.directions.school, title: 'Школа', subtitle: 'Сохраняем не только результат, но и то, как Артур к нему пришёл.', titlePlaceholder: 'Например: подготовка к контрольной по математике', notePlaceholder: 'Что было сложным? Что помогло? Что в следующий раз сделать иначе?', accent: '#DCE7F6', strong: '#477FA3', deep: '#27465F', gradient: ['#3D7195', '#294B67'],
    entries: [{ id: 'goal', label: 'Цель' }, { id: 'study', label: 'Подготовка' }, { id: 'result', label: 'Результат' }, { id: 'reflection', label: 'Вывод' }],
    numbers: [{ key: 'duration_min', label: 'Время', placeholder: '30', min: 0, max: 600, suffix: 'мин' }],
    choices: [{ key: 'effort', label: 'Сколько усилий потребовалось?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  football: {
    image: brandAssets.directions.football, title: 'Футбол', subtitle: 'Не рейтинг игрока, а личный разбор игры и командности.', titlePlaceholder: 'Например: вечерняя тренировка или матч с командой', notePlaceholder: 'Что получилось лучше всего? Что было трудно? Что хочется попробовать на следующей тренировке?', accent: '#DCEFE4', strong: '#4F8D70', deep: '#2C5942', gradient: ['#4C8D6F', '#2E6651'],
    entries: [{ id: 'training', label: 'Тренировка' }, { id: 'match', label: 'Матч' }, { id: 'teamwork', label: 'Команда' }, { id: 'tactics', label: 'Тактика' }],
    numbers: [{ key: 'duration_min', label: 'Время на поле', placeholder: '60', min: 0, max: 300, suffix: 'мин' }, { key: 'goals', label: 'Голы', placeholder: '0', min: 0, max: 30 }, { key: 'assists', label: 'Голевые передачи', placeholder: '0', min: 0, max: 30 }],
    choices: [{ key: 'confidence', label: 'Как ощущалась игра?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  chess: {
    image: brandAssets.directions.chess, title: 'Шахматы', subtitle: 'Победы важны, но ещё важнее научиться видеть свои решения.', titlePlaceholder: 'Например: партия с папой или турнирная партия', notePlaceholder: 'Где был самый важный момент? Какой ход хочется разобрать? Что понял после партии?', accent: '#E7E2F6', strong: '#7167A8', deep: '#4C456B', gradient: ['#7167A8', '#4B456E'],
    entries: [{ id: 'game', label: 'Партия' }, { id: 'analysis', label: 'Разбор' }, { id: 'puzzle', label: 'Задачи' }, { id: 'tournament', label: 'Турнир' }],
    numbers: [{ key: 'moves', label: 'Количество ходов', placeholder: '40', min: 0, max: 500 }, { key: 'duration_min', label: 'Время', placeholder: '45', min: 0, max: 600, suffix: 'мин' }],
    choices: [{ key: 'result', label: 'Результат партии', options: [{ id: 'win', label: 'Победа' }, { id: 'draw', label: 'Ничья' }, { id: 'loss', label: 'Поражение' }] }],
  },
  english: {
    image: brandAssets.directions.english, title: 'English', subtitle: 'Следим не за идеальностью, а за тем, насколько свободнее становится речь.', titlePlaceholder: 'Например: 5 минут разговора без русского', notePlaceholder: 'Какие фразы получилось использовать? Что было трудно сказать? Что запомнилось?', accent: '#FFF0CF', strong: '#D89A2B', deep: '#74511B', gradient: ['#D89A2B', '#A9701D'],
    entries: [{ id: 'speaking', label: 'Разговор' }, { id: 'lesson', label: 'Занятие' }, { id: 'vocabulary', label: 'Слова' }, { id: 'real_life', label: 'В жизни' }],
    numbers: [{ key: 'duration_min', label: 'Общее время', placeholder: '20', min: 0, max: 600, suffix: 'мин' }, { key: 'speaking_min', label: 'Говорил вслух', placeholder: '5', min: 0, max: 300, suffix: 'мин' }, { key: 'new_words', label: 'Новых слов/фраз', placeholder: '3', min: 0, max: 200 }],
    choices: [{ key: 'confidence', label: 'Насколько уверенно говорил?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  leadership: {
    image: brandAssets.directions.leadership, title: 'Лидерство', subtitle: 'Не «быть главным», а замечать инициативу, ответственность и влияние на команду.', titlePlaceholder: 'Например: сам предложил решение в команде', notePlaceholder: 'Что произошло? Какое решение принял? Как это повлияло на других? Что понял?', accent: '#F7DDD5', strong: '#C76D5A', deep: '#70443A', gradient: ['#C76D5A', '#8F4A3E'],
    entries: [{ id: 'initiative', label: 'Инициатива' }, { id: 'decision', label: 'Решение' }, { id: 'teamwork', label: 'Команда' }, { id: 'reflection', label: 'Вывод' }],
    numbers: [],
    choices: [{ key: 'impact', label: 'Насколько это повлияло на ситуацию?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
};

const isCategory = (value: unknown): value is GrowthCategory => (
  value === 'school' || value === 'football' || value === 'chess' || value === 'english' || value === 'leadership'
);

export default function GrowthEntryNewScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category: GrowthCategory = isCategory(params.category) ? params.category : 'football';
  const config = configs[category];
  const { family, members, me } = useFamily();
  const target = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members, me]);
  const [entryType, setEntryType] = useState(config.entries[0]?.id ?? 'reflection');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const setNumber = (key: string, value: string) => {
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    setNumbers((current) => ({ ...current, [key]: normalized }));
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || !target || busy) return;
    if (!title.trim() && !note.trim()) {
      Alert.alert('Пока пусто', 'Добавь короткий заголовок или заметку — то, что захочется вспомнить позже.');
      return;
    }

    const metrics: Record<string, string | number> = {};
    for (const field of config.numbers) {
      const raw = numbers[field.key]?.trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        Alert.alert('Проверь значение', `${field.label}: допустимо от ${field.min} до ${field.max}.`);
        return;
      }
      metrics[field.key] = value;
    }
    for (const field of config.choices) {
      const value = choices[field.key];
      if (!value) continue;
      const numeric = Number(value);
      metrics[field.key] = Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(value) ? numeric : value;
    }

    setBusy(true);
    try {
      await createGrowthEntry(client, {
        familyId: family.id,
        userId: target.user_id,
        category,
        entryType,
        activityDate: localDay(),
        title: title.trim() || null,
        note: note.trim() || null,
        metrics,
      });
      Alert.alert('Сохранено', `Запись добавлена в «${config.title}» и в общую историю роста.`);
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return <Page>
    <Heading title="Запись о занятии" subtitle={category === 'english' ? 'Английский' : config.title} back />
    {!target ? <Card><Text style={ui.body}>Для записей о развитии сначала подключите аккаунт сына через раздел «Семья».</Text></Card> : null}
    <Section title="Что сегодня было?"><View style={ui.wrap}>{config.entries.map(option => <Chip key={option.id} label={option.label} selected={entryType === option.id} onPress={() => setEntryType(option.id)} />)}</View></Section>
    <Card>
      <Text style={ui.rowTitle}>Коротко о главном</Text><TextInput accessibilityLabel="Заголовок записи" style={ui.input} value={title} onChangeText={setTitle} placeholder={config.titlePlaceholder} maxLength={120} />
      <Text style={ui.rowTitle}>Что хочется запомнить?</Text><TextInput accessibilityLabel="Заметка о занятии" style={[ui.input, ui.textArea]} value={note} onChangeText={setNote} placeholder={config.notePlaceholder} multiline maxLength={2000} />
      <Text style={ui.caption}>Достаточно заголовка или заметки. Запись увидят папа и сын.</Text>
    </Card>
    <Button label={detailsOpen ? 'Скрыть дополнительные детали' : 'Добавить время, результат или ощущения'} secondary onPress={() => setDetailsOpen(!detailsOpen)} />
    {detailsOpen ? <Card>
      <Text style={ui.sectionTitle}>Необязательные детали</Text>
      {config.numbers.map(field => <View key={field.key} style={ui.stack}><Text style={ui.rowTitle}>{field.label}{field.suffix ? ' (' + field.suffix + ')' : ''}</Text><TextInput accessibilityLabel={field.label} style={ui.input} value={numbers[field.key] ?? ''} onChangeText={value => setNumber(field.key, value)} placeholder={field.placeholder} keyboardType="decimal-pad" /></View>)}
      {config.choices.map(field => <View key={field.key} style={ui.stack}><Text style={ui.rowTitle}>{field.label}</Text><View style={ui.wrap}>{field.options.map(option => <Chip key={option.id} label={option.label} selected={choices[field.key] === option.id} onPress={() => setChoices(current => ({ ...current, [field.key]: current[field.key] === option.id ? '' : option.id }))} />)}</View>{field.key !== 'result' ? <Text style={ui.caption}>1 — совсем немного, 5 — очень сильно</Text> : null}</View>)}
    </Card> : null}
    <Button label="Сохранить запись" busy={busy} disabled={!target} onPress={() => void save()} />
  </Page>;
}
