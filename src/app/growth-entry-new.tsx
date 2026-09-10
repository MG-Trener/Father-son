import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type GrowthCategory = 'school' | 'football' | 'chess' | 'english' | 'leadership';

type EntryOption = { id: string; label: string };
type NumberField = { key: string; label: string; placeholder: string; min: number; max: number; suffix?: string };
type ChoiceField = { key: string; label: string; options: Array<{ id: string; label: string }> };

type FormConfig = {
  icon: string;
  title: string;
  subtitle: string;
  titlePlaceholder: string;
  notePlaceholder: string;
  entries: EntryOption[];
  numbers: NumberField[];
  choices: ChoiceField[];
};

const configs: Record<GrowthCategory, FormConfig> = {
  school: {
    icon: '📚',
    title: 'Школа',
    subtitle: 'Сохраняем не только результат, но и то, как Артур к нему пришёл.',
    titlePlaceholder: 'Например: подготовка к контрольной по математике',
    notePlaceholder: 'Что было сложным? Что помогло? Что в следующий раз сделать иначе?',
    entries: [
      { id: 'goal', label: 'Цель' },
      { id: 'study', label: 'Подготовка' },
      { id: 'result', label: 'Результат' },
      { id: 'reflection', label: 'Вывод' },
    ],
    numbers: [
      { key: 'duration_min', label: 'Время', placeholder: '30', min: 0, max: 600, suffix: 'мин' },
    ],
    choices: [
      { key: 'effort', label: 'Сколько усилий потребовалось?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) },
    ],
  },
  football: {
    icon: '⚽',
    title: 'Футбол',
    subtitle: 'Не рейтинг игрока, а личный разбор игры и командности.',
    titlePlaceholder: 'Например: вечерняя тренировка или матч с командой',
    notePlaceholder: 'Что получилось лучше всего? Что было трудно? Что хочется попробовать на следующей тренировке?',
    entries: [
      { id: 'training', label: 'Тренировка' },
      { id: 'match', label: 'Матч' },
      { id: 'teamwork', label: 'Команда' },
      { id: 'tactics', label: 'Тактика' },
    ],
    numbers: [
      { key: 'duration_min', label: 'Время на поле', placeholder: '60', min: 0, max: 300, suffix: 'мин' },
      { key: 'goals', label: 'Голы', placeholder: '0', min: 0, max: 30 },
      { key: 'assists', label: 'Голевые передачи', placeholder: '0', min: 0, max: 30 },
    ],
    choices: [
      { key: 'confidence', label: 'Как ощущалась игра?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) },
    ],
  },
  chess: {
    icon: '♟',
    title: 'Шахматы',
    subtitle: 'Победы важны, но ещё важнее научиться видеть свои решения.',
    titlePlaceholder: 'Например: партия с папой или турнирная партия',
    notePlaceholder: 'Где был самый важный момент? Какой ход хочется разобрать? Что понял после партии?',
    entries: [
      { id: 'game', label: 'Партия' },
      { id: 'analysis', label: 'Разбор' },
      { id: 'puzzle', label: 'Задачи' },
      { id: 'tournament', label: 'Турнир' },
    ],
    numbers: [
      { key: 'moves', label: 'Количество ходов', placeholder: '40', min: 0, max: 500 },
      { key: 'duration_min', label: 'Время', placeholder: '45', min: 0, max: 600, suffix: 'мин' },
    ],
    choices: [
      { key: 'result', label: 'Результат партии', options: [
        { id: 'win', label: 'Победа' },
        { id: 'draw', label: 'Ничья' },
        { id: 'loss', label: 'Поражение' },
      ] },
    ],
  },
  english: {
    icon: 'EN',
    title: 'English',
    subtitle: 'Следим не за идеальностью, а за тем, насколько свободнее становится речь.',
    titlePlaceholder: 'Например: 5 минут разговора без русского',
    notePlaceholder: 'Какие фразы получилось использовать? Что было трудно сказать? Что запомнилось?',
    entries: [
      { id: 'speaking', label: 'Разговор' },
      { id: 'lesson', label: 'Занятие' },
      { id: 'vocabulary', label: 'Слова' },
      { id: 'real_life', label: 'В жизни' },
    ],
    numbers: [
      { key: 'duration_min', label: 'Общее время', placeholder: '20', min: 0, max: 600, suffix: 'мин' },
      { key: 'speaking_min', label: 'Говорил вслух', placeholder: '5', min: 0, max: 300, suffix: 'мин' },
      { key: 'new_words', label: 'Новых слов/фраз', placeholder: '3', min: 0, max: 200 },
    ],
    choices: [
      { key: 'confidence', label: 'Насколько уверенно говорил?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) },
    ],
  },
  leadership: {
    icon: '🧭',
    title: 'Лидерство',
    subtitle: 'Не «быть главным», а замечать инициативу, ответственность и влияние на команду.',
    titlePlaceholder: 'Например: сам предложил решение в команде',
    notePlaceholder: 'Что произошло? Какое решение принял? Как это повлияло на других? Что понял?',
    entries: [
      { id: 'initiative', label: 'Инициатива' },
      { id: 'decision', label: 'Решение' },
      { id: 'teamwork', label: 'Команда' },
      { id: 'reflection', label: 'Вывод' },
    ],
    numbers: [],
    choices: [
      { key: 'impact', label: 'Насколько это повлияло на ситуацию?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) },
    ],
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
  const target = useMemo(() => members.find((member) => member.role === 'child') ?? me ?? null, [members, me]);
  const [entryType, setEntryType] = useState(config.entries[0]?.id ?? 'reflection');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setNumber = (key: string, value: string) => {
    const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '');
    setNumbers((current) => ({ ...current, [key]: normalized }));
  };

  const save = async () => {
    if (!supabase || !family || !target || busy) return;
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
      const { error } = await supabase.rpc('create_growth_entry', {
        p_family_id: family.id,
        p_user_id: target.user_id,
        p_category: category,
        p_entry_type: entryType,
        p_activity_date: new Date().toISOString().slice(0, 10),
        p_title: title.trim() || null,
        p_note: note.trim() || null,
        p_metrics: metrics,
      });
      if (error) throw error;
      Alert.alert('Сохранено', `Запись добавлена в «${config.title}» и в общую историю роста.`);
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>{config.icon} Новая запись</Text>
              <Text style={styles.subtitle}>{config.title} · {target?.display_name ?? 'Артур'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Что это за момент?</Text>
            <View style={styles.chips}>
              {config.entries.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.chip, entryType === option.id && styles.chipActive]}
                  onPress={() => setEntryType(option.id)}
                >
                  <Text style={[styles.chipText, entryType === option.id && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Короткий заголовок</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={config.titlePlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={120}
            />

            <Text style={styles.label}>Что хочется запомнить</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={config.notePlaceholder}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.noteInput]}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.counter}>{note.length}/2000</Text>
          </View>

          {config.numbers.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Немного фактов</Text>
              <Text style={styles.help}>Заполняй только то, что действительно полезно. Все поля необязательные.</Text>
              {config.numbers.map((field) => (
                <View key={field.key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.numberWrap}>
                    <TextInput
                      value={numbers[field.key] ?? ''}
                      onChangeText={(value) => setNumber(field.key, value)}
                      placeholder={field.placeholder}
                      placeholderTextColor={colors.muted}
                      style={styles.numberInput}
                      keyboardType="decimal-pad"
                    />
                    {field.suffix ? <Text style={styles.suffix}>{field.suffix}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {config.choices.map((field) => (
            <View key={field.key} style={styles.card}>
              <Text style={styles.label}>{field.label}</Text>
              <View style={styles.chips}>
                {field.options.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[styles.choiceChip, choices[field.key] === option.id && styles.choiceChipActive]}
                    onPress={() => setChoices((current) => ({ ...current, [field.key]: option.id }))}
                  >
                    <Text style={[styles.choiceText, choices[field.key] === option.id && styles.choiceTextActive]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.privateCard}>
            <Text style={styles.privateTitle}>🔒 Семейный журнал</Text>
            <Text style={styles.privateText}>Эта запись видна только участникам вашей команды. Она не публикуется и не становится школьной или спортивной «оценкой».</Text>
          </View>

          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => void save()}>
            <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : 'Сохранить момент'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 34, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  label: { color: colors.text, fontSize: 13, fontWeight: '900' },
  help: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.sand, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, color: colors.text, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14 },
  noteInput: { minHeight: 150 },
  counter: { color: colors.muted, fontSize: 10, textAlign: 'right', marginTop: -4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fieldLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  numberWrap: { minWidth: 108, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, paddingRight: 10 },
  numberInput: { minWidth: 64, paddingHorizontal: 11, paddingVertical: 10, color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  suffix: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  choiceChip: { minWidth: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.sand, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  choiceChipActive: { backgroundColor: '#FFF0CF', borderColor: colors.amber },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  choiceTextActive: { color: colors.navyDeep },
  privateCard: { backgroundColor: '#E7EEEE', borderRadius: radius.md, padding: 14, gap: 4 },
  privateTitle: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  privateText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  primary: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
