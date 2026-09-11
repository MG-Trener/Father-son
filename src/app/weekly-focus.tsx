import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type Category = 'school' | 'football' | 'chess' | 'english' | 'leadership' | 'together';
type Slot = 'child' | 'together';

type WeeklyFocus = {
  id: string;
  created_by: string;
  target_user_id: string | null;
  category: Category;
  title: string;
  note: string | null;
  week_start: string;
  updated_at: string;
};

const categoryMeta: Record<Category, { title: string; icon: string; base: string; ink: string }> = {
  school: { title: 'Школа', icon: '📘', base: '#DCEFFF', ink: '#2E6286' },
  football: { title: 'Футбол', icon: '⚽', base: '#DDF4E6', ink: '#356B50' },
  chess: { title: 'Шахматы', icon: '♞', base: '#EAE5FA', ink: '#5B5091' },
  english: { title: 'English', icon: 'EN', base: '#FFF1C9', ink: '#98661A' },
  leadership: { title: 'Лидерство', icon: '🧭', base: '#FFE2D8', ink: '#945345' },
  together: { title: 'Папа & Я', icon: '♥', base: '#FFF0CF', ink: '#A56E16' },
};

const localIso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const currentMondayIso = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return localIso(date);
};

const weekLabel = (weekStart: string) => {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const left = start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const right = end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${left} — ${right}`;
};

export default function WeeklyFocusScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const childName = child?.display_name ?? 'Артур';
  const weekStart = useMemo(currentMondayIso, []);

  const [rows, setRows] = useState<WeeklyFocus[]>([]);
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
      .select('id,created_by,target_user_id,category,title,note,week_start,updated_at')
      .eq('family_id', family.id)
      .lte('week_start', weekStart)
      .order('week_start', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(24);
    if (error) Alert.alert('Не удалось загрузить фокус недели', error.message);
    else setRows((data ?? []) as WeeklyFocus[]);
    setLoading(false);
  }, [family, weekStart]);

  useEffect(() => { void load(); }, [load]);

  const childFocus = useMemo(
    () => rows.find((row) => row.week_start === weekStart && row.target_user_id === child?.user_id) ?? null,
    [rows, weekStart, child?.user_id],
  );
  const togetherFocus = useMemo(
    () => rows.find((row) => row.week_start === weekStart && row.target_user_id === null) ?? null,
    [rows, weekStart],
  );
  const previous = useMemo(() => rows.filter((row) => row.week_start < weekStart).slice(0, 8), [rows, weekStart]);

  const currentFor = (slot: Slot) => slot === 'child' ? childFocus : togetherFocus;

  const openEditor = (slot: Slot) => {
    const current = currentFor(slot);
    setEditing(slot);
    setCategory(current?.category ?? (slot === 'together' ? 'together' : 'school'));
    setTitle(current?.title ?? '');
    setNote(current?.note ?? '');
  };

  const save = async () => {
    if (!supabase || !family || !session || !editing || busy || !child) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Нужен ориентир', 'Напиши одну короткую вещь, на которую хочется обратить внимание на этой неделе.');
      return;
    }
    setBusy(true);
    try {
      const existing = currentFor(editing);
      if (existing) {
        const { error } = await supabase
          .from('weekly_focuses')
          .update({ category, title: cleanTitle, note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const targetUserId = editing === 'child' ? child.user_id : null;
        const { error } = await supabase.from('weekly_focuses').insert({
          family_id: family.id,
          created_by: session.user.id,
          target_user_id: targetUserId,
          category,
          title: cleanTitle,
          note: note.trim() || null,
          week_start: weekStart,
        });
        if (error) throw error;

        await supabase.from('activity_events').insert({
          family_id: family.id,
          actor_user_id: session.user.id,
          event_type: 'weekly_focus_added',
          category,
          payload: {
            title: cleanTitle,
            week_start: weekStart,
            scope: editing,
            target_user_id: targetUserId,
          },
        }).catch(() => undefined);
      }
      setEditing(null);
      setTitle('');
      setNote('');
      await load();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Попробуй ещё раз.';
      Alert.alert(message.includes('duplicate') ? 'Фокус уже задан' : 'Не удалось сохранить', message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (focus: WeeklyFocus) => {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('weekly_focuses').delete().eq('id', focus.id);
      if (error) throw error;
      setEditing(null);
      await load();
    } catch (caught) {
      Alert.alert('Не удалось убрать фокус', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const reflect = (focus: WeeklyFocus) => {
    router.push({
      pathname: '/reflection-new',
      params: { prompt: `Что получилось с фокусом «${focus.title}» на этой неделе?` },
    });
  };

  const renderFocusCard = (slot: Slot, focus: WeeklyFocus | null) => {
    const isTogether = slot === 'together';
    const meta = focus ? categoryMeta[focus.category] : categoryMeta[isTogether ? 'together' : 'school'];
    return (
      <View style={[styles.focusCard, shadows.soft, { backgroundColor: meta.base }]}>
        <View style={styles.focusTop}>
          <View style={[styles.focusIcon, { backgroundColor: meta.ink }]}><Text style={styles.focusIconText}>{meta.icon}</Text></View>
          <View style={styles.focusHeadCopy}>
            <Text style={[styles.focusKicker, { color: meta.ink }]}>{isTogether ? 'НАШ ФОКУС' : `ФОКУС ${childName.toUpperCase()}`}</Text>
            <Text style={[styles.focusCategory, { color: meta.ink }]}>{focus ? meta.title : 'На эту неделю'}</Text>
          </View>
        </View>
        {focus ? (
          <>
            <Text style={styles.focusTitle}>{focus.title}</Text>
            {focus.note ? <Text style={styles.focusNote}>{focus.note}</Text> : null}
            <View style={styles.focusActions}>
              <Pressable style={styles.softButton} onPress={() => openEditor(slot)}><Text style={styles.softButtonText}>Изменить</Text></Pressable>
              <Pressable style={styles.softButton} onPress={() => reflect(focus)}><Text style={styles.softButtonText}>Подвести итог</Text></Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>{isTogether ? 'Что важно сделать или прожить вместе?' : `На чём ${childName} хочет сосредоточиться?`}</Text>
            <Text style={styles.emptyCopy}>Это не задача и не обещание. Просто направление, к которому можно возвращаться в течение недели.</Text>
            <Pressable style={[styles.addButton, { backgroundColor: meta.ink }]} onPress={() => openEditor(slot)}><Text style={styles.addButtonText}>Задать фокус →</Text></Pressable>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View><Text style={styles.topKicker}>РАЗВИТИЕ БЕЗ ГОНКИ</Text><Text style={styles.topTitle}>Фокус недели</Text></View>
          </View>

          <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
            <View style={styles.heroOrb} />
            <Text style={styles.heroKicker}>НЕДЕЛЯ · {weekLabel(weekStart).toUpperCase()}</Text>
            <Text style={styles.heroTitle}>Две вещи, которые стоит держать в поле зрения.</Text>
            <Text style={styles.heroText}>Один ориентир для {childName} и один для вас двоих. Если жизнь поменяет планы — ничего не обнулится.</Text>
            <View style={styles.heroRule}><Text style={styles.heroRuleText}>Без XP · без серии · без «провалено»</Text></View>
          </LinearGradient>

          {renderFocusCard('child', childFocus)}
          {renderFocusCard('together', togetherFocus)}

          {editing ? (
            <View style={[styles.editor, shadows.soft]}>
              <View style={styles.editorHead}>
                <View><Text style={styles.editorKicker}>РЕДАКТОР</Text><Text style={styles.editorTitle}>{editing === 'child' ? `Фокус ${childName}` : 'Наш общий фокус'}</Text></View>
                <Pressable onPress={() => setEditing(null)}><Text style={styles.close}>×</Text></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {(Object.keys(categoryMeta) as Category[]).map((key) => {
                  const item = categoryMeta[key];
                  const active = key === category;
                  return (
                    <Pressable key={key} onPress={() => setCategory(key)} style={[styles.categoryChip, active && { backgroundColor: item.base, borderColor: item.ink }]}>
                      <Text style={[styles.categoryText, active && { color: item.ink }]}>{item.icon} {item.title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Например: спокойно готовиться к контрольной" placeholderTextColor={colors.mutedSoft} style={styles.input} />
              <TextInput value={note} onChangeText={setNote} maxLength={600} placeholder="Необязательно: что поможет не потерять этот ориентир?" placeholderTextColor={colors.mutedSoft} multiline textAlignVertical="top" style={[styles.input, styles.noteInput]} />
              <View style={styles.editorActions}>
                {currentFor(editing) ? <Pressable disabled={busy} style={styles.removeButton} onPress={() => void remove(currentFor(editing)!)}><Text style={styles.removeText}>Убрать</Text></Pressable> : null}
                <Pressable disabled={busy} style={[styles.saveButton, busy && styles.disabled]} onPress={() => void save()}>
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Сохранить фокус</Text>}
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionHead}>
            <View><Text style={styles.sectionKicker}>БЕЗ СЕРИЙ</Text><Text style={styles.sectionTitle}>Предыдущие недели</Text></View>
          </View>
          {previous.length ? (
            <View style={[styles.historyCard, shadows.soft]}>
              {previous.map((focus, index) => {
                const meta = categoryMeta[focus.category];
                return (
                  <View key={focus.id} style={[styles.historyRow, index > 0 && styles.historyBorder]}>
                    <View style={[styles.historyIcon, { backgroundColor: meta.base }]}><Text style={[styles.historyIconText, { color: meta.ink }]}>{meta.icon}</Text></View>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyTitle}>{focus.title}</Text>
                      <Text style={styles.historyMeta}>{weekLabel(focus.week_start)} · {focus.target_user_id ? childName : 'Папа & Я'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.historyEmpty}><Text style={styles.historyEmptyText}>После первой недели здесь останутся прежние ориентиры — как следы пути, а не как отчёт.</Text></View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 15 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 1 },
  hero: { minHeight: 240, borderRadius: radius.xl, padding: 21, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,215,106,0.09)', right: -58, top: -72 },
  heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 10, maxWidth: '88%' },
  heroText: { color: '#D8E6E7', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: '91%' },
  heroRule: { alignSelf: 'flex-start', marginTop: 'auto', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  heroRuleText: { color: '#DDEBEC', fontSize: 8, fontWeight: '900' },
  focusCard: { borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  focusTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  focusIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  focusIconText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  focusHeadCopy: { flex: 1 },
  focusKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  focusCategory: { fontSize: 12, fontWeight: '900', marginTop: 2 },
  focusTitle: { color: colors.navyDeep, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 15 },
  focusNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  focusActions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  softButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.64)', alignItems: 'center', justifyContent: 'center' },
  softButtonText: { color: colors.navyDeep, fontSize: 9, fontWeight: '900' },
  emptyTitle: { color: colors.navyDeep, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 15 },
  emptyCopy: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  addButton: { minHeight: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  addButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  editor: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 17, gap: 12 },
  editorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editorKicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  editorTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 2 },
  close: { color: colors.muted, fontSize: 28, fontWeight: '700' },
  categoryRow: { gap: 7, paddingVertical: 1 },
  categoryChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.white },
  categoryText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 13, color: colors.text, fontSize: 12 },
  noteInput: { minHeight: 96, paddingTop: 12 },
  editorActions: { flexDirection: 'row', gap: 8 },
  removeButton: { minWidth: 88, minHeight: 46, borderRadius: 15, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.red, fontSize: 10, fontWeight: '900' },
  saveButton: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  sectionHead: { marginTop: 3 },
  sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  historyCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 15 },
  historyRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11 },
  historyBorder: { borderTopWidth: 1, borderTopColor: colors.lineWarm },
  historyIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  historyIconText: { fontSize: 14, fontWeight: '900' },
  historyCopy: { flex: 1 },
  historyTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  historyMeta: { color: colors.muted, fontSize: 8, marginTop: 3 },
  historyEmpty: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.lineWarm, padding: 16 },
  historyEmptyText: { color: colors.muted, fontSize: 10, lineHeight: 16 },
});
