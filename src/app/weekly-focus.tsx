import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type ImageSourcePropType,
  Pressable,
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

type Category = 'school' | 'football' | 'chess' | 'english' | 'leadership' | 'together';
type Slot = 'child' | 'together';
type Focus = {
  id: string;
  created_by: string;
  target_user_id: string | null;
  category: Category;
  title: string;
  note: string | null;
  week_start: string;
};

type CategoryMeta = {
  title: string;
  image: ImageSourcePropType;
  base: string;
  ink: string;
};

const meta: Record<Category, CategoryMeta> = {
  school: { title: 'Школа', image: require('../../assets/generated/direction-school.png'), base: '#DCEFFF', ink: '#2E6286' },
  football: { title: 'Футбол', image: require('../../assets/generated/direction-football.png'), base: '#DDF4E6', ink: '#356B50' },
  chess: { title: 'Шахматы', image: require('../../assets/generated/direction-chess.png'), base: '#EAE5FA', ink: '#5B5091' },
  english: { title: 'English', image: require('../../assets/generated/direction-english.png'), base: '#FFF1C9', ink: '#98661A' },
  leadership: { title: 'Лидерство', image: require('../../assets/generated/direction-leadership.png'), base: '#FFE2D8', ink: '#945345' },
  together: { title: 'Папа & Я', image: require('../../assets/generated/feature-together.png'), base: '#FFF0CF', ink: '#A56E16' },
};

const localIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const currentMonday = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return localIso(date);
};
const weekLabel = (iso: string) => {
  const start = new Date(`${iso}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};

export default function WeeklyFocusScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const childName = child?.display_name ?? 'Артур';
  const weekStart = useMemo(currentMonday, []);
  const [rows, setRows] = useState<Focus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [category, setCategory] = useState<Category>('school');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('weekly_focuses')
      .select('id,created_by,target_user_id,category,title,note,week_start')
      .eq('family_id', family.id)
      .lte('week_start', weekStart)
      .order('week_start', { ascending: false })
      .limit(24);
    if (error) Alert.alert('Не удалось загрузить фокус недели', error.message);
    else setRows((data ?? []) as Focus[]);
    setLoading(false);
  }, [family, weekStart]);

  useEffect(() => { void load(); }, [load]);

  const childFocus = rows.find((row) => row.week_start === weekStart && row.target_user_id === child?.user_id) ?? null;
  const togetherFocus = rows.find((row) => row.week_start === weekStart && row.target_user_id === null) ?? null;
  const previous = rows.filter((row) => row.week_start < weekStart).slice(0, 8);
  const currentFor = (slot: Slot) => slot === 'child' ? childFocus : togetherFocus;
  const editingFocus = editing ? currentFor(editing) : null;

  const openEditor = (slot: Slot) => {
    const current = currentFor(slot);
    setEditing(slot);
    setCategory(current?.category ?? (slot === 'together' ? 'together' : 'school'));
    setTitle(current?.title ?? '');
    setNote(current?.note ?? '');
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || !session || !editing || !child || busy) return;
    const clean = title.trim();
    if (!clean) {
      Alert.alert('Нужен ориентир', 'Напиши одну короткую вещь на эту неделю.');
      return;
    }
    setBusy(true);
    try {
      const existing = currentFor(editing);
      if (existing) {
        const { error } = await client
          .from('weekly_focuses')
          .update({ category, title: clean, note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const target = editing === 'child' ? child.user_id : null;
        const { error } = await client.from('weekly_focuses').insert({
          family_id: family.id,
          created_by: session.user.id,
          target_user_id: target,
          category,
          title: clean,
          note: note.trim() || null,
          week_start: weekStart,
        });
        if (error) throw error;
        await client.from('activity_events').insert({
          family_id: family.id,
          actor_user_id: session.user.id,
          event_type: 'weekly_focus_added',
          category,
          payload: { title: clean, week_start: weekStart, scope: editing, target_user_id: target },
        });
      }
      setEditing(null);
      setTitle('');
      setNote('');
      await load();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const client = supabase;
    if (!client || !editingFocus || busy) return;
    setBusy(true);
    try {
      const { error } = await client.from('weekly_focuses').delete().eq('id', editingFocus.id);
      if (error) throw error;
      setEditing(null);
      await load();
    } catch (caught) {
      Alert.alert('Не удалось убрать фокус', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const focusCard = (slot: Slot, focus: Focus | null) => {
    const info = focus ? meta[focus.category] : meta[slot === 'together' ? 'together' : 'school'];
    return (
      <View style={[styles.card, shadows.soft, { backgroundColor: info.base }]}>
        <View style={styles.row}>
          <View style={styles.iconShell}>
            <Image source={info.image} style={styles.iconImage} resizeMode="contain" />
          </View>
          <View style={styles.cardHeadCopy}>
            <Text style={[styles.kicker, { color: info.ink }]}>{slot === 'together' ? 'НАШ ФОКУС' : `ФОКУС ${childName.toUpperCase()}`}</Text>
            <Text style={[styles.category, { color: info.ink }]}>{focus ? info.title : 'На эту неделю'}</Text>
          </View>
        </View>
        {focus ? (
          <>
            <Text style={styles.focusTitle}>{focus.title}</Text>
            {focus.note ? <Text style={styles.copy}>{focus.note}</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.soft} onPress={() => openEditor(slot)}><Text style={styles.softText}>Изменить</Text></Pressable>
              <Pressable
                style={styles.soft}
                onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: `Что получилось с фокусом «${focus.title}» на этой неделе?` } })}
              >
                <Text style={styles.softText}>Подвести итог</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>{slot === 'together' ? 'Что важно прожить вместе?' : `На чём ${childName} хочет сосредоточиться?`}</Text>
            <Text style={styles.copy}>Не задача и не обещание — просто ориентир, к которому можно возвращаться.</Text>
            <Pressable style={[styles.primary, { backgroundColor: info.ink }]} onPress={() => openEditor(slot)}><Text style={styles.primaryText}>Задать фокус →</Text></Pressable>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.topKicker}>РАЗВИТИЕ БЕЗ ГОНКИ</Text><Text style={styles.topTitle}>Фокус недели</Text></View>
        </View>

        <StoryHero
          kicker={`НЕДЕЛЯ · ${weekLabel(weekStart).toUpperCase()}`}
          title="Два ориентира вместо списка обязанностей"
          subtitle={`Один для ${childName}, один для вас двоих. Пауза ничего не обнуляет.`}
          emblemImage={require('../../assets/generated/utility-goal.png')}
          variant="team"
          footer={<Text style={styles.heroRule}>Без XP · без серии · без «провалено»</Text>}
        />

        {focusCard('child', childFocus)}
        {focusCard('together', togetherFocus)}

        {editing ? (
          <View style={[styles.editor, shadows.soft]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.editorKicker}>ОДИН ОРИЕНТИР</Text>
                <Text style={styles.editorTitle}>{editing === 'child' ? `Фокус ${childName}` : 'Наш общий фокус'}</Text>
              </View>
              <Pressable onPress={() => setEditing(null)}><Text style={styles.close}>×</Text></Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(Object.keys(meta) as Category[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setCategory(key)}
                  style={[styles.chip, category === key && { backgroundColor: meta[key].base, borderColor: meta[key].ink }]}
                >
                  <Image source={meta[key].image} style={styles.chipImage} resizeMode="contain" />
                  <Text style={[styles.chipText, category === key && { color: meta[key].ink }]}>{meta[key].title}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              placeholder="Например: спокойно готовиться к контрольной"
              placeholderTextColor={colors.mutedSoft}
              style={styles.input}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={600}
              multiline
              textAlignVertical="top"
              placeholder="Что поможет удержать ориентир? Необязательно."
              placeholderTextColor={colors.mutedSoft}
              style={[styles.input, styles.note]}
            />
            <View style={styles.actions}>
              {editingFocus ? <Pressable disabled={busy} style={styles.remove} onPress={() => void remove()}><Text style={styles.removeText}>Убрать</Text></Pressable> : null}
              <Pressable disabled={busy} style={[styles.save, busy && styles.disabled]} onPress={() => void save()}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Сохранить</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View><Text style={styles.topKicker}>БЕЗ СЕРИЙ</Text><Text style={styles.sectionTitle}>Предыдущие недели</Text></View>
          <Image source={require('../../assets/generated/feature-path.png')} style={styles.sectionImage} resizeMode="contain" />
        </View>

        {previous.length ? (
          <View style={[styles.history, shadows.soft]}>
            {previous.map((focus, index) => (
              <View key={focus.id} style={[styles.historyRow, index > 0 && styles.border]}>
                <View style={styles.historyImageShell}><Image source={meta[focus.category].image} style={styles.historyImage} resizeMode="contain" /></View>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{focus.title}</Text>
                  <Text style={styles.historyMeta}>{weekLabel(focus.week_start)} · {focus.target_user_id ? childName : 'Папа & Я'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : <Text style={styles.copyCard}>После первой недели здесь останутся старые ориентиры — как следы пути, а не отчёт.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 16, paddingBottom: 38, gap: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { fontSize: 31, color: colors.navyDeep },
  topKicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  heroRule: { color: '#DDEBEC', fontSize: 14, fontWeight: '900' },
  card: { borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconShell: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.70)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconImage: { width: 54, height: 54 },
  cardHeadCopy: { flex: 1 },
  kicker: { fontSize: 14, fontWeight: '900', letterSpacing: 1.1 },
  category: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  focusTitle: { color: colors.navyDeep, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 14 },
  emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 14 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  copyCard: { color: colors.muted, fontSize: 14, lineHeight: 20, backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 14 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  soft: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.66)', alignItems: 'center', justifyContent: 'center' },
  softText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  primary: { minHeight: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  editor: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm, gap: 11 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  editorKicker: { color: colors.teal, fontSize: 14, fontWeight: '900', letterSpacing: 1.1 },
  editorTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 2 },
  close: { color: colors.muted, fontSize: 25, fontWeight: '700', paddingHorizontal: 4 },
  chips: { gap: 7, paddingVertical: 2 },
  chip: { minWidth: 82, minHeight: 78, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 8, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  chipImage: { width: 42, height: 42 },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '900', marginTop: 4 },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#F7F4ED', borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 13, color: colors.text, fontSize: 14, fontWeight: '700' },
  note: { minHeight: 90, paddingTop: 12 },
  remove: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#F4E8E6', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#9A564F', fontSize: 14, fontWeight: '900' },
  save: { flex: 1.5, minHeight: 46, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 2 },
  sectionImage: { width: 52, height: 52 },
  history: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 14 },
  historyRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10 },
  border: { borderTopWidth: 1, borderTopColor: colors.lineWarm },
  historyImageShell: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  historyImage: { width: 40, height: 40 },
  historyCopy: { flex: 1 },
  historyTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  historyMeta: { color: colors.muted, fontSize: 14, marginTop: 3 },
});
