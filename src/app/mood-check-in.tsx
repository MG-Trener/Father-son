import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type MoodValue = 'great' | 'good' | 'ok' | 'tired' | 'sad' | 'angry';

type MoodRow = {
  id: string;
  user_id: string;
  mood: MoodValue;
  note: string | null;
  created_at: string;
};

const moodMeta: Record<MoodValue, { emoji: string; label: string; short: string; tint: string }> = {
  great: { emoji: '🚀', label: 'Отлично', short: 'на подъёме', tint: '#DDF0E4' },
  good: { emoji: '🙂', label: 'Хорошо', short: 'в порядке', tint: '#E3F1E8' },
  ok: { emoji: '😐', label: 'Нормально', short: 'обычно', tint: '#EEF0E9' },
  tired: { emoji: '😴', label: 'Устал', short: 'нужен отдых', tint: '#E5E9F4' },
  sad: { emoji: '😔', label: 'Грустно', short: 'не очень', tint: '#E3EBF4' },
  angry: { emoji: '😤', label: 'Злюсь', short: 'напряжён', tint: '#F6E1DA' },
};

const localDayKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const prettyMoment = (value: string) => {
  const date = new Date(value);
  const today = localDayKey(new Date());
  const key = localDayKey(date);
  if (key === today) return `сегодня · ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
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
    for (const row of rows) {
      if (!result.has(row.user_id)) result.set(row.user_id, row);
    }
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

    if (error) {
      Alert.alert('Не удалось загрузить состояния', error.message);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as MoodRow[]);
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
    const updateToday = mine && localDayKey(mine.created_at) === today;

    setBusy(true);
    try {
      if (updateToday) {
        const { error } = await client
          .from('moods')
          .update({ mood: selected, note: cleanNote || null })
          .eq('id', mine.id)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('moods').insert({
          family_id: family.id,
          user_id: session.user.id,
          mood: selected,
          note: cleanNote || null,
        });
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

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  const personCard = (name: string, role: string, row: MoodRow | null, accent: 'warm' | 'cool') => {
    const meta = row ? moodMeta[row.mood] : null;
    return (
      <View style={[styles.personCard, accent === 'warm' ? styles.personWarm : styles.personCool]}>
        <View style={styles.personTop}>
          <View style={[styles.initialCircle, accent === 'warm' ? styles.initialWarm : styles.initialCool]}><Text style={styles.initialText}>{name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.personCopy}><Text style={styles.personName}>{name}</Text><Text style={styles.personRole}>{role}</Text></View>
          <Text style={styles.personEmoji}>{meta?.emoji ?? '○'}</Text>
        </View>
        <Text style={styles.personState}>{meta ? meta.label : 'Ещё не отметил'}</Text>
        {row?.note ? <Text style={styles.personNote} numberOfLines={3}>«{row.note}»</Text> : <Text style={styles.personNoteMuted}>Можно оставить только состояние — без объяснений.</Text>}
        {row ? <Text style={styles.personTime}>{prettyMoment(row.created_at)}</Text> : null}
      </View>
    );
  };

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

        <LinearGradient colors={['#163F50', '#286976', '#D99A4D']} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroIcon}>♥</Text>
          <Text style={styles.heroTitle}>Иногда одного значка достаточно, чтобы понять: стоит написать первым.</Text>
          <Text style={styles.heroText}>Не нужно объяснять всё и сразу. Отметь состояние. Фраза — только если хочется.</Text>
        </LinearGradient>

        <View style={styles.twoPeople}>
          {personCard(parent?.display_name ?? 'Михаил', 'папа', parentMood, 'warm')}
          {personCard(child?.display_name ?? 'Артур', 'сын', childMood, 'cool')}
        </View>

        <View style={[styles.checkCard, shadows.soft]}>
          <Text style={styles.sectionKicker}>МОЙ СИГНАЛ</Text>
          <Text style={styles.sectionTitle}>Как ты сейчас?</Text>
          <Text style={styles.sectionText}>Выбери то, что ближе. Здесь нет «правильного» ответа.</Text>

          <View style={styles.moodGrid}>
            {(Object.keys(moodMeta) as MoodValue[]).map((value) => {
              const meta = moodMeta[value];
              const active = selected === value;
              return (
                <Pressable key={value} onPress={() => setSelected(value)} style={[styles.moodButton, { backgroundColor: meta.tint }, active && styles.moodButtonActive]}>
                  <Text style={styles.moodEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{meta.label}</Text>
                  <Text style={[styles.moodShort, active && styles.moodShortActive]}>{meta.short}</Text>
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
          <Text style={styles.counter}>{note.length}/200</Text>

          <Pressable disabled={!selected || busy} onPress={() => void save()} style={[styles.saveButton, (!selected || busy) && styles.disabled]}>
            <Text style={styles.saveText}>{busy ? 'Сохраняем…' : mine && localDayKey(mine.created_at) === localDayKey(new Date()) ? 'Обновить мой сигнал' : 'Поделиться состоянием'}</Text>
          </Pressable>
          <Text style={styles.privacyHint}>Сигнал видите только вы двое внутри вашей семейной команды.</Text>
        </View>

        <View style={styles.sectionHead}><Text style={styles.sectionKicker}>ПОСЛЕДНИЕ СИГНАЛЫ</Text><Text style={styles.sectionTitle}>Без статистики и рейтингов</Text></View>
        <View style={styles.timeline}>
          {rows.slice(0, 14).map((row) => {
            const meta = moodMeta[row.mood];
            const name = names.get(row.user_id) ?? 'Участник';
            return (
              <View key={row.id} style={[styles.timelineRow, shadows.soft]}>
                <View style={[styles.timelineEmoji, { backgroundColor: meta.tint }]}><Text style={styles.timelineEmojiText}>{meta.emoji}</Text></View>
                <View style={styles.timelineCopy}>
                  <View style={styles.timelineTop}><Text style={styles.timelineName}>{name}</Text><Text style={styles.timelineTime}>{prettyMoment(row.created_at)}</Text></View>
                  <Text style={styles.timelineState}>{meta.label}</Text>
                  {row.note ? <Text style={styles.timelineNote}>{row.note}</Text> : null}
                </View>
              </View>
            );
          })}
          {!rows.length ? <View style={styles.empty}><Text style={styles.emptyText}>Первые сигналы появятся здесь. История нужна не для анализа, а чтобы лучше чувствовать друг друга.</Text></View> : null}
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
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 32, lineHeight: 34, marginTop: -3 },
  topCopy: { flex: 1 },
  kicker: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  hero: { minHeight: 235, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -70, top: -70, backgroundColor: 'rgba(255,215,106,0.18)' },
  heroIcon: { color: colors.sun, fontSize: 28, marginBottom: 14 },
  heroTitle: { color: colors.white, fontSize: 23, lineHeight: 28, fontWeight: '900', maxWidth: '95%' },
  heroText: { color: '#D9E9EA', fontSize: 12, lineHeight: 18, marginTop: 9, maxWidth: '92%' },
  twoPeople: { flexDirection: 'row', gap: 10 },
  personCard: { flex: 1, minHeight: 188, borderRadius: radius.lg, padding: 14 },
  personWarm: { backgroundColor: '#FFF0D2' },
  personCool: { backgroundColor: '#DDEDEF' },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  initialCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  initialWarm: { backgroundColor: colors.amber },
  initialCool: { backgroundColor: colors.teal },
  initialText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  personCopy: { flex: 1 },
  personName: { color: colors.text, fontSize: 12, fontWeight: '900' },
  personRole: { color: colors.muted, fontSize: 9, marginTop: 1 },
  personEmoji: { fontSize: 23 },
  personState: { color: colors.navy, fontSize: 17, fontWeight: '900', marginTop: 16 },
  personNote: { color: colors.text, fontSize: 10, lineHeight: 15, marginTop: 7 },
  personNoteMuted: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 7 },
  personTime: { color: colors.mutedSoft, fontSize: 8, fontWeight: '800', marginTop: 'auto', paddingTop: 10 },
  checkCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18 },
  sectionKicker: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.text, fontSize: 21, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  sectionText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  moodButton: { width: '48.5%', minHeight: 93, borderRadius: radius.md, padding: 11, borderWidth: 2, borderColor: 'transparent' },
  moodButtonActive: { borderColor: colors.navy },
  moodEmoji: { fontSize: 23 },
  moodLabel: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 5 },
  moodLabelActive: { color: colors.navyDeep },
  moodShort: { color: colors.muted, fontSize: 9, marginTop: 2 },
  moodShortActive: { color: colors.navy },
  noteLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 18 },
  noteInput: { minHeight: 90, borderRadius: radius.md, backgroundColor: '#F5F2EB', borderWidth: 1, borderColor: colors.lineWarm, padding: 13, marginTop: 7, color: colors.text, fontSize: 13, lineHeight: 18 },
  counter: { color: colors.mutedSoft, fontSize: 8, textAlign: 'right', marginTop: 4 },
  saveButton: { minHeight: 51, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  privacyHint: { color: colors.mutedSoft, fontSize: 8, textAlign: 'center', marginTop: 8 },
  sectionHead: { marginTop: 2 },
  timeline: { gap: 8 },
  timelineRow: { minHeight: 72, borderRadius: radius.md, backgroundColor: colors.paper, padding: 12, flexDirection: 'row', gap: 11 },
  timelineEmoji: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  timelineEmojiText: { fontSize: 20 },
  timelineCopy: { flex: 1 },
  timelineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timelineName: { color: colors.text, fontSize: 11, fontWeight: '900' },
  timelineTime: { color: colors.mutedSoft, fontSize: 8, fontWeight: '700' },
  timelineState: { color: colors.teal, fontSize: 10, fontWeight: '900', marginTop: 2 },
  timelineNote: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 4 },
  empty: { borderRadius: radius.md, backgroundColor: '#EFEAE0', padding: 16 },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
