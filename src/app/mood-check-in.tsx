import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  View
} from 'react-native';
import { Button, Card, Chip, Heading, Page, Section, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';

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

  return <Page refreshing={refreshing || loading} onRefresh={refresh}>
    <Heading title="Как ты сегодня?" subtitle="Можно выбрать настроение и ничего не объяснять." back />
    <Card>
      <View style={ui.wrap}>{(Object.keys(moodMeta) as MoodValue[]).map(value => <Chip key={value} label={moodMeta[value].emoji + ' ' + moodMeta[value].label} selected={selected === value} onPress={() => setSelected(value)} />)}</View>
      <Text style={ui.rowTitle}>Пара слов, если хочется</Text>
      <TextInput accessibilityLabel="Пара слов о настроении" style={[ui.input, ui.textArea]} value={note} onChangeText={setNote} multiline maxLength={200} placeholder="Например: устал, давай поговорим вечером" />
      <Text style={ui.caption}>Настроение и заметку увидит второй участник семьи.</Text>
      <Button label="Поделиться настроением" busy={busy} disabled={!selected} onPress={() => void save()} />
    </Card>
    <Section title="Последние отметки">{[parentMood, childMood].filter((row): row is MoodRow => Boolean(row)).map(row => <Card key={row.id}><Text style={ui.rowTitle}>{names.get(row.user_id) ?? 'Участник'}: {moodMeta[row.mood].label}</Text><Text style={ui.caption}>{prettyMoment(row.created_at)}</Text>{row.note ? <Text style={ui.body}>{row.note}</Text> : null}</Card>)}</Section>
  </Page>;
}
