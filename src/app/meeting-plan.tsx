import { useCallback, useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import { AppCard } from '../components/AppCard';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type Meeting = {
  id: string;
  meeting_date: string;
  title: string;
  note: string | null;
};

type MeetingIdea = {
  id: string;
  title: string;
  reaction: 'want' | 'must' | 'maybe' | null;
};

const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const prettyDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function MeetingPlanScreen() {
  const { session } = useAuth();
  const { family } = useFamily();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [ideas, setIdeas] = useState<MeetingIdea[]>([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('Наша встреча');
  const [note, setNote] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('meetings')
      .select('id,meeting_date,title,note')
      .eq('family_id', family.id)
      .eq('status', 'planned')
      .gte('meeting_date', todayIso())
      .order('meeting_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      Alert.alert('Не удалось загрузить встречу', error.message);
      setLoading(false);
      return;
    }

    const nextMeeting = data as Meeting | null;
    setMeeting(nextMeeting);
    if (nextMeeting) {
      setDate(nextMeeting.meeting_date);
      setTitle(nextMeeting.title);
      setNote(nextMeeting.note ?? '');

      const ideasResult = await supabase
        .from('meeting_ideas')
        .select('id,title,reaction')
        .eq('meeting_id', nextMeeting.id)
        .order('created_at', { ascending: true });
      if (!ideasResult.error) setIdeas((ideasResult.data ?? []) as MeetingIdea[]);
    } else {
      setIdeas([]);
    }
    setLoading(false);
  }, [family]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMeeting = async () => {
    if (!supabase || !family || !session || busy) return;
    if (!validDate(date)) {
      Alert.alert('Проверь дату', 'Введите дату в формате ГГГГ-ММ-ДД, например 2026-09-20.');
      return;
    }
    if (date < todayIso()) {
      Alert.alert('Проверь дату', 'Следующая встреча не может быть в прошлом.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Добавь название', 'Например: «Наш выходной» или «Футбол и пицца».');
      return;
    }

    setBusy(true);
    try {
      if (meeting) {
        const { error } = await supabase
          .from('meetings')
          .update({ meeting_date: date, title: title.trim(), note: note.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', meeting.id)
          .eq('family_id', family.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('meetings')
          .insert({
            family_id: family.id,
            created_by: session.user.id,
            meeting_date: date,
            title: title.trim(),
            note: note.trim() || null,
          })
          .select('id,meeting_date,title,note')
          .single();
        if (error) throw error;
        setMeeting(data as Meeting);

        const { error: eventError } = await supabase.from('activity_events').insert({
          family_id: family.id,
          actor_user_id: session.user.id,
          event_type: 'meeting_created',
          category: 'together',
          payload: { meeting_date: date, title: title.trim() },
        });
        if (eventError) throw eventError;
      }

      await load();
      Alert.alert('Готово', 'Следующая встреча сохранена для вашей команды.');
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const addIdea = async () => {
    if (!supabase || !family || !session || !meeting || busy || !newIdea.trim()) return;

    setBusy(true);
    try {
      const { error } = await supabase.from('meeting_ideas').insert({
        meeting_id: meeting.id,
        family_id: family.id,
        created_by: session.user.id,
        title: newIdea.trim(),
        reaction: 'want',
      });
      if (error) throw error;
      setNewIdea('');
      await load();
    } catch (caught) {
      Alert.alert('Не удалось добавить идею', caught instanceof Error ? caught.message : 'Попробуйте ещё раз.');
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
              <Text style={styles.title}>Следующая встреча</Text>
              <Text style={styles.subtitle}>Планы, которых приятно ждать вместе.</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
          ) : (
            <>
              {meeting ? (
                <View style={styles.dateHero}>
                  <Text style={styles.dateHeroLabel}>ВСТРЕЧА ЗАПЛАНИРОВАНА</Text>
                  <Text style={styles.dateHeroValue}>{prettyDate(meeting.meeting_date)}</Text>
                  <Text style={styles.dateHeroTitle}>{meeting.title}</Text>
                </View>
              ) : null}

              <AppCard title={meeting ? 'Изменить план' : 'Запланировать встречу'}>
                <Text style={styles.label}>Дата</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="2026-09-20"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  keyboardType="numbers-and-punctuation"
                />
                <Text style={styles.label}>Название</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Наш выходной"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Заметка</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Что хочется успеть вместе?"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.noteInput]}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void saveMeeting()} disabled={busy}>
                  <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : meeting ? 'Сохранить изменения' : 'Запланировать'}</Text>
                </Pressable>
              </AppCard>

              {meeting ? (
                <AppCard title="Что сделаем вместе?" subtitle="Любой из вас может добавить идею">
                  {ideas.length ? (
                    <View style={styles.ideas}>
                      {ideas.map((idea) => (
                        <View key={idea.id} style={styles.ideaRow}>
                          <Text style={styles.ideaBullet}>🔥</Text>
                          <Text style={styles.ideaText}>{idea.title}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.empty}>Пока идей нет. Добавьте первую.</Text>
                  )}
                  <View style={styles.ideaComposer}>
                    <TextInput
                      value={newIdea}
                      onChangeText={setNewIdea}
                      placeholder="Например: сыграть в футбол"
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.ideaInput]}
                    />
                    <Pressable style={styles.addButton} onPress={() => void addIdea()} disabled={busy || !newIdea.trim()}>
                      <Text style={styles.addButtonText}>+</Text>
                    </Pressable>
                  </View>
                </AppCard>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  headerText: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  loader: { marginTop: 48 },
  dateHero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22 },
  dateHeroLabel: { color: '#C9D7D7', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  dateHeroValue: { color: colors.white, fontSize: 27, fontWeight: '900', marginTop: 6 },
  dateHeroTitle: { color: '#E7EEEE', fontSize: 14, marginTop: 6 },
  label: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: -5 },
  input: { minHeight: 49, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  noteInput: { minHeight: 92, paddingTop: 13, paddingBottom: 13 },
  primary: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  disabled: { opacity: 0.55 },
  ideas: { gap: 7 },
  ideaRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  ideaBullet: { fontSize: 13, marginTop: 2 },
  ideaText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.muted, fontSize: 13 },
  ideaComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ideaInput: { flex: 1 },
  addButton: { width: 49, height: 49, borderRadius: 16, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: colors.navyDeep, fontSize: 27, fontWeight: '900', lineHeight: 29 },
});
