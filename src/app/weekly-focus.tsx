import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type Category = 'school' | 'football' | 'chess' | 'english' | 'leadership' | 'together';
type Slot = 'child' | 'together';
type Focus = { id: string; created_by: string; target_user_id: string | null; category: Category; title: string; note: string | null; week_start: string };

const meta: Record<Category, { title: string; icon: string; base: string; ink: string }> = {
  school: { title: 'Школа', icon: '📘', base: '#DCEFFF', ink: '#2E6286' },
  football: { title: 'Футбол', icon: '⚽', base: '#DDF4E6', ink: '#356B50' },
  chess: { title: 'Шахматы', icon: '♞', base: '#EAE5FA', ink: '#5B5091' },
  english: { title: 'English', icon: 'EN', base: '#FFF1C9', ink: '#98661A' },
  leadership: { title: 'Лидерство', icon: '🧭', base: '#FFE2D8', ink: '#945345' },
  together: { title: 'Папа & Я', icon: '♥', base: '#FFF0CF', ink: '#A56E16' },
};

const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const currentMonday = () => {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return localIso(d);
};
const weekLabel = (iso: string) => {
  const start = new Date(`${iso}T12:00:00`); const end = new Date(start); end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
};

export default function WeeklyFocusScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const child = useMemo(() => members.find((m) => m.role === 'child') ?? null, [members]);
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
    if (!supabase || !family) { setLoading(false); return; }
    const { data, error } = await supabase.from('weekly_focuses')
      .select('id,created_by,target_user_id,category,title,note,week_start')
      .eq('family_id', family.id).lte('week_start', weekStart).order('week_start', { ascending: false }).limit(24);
    if (error) Alert.alert('Не удалось загрузить фокус недели', error.message);
    else setRows((data ?? []) as Focus[]);
    setLoading(false);
  }, [family, weekStart]);
  useEffect(() => { void load(); }, [load]);

  const childFocus = rows.find((r) => r.week_start === weekStart && r.target_user_id === child?.user_id) ?? null;
  const togetherFocus = rows.find((r) => r.week_start === weekStart && r.target_user_id === null) ?? null;
  const previous = rows.filter((r) => r.week_start < weekStart).slice(0, 8);
  const currentFor = (slot: Slot) => slot === 'child' ? childFocus : togetherFocus;
  const editingFocus = editing ? currentFor(editing) : null;

  const openEditor = (slot: Slot) => {
    const current = currentFor(slot);
    setEditing(slot); setCategory(current?.category ?? (slot === 'together' ? 'together' : 'school'));
    setTitle(current?.title ?? ''); setNote(current?.note ?? '');
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || !session || !editing || !child || busy) return;
    const clean = title.trim();
    if (!clean) { Alert.alert('Нужен ориентир', 'Напиши одну короткую вещь на эту неделю.'); return; }
    setBusy(true);
    try {
      const existing = currentFor(editing);
      if (existing) {
        const { error } = await client.from('weekly_focuses').update({ category, title: clean, note: note.trim() || null, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const target = editing === 'child' ? child.user_id : null;
        const { error } = await client.from('weekly_focuses').insert({ family_id: family.id, created_by: session.user.id, target_user_id: target, category, title: clean, note: note.trim() || null, week_start: weekStart });
        if (error) throw error;
        await client.from('activity_events').insert({ family_id: family.id, actor_user_id: session.user.id, event_type: 'weekly_focus_added', category, payload: { title: clean, week_start: weekStart, scope: editing, target_user_id: target } });
      }
      setEditing(null); setTitle(''); setNote(''); await load();
    } catch (e) { Alert.alert('Не удалось сохранить', e instanceof Error ? e.message : 'Попробуй ещё раз.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    const client = supabase;
    if (!client || !editingFocus || busy) return;
    setBusy(true);
    try { const { error } = await client.from('weekly_focuses').delete().eq('id', editingFocus.id); if (error) throw error; setEditing(null); await load(); }
    catch (e) { Alert.alert('Не удалось убрать фокус', e instanceof Error ? e.message : 'Попробуй ещё раз.'); }
    finally { setBusy(false); }
  };

  const focusCard = (slot: Slot, focus: Focus | null) => {
    const m = focus ? meta[focus.category] : meta[slot === 'together' ? 'together' : 'school'];
    return <View style={[styles.card, shadows.soft, { backgroundColor: m.base }]}>
      <View style={styles.row}><View style={[styles.icon, { backgroundColor: m.ink }]}><Text style={styles.iconText}>{m.icon}</Text></View><View style={{ flex: 1 }}><Text style={[styles.kicker, { color: m.ink }]}>{slot === 'together' ? 'НАШ ФОКУС' : `ФОКУС ${childName.toUpperCase()}`}</Text><Text style={[styles.category, { color: m.ink }]}>{focus ? m.title : 'На эту неделю'}</Text></View></View>
      {focus ? <><Text style={styles.focusTitle}>{focus.title}</Text>{focus.note ? <Text style={styles.copy}>{focus.note}</Text> : null}<View style={styles.actions}><Pressable style={styles.soft} onPress={() => openEditor(slot)}><Text style={styles.softText}>Изменить</Text></Pressable><Pressable style={styles.soft} onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: `Что получилось с фокусом «${focus.title}» на этой неделе?` } })}><Text style={styles.softText}>Подвести итог</Text></Pressable></View></>
        : <><Text style={styles.emptyTitle}>{slot === 'together' ? 'Что важно прожить вместе?' : `На чём ${childName} хочет сосредоточиться?`}</Text><Text style={styles.copy}>Не задача и не обещание — просто ориентир, к которому можно возвращаться.</Text><Pressable style={[styles.primary, { backgroundColor: m.ink }]} onPress={() => openEditor(slot)}><Text style={styles.primaryText}>Задать фокус →</Text></Pressable></>}
    </View>;
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.topKicker}>РАЗВИТИЕ БЕЗ ГОНКИ</Text><Text style={styles.topTitle}>Фокус недели</Text></View></View>
    <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}><Text style={styles.heroKicker}>НЕДЕЛЯ · {weekLabel(weekStart).toUpperCase()}</Text><Text style={styles.heroTitle}>Два ориентира вместо списка обязанностей.</Text><Text style={styles.heroText}>Один для {childName}, один для вас двоих. Пауза ничего не обнуляет.</Text><Text style={styles.rule}>Без XP · без серии · без «провалено»</Text></LinearGradient>
    {focusCard('child', childFocus)}{focusCard('together', togetherFocus)}
    {editing ? <View style={[styles.editor, shadows.soft]}><View style={styles.rowBetween}><Text style={styles.editorTitle}>{editing === 'child' ? `Фокус ${childName}` : 'Наш общий фокус'}</Text><Pressable onPress={() => setEditing(null)}><Text style={styles.close}>×</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(Object.keys(meta) as Category[]).map((key) => <Pressable key={key} onPress={() => setCategory(key)} style={[styles.chip, category === key && { backgroundColor: meta[key].base, borderColor: meta[key].ink }]}><Text style={{ color: category === key ? meta[key].ink : colors.muted, fontSize: 9, fontWeight: '900' }}>{meta[key].icon} {meta[key].title}</Text></Pressable>)}</ScrollView><TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Например: спокойно готовиться к контрольной" placeholderTextColor={colors.mutedSoft} style={styles.input} /><TextInput value={note} onChangeText={setNote} maxLength={600} multiline textAlignVertical="top" placeholder="Что поможет удержать ориентир? Необязательно." placeholderTextColor={colors.mutedSoft} style={[styles.input, styles.note]} /><View style={styles.actions}>{editingFocus ? <Pressable disabled={busy} style={styles.remove} onPress={() => void remove()}><Text style={styles.removeText}>Убрать</Text></Pressable> : null}<Pressable disabled={busy} style={[styles.save, busy && { opacity: 0.5 }]} onPress={() => void save()}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Сохранить</Text>}</Pressable></View></View> : null}
    <View><Text style={styles.topKicker}>БЕЗ СЕРИЙ</Text><Text style={styles.sectionTitle}>Предыдущие недели</Text></View>
    {previous.length ? <View style={[styles.history, shadows.soft]}>{previous.map((f, i) => <View key={f.id} style={[styles.historyRow, i > 0 && styles.border]}><Text style={styles.historyIcon}>{meta[f.category].icon}</Text><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{f.title}</Text><Text style={styles.historyMeta}>{weekLabel(f.week_start)} · {f.target_user_id ? childName : 'Папа & Я'}</Text></View></View>)}</View> : <Text style={styles.copy}>После первой недели здесь останутся старые ориентиры — как следы пути, а не отчёт.</Text>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, content: { padding: 16, paddingBottom: 38, gap: 15 }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 11 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }, backText: { fontSize: 31, color: colors.navyDeep }, topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  hero: { minHeight: 225, borderRadius: radius.xl, padding: 21 }, heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 10 }, heroText: { color: '#D8E6E7', fontSize: 11, lineHeight: 17, marginTop: 8 }, rule: { color: '#DDEBEC', fontSize: 8, fontWeight: '900', marginTop: 'auto' },
  card: { borderRadius: radius.xl, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, iconText: { color: colors.white, fontWeight: '900' }, kicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, category: { fontSize: 12, fontWeight: '900', marginTop: 2 }, focusTitle: { color: colors.navyDeep, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 14 }, emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 14 }, copy: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, soft: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.66)', alignItems: 'center', justifyContent: 'center' }, softText: { color: colors.navyDeep, fontSize: 9, fontWeight: '900' }, primary: { minHeight: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  editor: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm, gap: 11 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, editorTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900' }, close: { fontSize: 28, color: colors.muted }, chips: { gap: 7 }, chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.white }, input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.text }, note: { minHeight: 90, paddingTop: 11 }, remove: { minWidth: 85, minHeight: 44, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' }, removeText: { color: colors.red, fontSize: 9, fontWeight: '900' }, save: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' }, saveText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900' }, history: { backgroundColor: colors.paper, borderRadius: radius.xl, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.lineWarm }, historyRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 }, border: { borderTopWidth: 1, borderTopColor: colors.lineWarm }, historyIcon: { fontSize: 18, width: 30 }, historyTitle: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' }, historyMeta: { color: colors.muted, fontSize: 8, marginTop: 2 },
});
