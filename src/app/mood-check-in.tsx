import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type MoodValue = 'great' | 'good' | 'ok' | 'tired' | 'sad' | 'angry';
type MoodRow = { id: string; user_id: string; mood: MoodValue; note: string | null; created_at: string };

type MoodMeta = { emoji: string; label: string; short: string; tint: string; ink: string };
const moodMeta: Record<MoodValue, MoodMeta> = {
  great: { emoji: '🚀', label: 'Отлично', short: 'на подъёме', tint: '#DDF0E4', ink: '#2F765A' },
  good: { emoji: '🙂', label: 'Хорошо', short: 'в порядке', tint: '#E3F1E8', ink: '#3F765C' },
  ok: { emoji: '😐', label: 'Нормально', short: 'обычно', tint: '#EEF0E9', ink: '#697068' },
  tired: { emoji: '😴', label: 'Устал', short: 'нужен отдых', tint: '#E5E9F4', ink: '#5C6787' },
  sad: { emoji: '😔', label: 'Грустно', short: 'не очень', tint: '#E3EBF4', ink: '#546E8A' },
  angry: { emoji: '😤', label: 'Злюсь', short: 'напряжён', tint: '#F6E1DA', ink: '#925B50' },
};

const localDayKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const prettyMoment = (value: string) => {
  const date = new Date(value);
  if (localDayKey(date) === localDayKey(new Date())) return `сегодня · ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function MoodCheckInScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [rows, setRows] = useState<MoodRow[]>([]);
  const [selected, setSelected] = useState<MoodValue | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);

  const latestByUser = useMemo(() => {
    const result = new Map<string, MoodRow>();
    for (const row of rows) if (!result.has(row.user_id)) result.set(row.user_id, row);
    return result;
  }, [rows]);

  const mine = me ? latestByUser.get(me.user_id) ?? null : null;
  const parentMood = parent ? latestByUser.get(parent.user_id) ?? null : null;
  const childMood = child ? latestByUser.get(child.user_id) ?? null : null;

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }
    const { data, error } = await client
      .from('moods')
      .select('id,user_id,mood,note,created_at')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) Alert.alert('Не удалось загрузить состояния', error.message);
    else setRows((data ?? []) as MoodRow[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!mine || localDayKey(mine.created_at) !== localDayKey(new Date())) return;
    setSelected(mine.mood);
    setNote(mine.note ?? '');
  }, [mine?.id]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || !session || !selected || busy) return;
    const cleanNote = note.trim().slice(0, 200);
    const today = localDayKey(new Date());
    const updateToday = Boolean(mine && localDayKey(mine.created_at) === today);
    setBusy(true);
    try {
      if (updateToday && mine) {
        const { error } = await client.from('moods').update({ mood: selected, note: cleanNote || null }).eq('id', mine.id).eq('user_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('moods').insert({ family_id: family.id, user_id: session.user.id, mood: selected, note: cleanNote || null });
        if (error) throw error;
        const eventResult = await client.from('activity_events').insert({
          family_id: family.id,
          actor_user_id: session.user.id,
          event_type: 'mood_shared',
          category: 'together',
          payload: { mood: selected, has_note: Boolean(cleanNote) },
        });
        if (eventResult.error) throw eventResult.error;
      }
      await load();
      Alert.alert('Сохранено', 'Это не оценка и не отчёт — просто понятный сигнал друг другу.');
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const personCard = (name: string, role: string, row: MoodRow | null, warm: boolean) => {
    const info = row ? moodMeta[row.mood] : null;
    return (
      <View style={[styles.personCard, warm ? styles.personWarm : styles.personCool, shadows.soft]}>
        <View style={styles.personTop}>
          <View style={[styles.initialCircle, warm ? styles.initialWarm : styles.initialCool]}><Text style={styles.initialText}>{name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.personCopy}><Text style={styles.personName}>{name}</Text><Text style={styles.personRole}>{role}</Text></View>
          <View style={[styles.personMood, { backgroundColor: info?.tint ?? 'rgba(255,255,255,0.66)' }]}><Text style={styles.personMoodText}>{info?.emoji ?? '·'}</Text></View>
        </View>
        <Text style={styles.personState}>{info?.label ?? 'Ещё не отметил'}</Text>
        {row?.note ? <Text style={styles.personNote} numberOfLines={3}>«{row.note}»</Text> : <Text style={styles.personNoteMuted}>Можно оставить только состояние — без объяснений.</Text>}
        {row ? <Text style={styles.personTime}>{prettyMoment(row.created_at)}</Text> : null}
      </View>
    );
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.navy} />}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.kicker}>СИГНАЛ БЕЗ ОТЧЁТА</Text><Text style={styles.title}>Как мы?</Text></View>
        </View>

        <StoryHero
          kicker="ПАПА & Я · СОСТОЯНИЕ СЕЙЧАС"
          title="Иногда одного сигнала достаточно"
          subtitle="Не нужно объяснять всё и сразу. Отметь состояние. Фраза — только если хочется."
          emblemImage={require('../../assets/generated/feature-together.png')}
          variant="team"
          footer={<View style={styles.heroFooter}><Image source={require('../../assets/generated/feature-family.png')} style={styles.heroFooterImage} resizeMode="contain" /><Text style={styles.heroFooterText}>Заметить друг друга важнее статистики.</Text></View>}
        />

        <View style={styles.twoPeople}>
          {personCard(parent?.display_name ?? 'Михаил', 'папа', parentMood, true)}
          {personCard(child?.display_name ?? 'Артур', 'сын', childMood, false)}
        </View>

        <View style={[styles.checkCard, shadows.soft]}>
          <View style={styles.sectionVisualRow}>
            <View style={styles.sectionVisual}><Image source={require('../../assets/generated/utility-recognition.png')} style={styles.sectionVisualImage} resizeMode="contain" /></View>
            <View style={styles.sectionVisualCopy}><Text style={styles.sectionKicker}>МОЙ СИГНАЛ</Text><Text style={styles.sectionTitle}>Как ты сейчас?</Text></View>
          </View>
          <Text style={styles.sectionText}>Выбери то, что ближе. Здесь нет «правильного» ответа.</Text>

          <View style={styles.moodGrid}>
            {(Object.keys(moodMeta) as MoodValue[]).map((value) => {
              const info = moodMeta[value];
              const active = selected === value;
              return (
                <Pressable key={value} onPress={() => setSelected(value)} style={[styles.moodButton, { backgroundColor: info.tint }, active && { borderColor: info.ink, borderWidth: 2 }]}>
                  <Text style={styles.moodEmoji}>{info.emoji}</Text>
                  <Text style={[styles.moodLabel, { color: info.ink }]}>{info.label}</Text>
                  <Text style={[styles.moodShort, { color: info.ink }]}>{info.short}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.noteLabel}>ЕСЛИ ХОЧЕТСЯ ДОБАВИТЬ ФРАЗУ</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={200}
            multiline
            textAlignVertical="top"
            placeholder="Например: «день тяжёлый, но всё нормально»"
            placeholderTextColor={colors.mutedSoft}
            style={styles.noteInput}
          />
          <View style={styles.counterRow}><Text style={styles.privacyHint}>Видите только вы двое.</Text><Text style={styles.counter}>{note.length}/200</Text></View>

          <Pressable disabled={!selected || busy} onPress={() => void save()} style={[styles.saveButton, (!selected || busy) && styles.disabled]}>
            <Text style={styles.saveText}>{busy ? 'Сохраняем…' : mine && localDayKey(mine.created_at) === localDayKey(new Date()) ? 'Обновить мой сигнал' : 'Поделиться состоянием'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <View><Text style={styles.sectionKicker}>ПОСЛЕДНИЕ СИГНАЛЫ</Text><Text style={styles.sectionTitle}>Без статистики и рейтингов</Text></View>
          <Image source={require('../../assets/generated/feature-path.png')} style={styles.sectionHeadImage} resizeMode="contain" />
        </View>

        <View style={styles.timeline}>
          {rows.slice(0, 14).map((row) => {
            const info = moodMeta[row.mood];
            return (
              <View key={row.id} style={[styles.timelineRow, shadows.soft]}>
                <View style={[styles.timelineEmoji, { backgroundColor: info.tint }]}><Text style={styles.timelineEmojiText}>{info.emoji}</Text></View>
                <View style={styles.timelineCopy}>
                  <View style={styles.timelineTop}><Text style={styles.timelineName}>{names.get(row.user_id) ?? 'Участник'}</Text><Text style={styles.timelineTime}>{prettyMoment(row.created_at)}</Text></View>
                  <Text style={[styles.timelineState, { color: info.ink }]}>{info.label}</Text>
                  {row.note ? <Text style={styles.timelineNote}>{row.note}</Text> : null}
                </View>
              </View>
            );
          })}
          {!rows.length ? <View style={styles.empty}><Image source={require('../../assets/generated/feature-family.png')} style={styles.emptyImage} resizeMode="contain" /><Text style={styles.emptyText}>Первые сигналы появятся здесь. История нужна не для анализа, а чтобы лучше чувствовать друг друга.</Text></View> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40, gap: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.navy, fontSize: 32, lineHeight: 34, marginTop: -3 },
  topCopy: { flex: 1 },
  kicker: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFooterImage: { width: 34, height: 34 },
  heroFooterText: { color: '#DDEBEC', fontSize: 9, fontWeight: '800', flex: 1 },
  twoPeople: { flexDirection: 'row', gap: 10 },
  personCard: { flex: 1, minHeight: 190, borderRadius: radius.lg, padding: 14 },
  personWarm: { backgroundColor: '#FFF0D2' },
  personCool: { backgroundColor: '#DDEDEF' },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  initialCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initialWarm: { backgroundColor: '#D99845' },
  initialCool: { backgroundColor: '#397B83' },
  initialText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  personCopy: { flex: 1 },
  personName: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  personRole: { color: colors.muted, fontSize: 8, fontWeight: '800', marginTop: 1 },
  personMood: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  personMoodText: { fontSize: 20 },
  personState: { color: colors.navyDeep, fontSize: 17, fontWeight: '900', marginTop: 16 },
  personNote: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 6 },
  personNoteMuted: { color: colors.mutedSoft, fontSize: 8.5, lineHeight: 13, marginTop: 6 },
  personTime: { color: colors.mutedSoft, fontSize: 7.5, fontWeight: '800', marginTop: 'auto', paddingTop: 10 },
  checkCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 18 },
  sectionVisualRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionVisual: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sectionVisualImage: { width: 45, height: 45 },
  sectionVisualCopy: { flex: 1 },
  sectionKicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 2 },
  sectionText: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 10 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  moodButton: { width: '31.5%', minHeight: 104, borderRadius: 18, padding: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 9.5, fontWeight: '900', marginTop: 5 },
  moodShort: { fontSize: 7.5, fontWeight: '700', marginTop: 2, opacity: 0.82 },
  noteLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  noteInput: { minHeight: 94, borderRadius: radius.md, backgroundColor: '#F7F4ED', borderWidth: 1, borderColor: colors.lineWarm, padding: 13, color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 7 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  privacyHint: { color: colors.mutedSoft, fontSize: 8.5, fontWeight: '700' },
  counter: { color: colors.mutedSoft, fontSize: 8.5, fontWeight: '800' },
  saveButton: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  saveText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionHeadImage: { width: 50, height: 50 },
  timeline: { gap: 8 },
  timelineRow: { minHeight: 82, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineEmoji: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timelineEmojiText: { fontSize: 23 },
  timelineCopy: { flex: 1 },
  timelineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineName: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  timelineTime: { color: colors.mutedSoft, fontSize: 7.5, fontWeight: '800' },
  timelineState: { fontSize: 11, fontWeight: '900', marginTop: 3 },
  timelineNote: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  empty: { minHeight: 155, backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 18, alignItems: 'center', justifyContent: 'center' },
  emptyImage: { width: 58, height: 58 },
  emptyText: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8, maxWidth: '90%' },
});
