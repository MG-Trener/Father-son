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

const daysUntil = (value: string) => {
  if (!validDate(value)) return null;
  const target = new Date(`${value}T00:00:00`).getTime();
  const today = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.max(0, Math.ceil((target - today) / 86_400_000));
};

export default function MeetingPlanScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [ideas, setIdeas] = useState<MeetingIdea[]>([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('Наша встреча');
  const [note, setNote] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);
  const countdown = daysUntil(date || meeting?.meeting_date || '');

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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.topTitle}>Следующая встреча</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
          ) : (
            <>
              <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
                <View style={styles.orbLarge} />
                <View style={styles.orbSmall} />
                <View style={styles.heroKickerRow}>
                  <Text style={styles.heroKicker}>{meeting ? 'ВСТРЕЧА ЗАПЛАНИРОВАНА' : 'СЛЕДУЮЩАЯ ГЛАВА'}</Text>
                  {countdown !== null ? (
                    <View style={styles.countdownBadge}>
                      <Text style={styles.countdownValue}>{countdown}</Text>
                      <Text style={styles.countdownLabel}>{countdown === 1 ? 'день' : 'дней'}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.teamRoute}>
                  <View style={styles.personBox}>
                    <View style={[styles.avatar, styles.avatarDad]}><Text style={styles.avatarText}>М</Text></View>
                    <Text style={styles.personName}>{parent?.display_name ?? 'Михаил'}</Text>
                  </View>
                  <View style={styles.routeWrap}>
                    <View style={styles.routeLine} />
                    <View style={styles.routePin}><Text style={styles.routePinText}>⌖</Text></View>
                    <View style={styles.routeLine} />
                  </View>
                  <View style={styles.personBox}>
                    <View style={[styles.avatar, styles.avatarSon]}><Text style={styles.avatarText}>А</Text></View>
                    <Text style={styles.personName}>{child?.display_name ?? 'Артур'}</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle}>{meeting?.title ?? 'Придумаем, чего ждать вместе'}</Text>
                <Text style={styles.heroDate}>{meeting ? prettyDate(meeting.meeting_date) : 'Выберите дату и создайте ожидание, которое будет вашим.'}</Text>
              </LinearGradient>

              <View style={[styles.formCard, shadows.soft]}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}><Text style={styles.sectionIconText}>⌖</Text></View>
                  <View style={styles.sectionText}>
                    <Text style={styles.sectionTitle}>{meeting ? 'Обновить план' : 'Запланировать встречу'}</Text>
                    <Text style={styles.sectionCopy}>Дата, идея и маленькая деталь, которая сделает встречу вашей.</Text>
                  </View>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Дата</Text>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="2026-09-20"
                    placeholderTextColor={colors.mutedSoft}
                    style={styles.input}
                    keyboardType="numbers-and-punctuation"
                  />
                  {validDate(date) ? <Text style={styles.fieldHint}>{prettyDate(date)}</Text> : null}
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Название</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Наш выходной"
                    placeholderTextColor={colors.mutedSoft}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Что хочется успеть вместе</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Футбол, пицца, разговор, прогулка…"
                    placeholderTextColor={colors.mutedSoft}
                    style={[styles.input, styles.noteInput]}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void saveMeeting()} disabled={busy}>
                  <LinearGradient colors={gradients.connection} style={styles.primaryGradient}>
                    <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : meeting ? 'Сохранить нашу встречу' : 'Начать ждать вместе'}</Text>
                    {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
                  </LinearGradient>
                </Pressable>
              </View>

              {meeting ? (
                <View style={[styles.ideasCard, shadows.soft]}>
                  <View style={styles.ideaHeader}>
                    <View>
                      <Text style={styles.ideaKicker}>НАША КОПИЛКА</Text>
                      <Text style={styles.ideaTitle}>Что сделаем вместе?</Text>
                    </View>
                    <View style={styles.ideaCount}><Text style={styles.ideaCountText}>{ideas.length}</Text></View>
                  </View>

                  {ideas.length ? (
                    <View style={styles.ideas}>
                      {ideas.map((idea, index) => (
                        <View key={idea.id} style={styles.ideaRow}>
                          <View style={[styles.ideaNumber, index % 2 === 0 ? styles.ideaNumberWarm : styles.ideaNumberCool]}>
                            <Text style={styles.ideaNumberText}>{index + 1}</Text>
                          </View>
                          <Text style={styles.ideaText}>{idea.title}</Text>
                          <Text style={styles.ideaSpark}>✦</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>✦</Text>
                      <Text style={styles.empty}>Пока идей нет. Добавьте первую — даже самую маленькую.</Text>
                    </View>
                  )}

                  <View style={styles.ideaComposer}>
                    <TextInput
                      value={newIdea}
                      onChangeText={setNewIdea}
                      placeholder="Например: сыграть в футбол"
                      placeholderTextColor={colors.mutedSoft}
                      style={[styles.input, styles.ideaInput]}
                    />
                    <Pressable style={[styles.addButton, (!newIdea.trim() || busy) && styles.addButtonDisabled]} onPress={() => void addIdea()} disabled={busy || !newIdea.trim()}>
                      <Text style={styles.addButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.footerCard}>
                <Text style={styles.footerIcon}>∞</Text>
                <Text style={styles.footerText}>Встреча — это не отчёт. Здесь храним только то, чего хочется ждать и потом вспоминать.</Text>
              </View>
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  loader: { marginTop: 48 },
  hero: { minHeight: 315, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'space-between' },
  orbLarge: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,215,106,0.10)', top: -64, right: -45 },
  orbSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', bottom: 38, left: -45 },
  heroKickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroKicker: { color: colors.sun, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, maxWidth: '60%' },
  countdownBadge: { minWidth: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  countdownValue: { color: colors.white, fontSize: 19, fontWeight: '900', lineHeight: 21 },
  countdownLabel: { color: '#BFD3D7', fontSize: 8, fontWeight: '800' },
  teamRoute: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  personBox: { width: 70, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarDad: { backgroundColor: colors.tealBright },
  avatarSon: { backgroundColor: colors.orange },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  personName: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 6 },
  routeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  routeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  routePin: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  routePinText: { color: colors.navyDeep, fontSize: 17, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '900', letterSpacing: -0.6, maxWidth: '90%' },
  heroDate: { color: '#D7E6E8', fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: '90%' },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 15, borderWidth: 1, borderColor: colors.lineWarm },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sectionIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { color: colors.green, fontSize: 19, fontWeight: '900' },
  sectionText: { flex: 1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  sectionCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  fieldWrap: { gap: 6 },
  label: { color: colors.text, fontSize: 11, fontWeight: '900' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  noteInput: { minHeight: 92, paddingTop: 13, paddingBottom: 13 },
  fieldHint: { color: colors.teal, fontSize: 9, fontWeight: '800', paddingLeft: 2 },
  primary: { borderRadius: radius.md, overflow: 'hidden' },
  primaryGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryText: { color: colors.navyDeep, fontWeight: '900', fontSize: 14 },
  primaryArrow: { color: colors.navyDeep, fontWeight: '900', fontSize: 20 },
  disabled: { opacity: 0.55 },
  ideasCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 15, borderWidth: 1, borderColor: colors.lineWarm },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ideaKicker: { color: colors.orange, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  ideaTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 2 },
  ideaCount: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  ideaCountText: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' },
  ideas: { gap: 8 },
  ideaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: 11, borderWidth: 1, borderColor: colors.line },
  ideaNumber: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ideaNumberWarm: { backgroundColor: '#FFF0D4' },
  ideaNumberCool: { backgroundColor: '#E6F1F1' },
  ideaNumberText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  ideaText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  ideaSpark: { color: colors.amber, fontSize: 13 },
  emptyState: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.sandWarm, borderRadius: radius.md, padding: 13 },
  emptyIcon: { color: colors.amber, fontSize: 18 },
  empty: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  ideaComposer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ideaInput: { flex: 1 },
  addButton: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  addButtonDisabled: { opacity: 0.45 },
  addButtonText: { color: colors.navyDeep, fontSize: 27, fontWeight: '900', lineHeight: 29 },
  footerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14 },
  footerIcon: { color: colors.green, fontSize: 24, fontWeight: '900' },
  footerText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
});
