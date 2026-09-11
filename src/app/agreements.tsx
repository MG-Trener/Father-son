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

type Agreement = {
  id: string;
  created_by: string;
  title: string;
  note: string | null;
  created_at: string;
  archived_at: string | null;
};

type Confirmation = {
  agreement_id: string;
  user_id: string;
  confirmed_at: string;
};

export default function AgreementsScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const activeMembers = members.length;

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('family_agreements')
      .select('id,created_by,title,note,created_at,archived_at')
      .eq('family_id', family.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) {
      Alert.alert('Не удалось загрузить договорённости', error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Agreement[];
    setAgreements(rows);
    const ids = rows.map((row) => row.id);
    if (!ids.length) {
      setConfirmations([]);
    } else {
      const result = await supabase
        .from('family_agreement_confirmations')
        .select('agreement_id,user_id,confirmed_at')
        .in('agreement_id', ids);
      if (!result.error) setConfirmations((result.data ?? []) as Confirmation[]);
    }
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const confirmationsFor = (id: string) => confirmations.filter((item) => item.agreement_id === id);
  const isActive = (id: string) => activeMembers >= 2 && confirmationsFor(id).length >= activeMembers;
  const meConfirmed = (id: string) => confirmationsFor(id).some((item) => item.user_id === session?.user.id);

  const openAgreements = useMemo(() => agreements.filter((item) => !item.archived_at), [agreements]);
  const archived = useMemo(() => agreements.filter((item) => item.archived_at).slice(0, 6), [agreements]);
  const activeCount = useMemo(() => openAgreements.filter((item) => isActive(item.id)).length, [openAgreements, confirmations, activeMembers]);

  const createAgreement = async () => {
    if (!supabase || !family || !session || creating) return;
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      Alert.alert('Слишком коротко', 'Сформулируй договорённость хотя бы несколькими словами.');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.rpc('create_family_agreement', {
        p_family_id: family.id,
        p_title: cleanTitle,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      setTitle('');
      setNote('');
      await load();
    } catch (caught) {
      Alert.alert('Не удалось предложить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setCreating(false);
    }
  };

  const confirmAgreement = async (agreement: Agreement) => {
    if (!supabase || busyId) return;
    setBusyId(agreement.id);
    try {
      const { error } = await supabase.rpc('confirm_family_agreement', { p_agreement_id: agreement.id });
      if (error) throw error;
      await load();
    } catch (caught) {
      Alert.alert('Не удалось подтвердить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusyId(null);
    }
  };

  const archiveAgreement = (agreement: Agreement) => {
    if (!supabase || busyId) return;
    Alert.alert(
      'Убрать договорённость?',
      'Она останется в истории, но больше не будет считаться действующей.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Убрать',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(agreement.id);
              try {
                const { error } = await supabase.rpc('archive_family_agreement', { p_agreement_id: agreement.id });
                if (error) throw error;
                await load();
              } catch (caught) {
                Alert.alert('Не удалось убрать', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
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
            <View><Text style={styles.topKicker}>КОМАНДА</Text><Text style={styles.topTitle}>Наши договорённости</Text></View>
          </View>

          <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroKicker}>НЕ ПРАВИЛА · А ВЗАИМНОЕ СОГЛАСИЕ</Text>
            <Text style={styles.heroTitle}>То, о чём мы договорились друг с другом.</Text>
            <Text style={styles.heroText}>Предложение становится общей договорённостью только после подтверждения обоих. Любой из вас может позже сказать: «Это больше не подходит».</Text>
            <View style={styles.heroStats}>
              <View><Text style={styles.heroValue}>{activeCount}</Text><Text style={styles.heroLabel}>действуют</Text></View>
              <View style={styles.heroDivider} />
              <View><Text style={styles.heroValue}>{openAgreements.length - activeCount}</Text><Text style={styles.heroLabel}>ждут согласия</Text></View>
            </View>
          </LinearGradient>

          <View style={[styles.createCard, shadows.soft]}>
            <Text style={styles.kicker}>ПРЕДЛОЖИТЬ</Text>
            <Text style={styles.sectionTitle}>Новая договорённость</Text>
            <Text style={styles.helper}>Предложив её, ты сразу подтверждаешь своё согласие. После отправки текст не редактируется — чтобы смысл не менялся после чужого подтверждения.</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              placeholder="Например: если злимся — всё равно говорим, когда вернёмся к разговору"
              placeholderTextColor={colors.mutedSoft}
              style={styles.input}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={1200}
              placeholder="Почему это важно для нас? Необязательно."
              placeholderTextColor={colors.mutedSoft}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.noteInput]}
            />
            <Pressable disabled={creating} style={[styles.createButton, creating && styles.disabled]} onPress={() => void createAgreement()}>
              {creating ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.createButtonText}>Предложить друг другу →</Text>}
            </Pressable>
          </View>

          <View style={styles.sectionHead}>
            <View><Text style={styles.kicker}>МЕЖДУ НАМИ</Text><Text style={styles.sectionTitle}>Сейчас</Text></View>
            <View style={styles.countBadge}><Text style={styles.countText}>{openAgreements.length}</Text></View>
          </View>

          {openAgreements.length ? openAgreements.map((agreement) => {
            const confirmed = confirmationsFor(agreement.id);
            const active = isActive(agreement.id);
            const mine = meConfirmed(agreement.id);
            const creator = names.get(agreement.created_by) ?? 'Участник';
            return (
              <View key={agreement.id} style={[styles.agreementCard, active && styles.agreementActive, shadows.soft]}>
                <View style={styles.agreementHead}>
                  <View style={[styles.stateBadge, active ? styles.activeBadge : styles.waitBadge]}>
                    <Text style={[styles.stateText, active ? styles.activeText : styles.waitText]}>{active ? 'НАША ДОГОВОРЁННОСТЬ' : 'ЖДЁМ СОГЛАСИЯ'}</Text>
                  </View>
                  <Pressable disabled={busyId === agreement.id} onPress={() => archiveAgreement(agreement)}><Text style={styles.archiveText}>Убрать</Text></Pressable>
                </View>
                <Text style={styles.agreementTitle}>{agreement.title}</Text>
                {agreement.note ? <Text style={styles.agreementNote}>{agreement.note}</Text> : null}
                <Text style={styles.proposedBy}>Предложил: {creator}</Text>

                <View style={styles.peopleRow}>
                  {members.map((member) => {
                    const yes = confirmed.some((item) => item.user_id === member.user_id);
                    return (
                      <View key={member.user_id} style={styles.person}>
                        <View style={[styles.personAvatar, yes && styles.personAvatarYes]}><Text style={[styles.personInitial, yes && styles.personInitialYes]}>{member.display_name.slice(0, 1).toUpperCase()}</Text></View>
                        <View><Text style={styles.personName}>{member.display_name}</Text><Text style={[styles.personState, yes && styles.personStateYes]}>{yes ? 'согласен ✓' : 'ещё не подтвердил'}</Text></View>
                      </View>
                    );
                  })}
                </View>

                {!mine ? (
                  <Pressable disabled={busyId === agreement.id} style={[styles.confirmButton, busyId === agreement.id && styles.disabled]} onPress={() => void confirmAgreement(agreement)}>
                    {busyId === agreement.id ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.confirmText}>Я согласен с этим 🤝</Text>}
                  </Pressable>
                ) : !active ? (
                  <View style={styles.waitingNote}><Text style={styles.waitingNoteText}>Твоё согласие уже есть. Теперь решение за вторым участником.</Text></View>
                ) : null}
              </View>
            );
          }) : (
            <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🤝</Text><Text style={styles.emptyTitle}>Пока без формальных договорённостей</Text><Text style={styles.emptyText}>Это нормально. Они нужны только там, где помогают быть понятнее друг другу.</Text></View>
          )}

          {archived.length ? (
            <View style={[styles.archiveCard, shadows.soft]}>
              <Text style={styles.kicker}>БЫЛО ВАЖНО РАНЬШЕ</Text>
              {archived.map((agreement, index) => (
                <View key={agreement.id} style={[styles.archiveRow, index > 0 && styles.archiveBorder]}>
                  <Text style={styles.archiveDot}>○</Text>
                  <View style={styles.archiveCopy}><Text style={styles.archiveTitle}>{agreement.title}</Text><Text style={styles.archiveMeta}>Снята, но остаётся частью вашей истории</Text></View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 1 },
  hero: { minHeight: 275, borderRadius: radius.xl, padding: 21, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,215,106,0.10)', right: -64, top: -72 },
  heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 26, lineHeight: 31, fontWeight: '900', marginTop: 10, maxWidth: '90%' },
  heroText: { color: '#D8E6E7', fontSize: 11, lineHeight: 17, marginTop: 9, maxWidth: '94%' },
  heroStats: { flexDirection: 'row', gap: 18, alignItems: 'center', marginTop: 'auto' },
  heroValue: { color: colors.white, fontSize: 23, fontWeight: '900' },
  heroLabel: { color: '#BFD2D4', fontSize: 8, fontWeight: '800' },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  createCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 17, gap: 11 },
  kicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  helper: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 13, color: colors.text, fontSize: 12 },
  noteInput: { minHeight: 90, paddingTop: 12 },
  createButton: { minHeight: 47, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  countBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' },
  agreementCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 17 },
  agreementActive: { borderColor: '#BBD9C7', backgroundColor: '#FBFFFC' },
  agreementHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateBadge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  activeBadge: { backgroundColor: colors.mint },
  waitBadge: { backgroundColor: '#FFF0CF' },
  stateText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  activeText: { color: colors.green },
  waitText: { color: '#9A6A1B' },
  archiveText: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  agreementTitle: { color: colors.navyDeep, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 14 },
  agreementNote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  proposedBy: { color: colors.mutedSoft, fontSize: 8, marginTop: 9 },
  peopleRow: { gap: 9, marginTop: 15 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  personAvatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  personAvatarYes: { backgroundColor: colors.mint },
  personInitial: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  personInitialYes: { color: colors.green },
  personName: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  personState: { color: colors.mutedSoft, fontSize: 8, marginTop: 1 },
  personStateYes: { color: colors.green, fontWeight: '800' },
  confirmButton: { minHeight: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  confirmText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  waitingNote: { backgroundColor: colors.sandWarm, borderRadius: 14, padding: 11, marginTop: 15 },
  waitingNoteText: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  emptyCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 20, alignItems: 'center' },
  emptyIcon: { fontSize: 31 },
  emptyTitle: { color: colors.navyDeep, fontSize: 16, fontWeight: '900', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 5, maxWidth: '88%' },
  archiveCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 16 },
  archiveRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9 },
  archiveBorder: { borderTopWidth: 1, borderTopColor: colors.lineWarm },
  archiveDot: { color: colors.mutedSoft, fontSize: 17 },
  archiveCopy: { flex: 1 },
  archiveTitle: { color: colors.text, fontSize: 10, fontWeight: '800' },
  archiveMeta: { color: colors.mutedSoft, fontSize: 7, marginTop: 2 },
});
