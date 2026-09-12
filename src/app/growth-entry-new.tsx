import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  type ImageSourcePropType,
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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type GrowthCategory = 'school' | 'football' | 'chess' | 'english' | 'leadership';
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
    image: require('../../assets/generated/direction-school.png'), title: 'Школа', subtitle: 'Сохраняем не только результат, но и то, как Артур к нему пришёл.', titlePlaceholder: 'Например: подготовка к контрольной по математике', notePlaceholder: 'Что было сложным? Что помогло? Что в следующий раз сделать иначе?', accent: '#DCE7F6', strong: '#477FA3', deep: '#27465F', gradient: ['#3D7195', '#294B67'],
    entries: [{ id: 'goal', label: 'Цель' }, { id: 'study', label: 'Подготовка' }, { id: 'result', label: 'Результат' }, { id: 'reflection', label: 'Вывод' }],
    numbers: [{ key: 'duration_min', label: 'Время', placeholder: '30', min: 0, max: 600, suffix: 'мин' }],
    choices: [{ key: 'effort', label: 'Сколько усилий потребовалось?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  football: {
    image: require('../../assets/generated/direction-football.png'), title: 'Футбол', subtitle: 'Не рейтинг игрока, а личный разбор игры и командности.', titlePlaceholder: 'Например: вечерняя тренировка или матч с командой', notePlaceholder: 'Что получилось лучше всего? Что было трудно? Что хочется попробовать на следующей тренировке?', accent: '#DCEFE4', strong: '#4F8D70', deep: '#2C5942', gradient: ['#4C8D6F', '#2E6651'],
    entries: [{ id: 'training', label: 'Тренировка' }, { id: 'match', label: 'Матч' }, { id: 'teamwork', label: 'Команда' }, { id: 'tactics', label: 'Тактика' }],
    numbers: [{ key: 'duration_min', label: 'Время на поле', placeholder: '60', min: 0, max: 300, suffix: 'мин' }, { key: 'goals', label: 'Голы', placeholder: '0', min: 0, max: 30 }, { key: 'assists', label: 'Голевые передачи', placeholder: '0', min: 0, max: 30 }],
    choices: [{ key: 'confidence', label: 'Как ощущалась игра?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  chess: {
    image: require('../../assets/generated/direction-chess.png'), title: 'Шахматы', subtitle: 'Победы важны, но ещё важнее научиться видеть свои решения.', titlePlaceholder: 'Например: партия с папой или турнирная партия', notePlaceholder: 'Где был самый важный момент? Какой ход хочется разобрать? Что понял после партии?', accent: '#E7E2F6', strong: '#7167A8', deep: '#4C456B', gradient: ['#7167A8', '#4B456E'],
    entries: [{ id: 'game', label: 'Партия' }, { id: 'analysis', label: 'Разбор' }, { id: 'puzzle', label: 'Задачи' }, { id: 'tournament', label: 'Турнир' }],
    numbers: [{ key: 'moves', label: 'Количество ходов', placeholder: '40', min: 0, max: 500 }, { key: 'duration_min', label: 'Время', placeholder: '45', min: 0, max: 600, suffix: 'мин' }],
    choices: [{ key: 'result', label: 'Результат партии', options: [{ id: 'win', label: 'Победа' }, { id: 'draw', label: 'Ничья' }, { id: 'loss', label: 'Поражение' }] }],
  },
  english: {
    image: require('../../assets/generated/direction-english.png'), title: 'English', subtitle: 'Следим не за идеальностью, а за тем, насколько свободнее становится речь.', titlePlaceholder: 'Например: 5 минут разговора без русского', notePlaceholder: 'Какие фразы получилось использовать? Что было трудно сказать? Что запомнилось?', accent: '#FFF0CF', strong: '#D89A2B', deep: '#74511B', gradient: ['#D89A2B', '#A9701D'],
    entries: [{ id: 'speaking', label: 'Разговор' }, { id: 'lesson', label: 'Занятие' }, { id: 'vocabulary', label: 'Слова' }, { id: 'real_life', label: 'В жизни' }],
    numbers: [{ key: 'duration_min', label: 'Общее время', placeholder: '20', min: 0, max: 600, suffix: 'мин' }, { key: 'speaking_min', label: 'Говорил вслух', placeholder: '5', min: 0, max: 300, suffix: 'мин' }, { key: 'new_words', label: 'Новых слов/фраз', placeholder: '3', min: 0, max: 200 }],
    choices: [{ key: 'confidence', label: 'Насколько уверенно говорил?', options: [1, 2, 3, 4, 5].map((value) => ({ id: String(value), label: String(value) })) }],
  },
  leadership: {
    image: require('../../assets/generated/direction-leadership.png'), title: 'Лидерство', subtitle: 'Не «быть главным», а замечать инициативу, ответственность и влияние на команду.', titlePlaceholder: 'Например: сам предложил решение в команде', notePlaceholder: 'Что произошло? Какое решение принял? Как это повлияло на других? Что понял?', accent: '#F7DDD5', strong: '#C76D5A', deep: '#70443A', gradient: ['#C76D5A', '#8F4A3E'],
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={[styles.backButton, shadows.soft]}><Text style={styles.backText}>‹</Text></Pressable>
            <View style={styles.topText}><Text style={styles.topKicker}>НОВЫЙ МОМЕНТ</Text><Text style={styles.topTitle}>{config.title}</Text></View>
            <View style={[styles.topIcon, { backgroundColor: config.accent }]}><Image source={config.image} style={styles.topIconImage} resizeMode="contain" /></View>
          </View>

          <LinearGradient colors={config.gradient} style={[styles.hero, shadows.lift]}>
            <View style={styles.heroOrb} />
            <Image source={config.image} style={styles.heroImage} resizeMode="contain" />
            <Text style={styles.heroKicker}>{target?.display_name ?? 'Артур'} · {config.title.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>Что произошло сегодня?</Text>
            <Text style={styles.heroText}>{config.subtitle}</Text>
            <View style={styles.typeRow}>
              {config.entries.map((option) => {
                const active = entryType === option.id;
                return <Pressable key={option.id} style={[styles.heroChip, active && styles.heroChipActive]} onPress={() => setEntryType(option.id)}><Text style={[styles.heroChipText, active && { color: config.deep }]}>{option.label}</Text></Pressable>;
              })}
            </View>
          </LinearGradient>

          <View style={[styles.card, shadows.soft]}>
            <View style={styles.cardHeading}><Image source={config.image} style={styles.cardHeadingImage} resizeMode="contain" /><View><Text style={styles.cardKicker}>ГЛАВНОЕ</Text><Text style={styles.cardTitle}>Сохраним смысл момента</Text></View></View>
            <Text style={styles.label}>Короткий заголовок</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder={config.titlePlaceholder} placeholderTextColor={colors.muted} style={[styles.input, { borderColor: config.accent }]} maxLength={120} />

            <Text style={[styles.label, styles.noteLabel]}>Что хочется запомнить</Text>
            <TextInput value={note} onChangeText={setNote} placeholder={config.notePlaceholder} placeholderTextColor={colors.muted} style={[styles.input, styles.noteInput, { borderColor: config.accent }]} multiline textAlignVertical="top" maxLength={2000} />
            <Text style={styles.counter}>{note.length}/2000</Text>
          </View>

          {config.numbers.length ? (
            <View style={[styles.card, shadows.soft]}>
              <View style={styles.cardHeaderRow}><View><Text style={styles.cardKicker}>ФАКТЫ</Text><Text style={styles.cardTitle}>Немного цифр</Text></View><View style={[styles.infoDot, { backgroundColor: config.accent }]}><Image source={require('../../assets/generated/utility-goal.png')} style={styles.infoImage} resizeMode="contain" /></View></View>
              <Text style={styles.help}>Только если это действительно помогает помнить контекст. Все поля необязательные.</Text>
              <View style={styles.numberGrid}>
                {config.numbers.map((field) => (
                  <View key={field.key} style={[styles.numberCard, { backgroundColor: config.accent }]}>
                    <Text style={[styles.numberLabel, { color: config.deep }]}>{field.label}</Text>
                    <View style={styles.numberValueRow}><TextInput value={numbers[field.key] ?? ''} onChangeText={(value) => setNumber(field.key, value)} placeholder={field.placeholder} placeholderTextColor={config.deep} style={[styles.numberInput, { color: config.deep }]} keyboardType="decimal-pad" />{field.suffix ? <Text style={[styles.suffix, { color: config.deep }]}>{field.suffix}</Text> : null}</View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {config.choices.map((field) => (
            <View key={field.key} style={[styles.card, shadows.soft]}>
              <Text style={styles.cardKicker}>ОЩУЩЕНИЕ</Text>
              <Text style={styles.label}>{field.label}</Text>
              <View style={styles.choiceRow}>
                {field.options.map((option) => {
                  const active = choices[field.key] === option.id;
                  return <Pressable key={option.id} style={[styles.choiceChip, active && { backgroundColor: config.strong, borderColor: config.strong }]} onPress={() => setChoices((current) => ({ ...current, [field.key]: option.id }))}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text></Pressable>;
                })}
              </View>
            </View>
          ))}

          <View style={[styles.privateCard, { backgroundColor: config.accent }, shadows.soft]}>
            <View style={styles.privateImageBox}><Image source={require('../../assets/generated/feature-family.png')} style={styles.privateImage} resizeMode="contain" /></View>
            <View style={styles.privateCopy}><Text style={[styles.privateTitle, { color: config.deep }]}>Только для вашей команды</Text><Text style={[styles.privateText, { color: config.deep }]}>Запись не публикуется и не превращается в школьную, спортивную или личностную оценку.</Text></View>
          </View>

          <Pressable style={[styles.primary, { backgroundColor: config.strong }, shadows.lift, busy && styles.disabled]} disabled={busy} onPress={() => void save()}>
            <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : 'Сохранить в нашу историю'}</Text>
            {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, keyboard: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 }, backButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineWarm, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 }, topText: { flex: 1 }, topKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, topTitle: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', marginTop: 1 }, topIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, topIconImage: { width: 44, height: 44 },
  hero: { minHeight: 265, borderRadius: radius.xl, padding: 20, overflow: 'hidden' }, heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.09)', right: -65, top: -68 }, heroImage: { position: 'absolute', width: 126, height: 126, right: 9, top: 14, opacity: 0.92 }, heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 1.05 }, heroTitle: { color: colors.white, fontSize: 27, fontWeight: '900', marginTop: 8, maxWidth: '68%' }, heroText: { color: 'rgba(255,255,255,0.78)', fontSize: 10, lineHeight: 15, maxWidth: '68%', marginTop: 5 }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 'auto', paddingTop: 20 }, heroChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, heroChipActive: { backgroundColor: colors.white, borderColor: colors.white }, heroChipText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  card: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 17 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }, cardHeadingImage: { width: 42, height: 42 }, cardKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.05 }, cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cardTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900', marginTop: 2 }, label: { color: colors.navyDeep, fontSize: 12, fontWeight: '900', marginTop: 14, marginBottom: 7 }, noteLabel: { marginTop: 16 }, help: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 5 }, infoDot: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, infoImage: { width: 34, height: 34 }, input: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.white, color: colors.text, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13 }, noteInput: { minHeight: 145 }, counter: { color: colors.muted, fontSize: 8, textAlign: 'right', marginTop: 5 },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }, numberCard: { minWidth: '47%', flexGrow: 1, borderRadius: radius.lg, padding: 13 }, numberLabel: { fontSize: 9, fontWeight: '900', opacity: 0.72 }, numberValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }, numberInput: { minWidth: 50, fontSize: 22, fontWeight: '900', paddingVertical: 0 }, suffix: { fontSize: 9, fontWeight: '900', opacity: 0.65, marginLeft: 3 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }, choiceChip: { minWidth: 47, minHeight: 44, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.sandWarm, borderWidth: 1, borderColor: colors.lineWarm, alignItems: 'center', justifyContent: 'center' }, choiceText: { color: colors.muted, fontSize: 11, fontWeight: '900' }, choiceTextActive: { color: colors.white },
  privateCard: { minHeight: 92, borderRadius: radius.xl, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, privateImageBox: { width: 54, height: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, privateImage: { width: 50, height: 50 }, privateCopy: { flex: 1 }, privateTitle: { fontSize: 12, fontWeight: '900' }, privateText: { fontSize: 9, lineHeight: 14, opacity: 0.72, marginTop: 3 },
  primary: { minHeight: 58, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, primaryText: { color: colors.white, fontSize: 13, fontWeight: '900' }, primaryArrow: { color: colors.white, fontSize: 18, fontWeight: '900' }, disabled: { opacity: 0.5 },
});