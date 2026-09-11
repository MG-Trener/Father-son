import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StoryHero } from '../components/StoryHero';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type Agreement = { id: string; created_by: string; title: string; note: string | null; created_at: string; archived_at: string | null };
type Confirmation = { agreement_id: string; user_id: string; confirmed_at: string };
const eventIdFromRpc = (data: unknown) => data && typeof data === 'object' && !Array.isArray(data) && typeof (data as Record<string, unknown>).event_id === 'string' ? (data as Record<string, unknown>).event_id as string : null;
const agreementsImage = require('../../assets/generated/utility-agreements.png');

export default function AgreementsScreen() {
  const { session } = useAuth();
  const { family, members } = useFamily();
  const [agreements, setAgreements] = useState<Agreement[]>([]); const [confirmations, setConfirmations] = useState<Confirmation[]>([]); const [title, setTitle] = useState(''); const [note, setNote] = useState(''); const [loading, setLoading] = useState(true); const [creating, setCreating] = useState(false); const [busyId, setBusyId] = useState<string | null>(null);
  const names = useMemo(() => new Map(members.map((m) => [m.user_id, m.display_name])), [members]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) { setLoading(false); return; }
    const { data, error } = await client.from('family_agreements').select('id,created_by,title,note,created_at,archived_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(40);
    if (error) { Alert.alert('Не удалось загрузить договорённости', error.message); setLoading(false); return; }
    const rows = (data ?? []) as Agreement[]; setAgreements(rows);
    const ids = rows.map((r) => r.id);
    if (!ids.length) setConfirmations([]); else { const result = await client.from('family_agreement_confirmations').select('agreement_id,user_id,confirmed_at').in('agreement_id', ids); if (!result.error) setConfirmations((result.data ?? []) as Confirmation[]); }
    setLoading(false);
  }, [family]);
  useEffect(() => { void load(); }, [load]);

  const confirmationsFor = (id: string) => confirmations.filter((c) => c.agreement_id === id);
  const active = (id: string) => members.length >= 2 && confirmationsFor(id).length >= members.length;
  const mine = (id: string) => confirmationsFor(id).some((c) => c.user_id === session?.user.id);
  const open = agreements.filter((a) => !a.archived_at); const archived = agreements.filter((a) => a.archived_at).slice(0, 6); const activeCount = open.filter((a) => active(a.id)).length;

  const createAgreement = async () => {
    const client = supabase;
    if (!client || !family || !session || creating) return;
    const clean = title.trim(); if (clean.length < 3) { Alert.alert('Слишком коротко', 'Сформулируй договорённость хотя бы несколькими словами.'); return; }
    setCreating(true);
    try { const { data, error } = await client.rpc('create_family_agreement', { p_family_id: family.id, p_title: clean, p_note: note.trim() || null }); if (error) throw error; const eventId = eventIdFromRpc(data); if (eventId) void notifyFamilyEvent(eventId); setTitle(''); setNote(''); await load(); }
    catch (e) { Alert.alert('Не удалось предложить', e instanceof Error ? e.message : 'Попробуй ещё раз.'); } finally { setCreating(false); }
  };

  const confirm = async (agreement: Agreement) => {
    const client = supabase; if (!client || busyId) return; setBusyId(agreement.id);
    try { const { data, error } = await client.rpc('confirm_family_agreement', { p_agreement_id: agreement.id }); if (error) throw error; const eventId = eventIdFromRpc(data); if (eventId) void notifyFamilyEvent(eventId); await load(); }
    catch (e) { Alert.alert('Не удалось подтвердить', e instanceof Error ? e.message : 'Попробуй ещё раз.'); } finally { setBusyId(null); }
  };

  const askArchive = (agreement: Agreement) => {
    const client = supabase; if (!client || busyId) return;
    Alert.alert('Убрать договорённость?', 'Она останется в истории, но перестанет считаться действующей.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Убрать', style: 'destructive', onPress: () => { void (async () => { setBusyId(agreement.id); try { const { error } = await client.rpc('archive_family_agreement', { p_agreement_id: agreement.id }); if (error) throw error; await load(); } catch (e) { Alert.alert('Не удалось убрать', e instanceof Error ? e.message : 'Попробуй ещё раз.'); } finally { setBusyId(null); } })(); } },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.topKicker}>КОМАНДА</Text><Text style={styles.topTitle}>Наши договорённости</Text></View></View>
    <StoryHero
      kicker="НЕ ПРАВИЛА · А ВЗАИМНОЕ СОГЛАСИЕ"
      title="То, о чём мы договорились друг с другом."
      subtitle="Предложение становится общим только после подтверждения обоих. Любой из вас может позже снять своё согласие."
      variant="team"
      emblemImage={agreementsImage}
      footer={<View style={styles.stats}><View><Text style={styles.statValue}>{activeCount}</Text><Text style={styles.statLabel}>действуют</Text></View><View style={styles.divider} /><View><Text style={styles.statValue}>{open.length - activeCount}</Text><Text style={styles.statLabel}>ждут согласия</Text></View></View>}
    />
    <View style={[styles.create, shadows.soft]}><View style={styles.createHead}><View><Text style={styles.kicker}>ПРЕДЛОЖИТЬ</Text><Text style={styles.sectionTitle}>Новая договорённость</Text></View><Image source={agreementsImage} style={styles.createImage} resizeMode="contain" /></View><Text style={styles.helper}>Предложив её, ты сразу подтверждаешь своё согласие. После отправки текст не меняется.</Text><TextInput value={title} onChangeText={setTitle} maxLength={140} placeholder="Например: если злимся — говорим, когда вернёмся к разговору" placeholderTextColor={colors.mutedSoft} style={styles.input} /><TextInput value={note} onChangeText={setNote} maxLength={1200} multiline textAlignVertical="top" placeholder="Почему это важно? Необязательно." placeholderTextColor={colors.mutedSoft} style={[styles.input, styles.note]} /><Pressable disabled={creating} onPress={() => void createAgreement()} style={[styles.primary, creating && { opacity: 0.5 }]}>{creating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Предложить друг другу →</Text>}</Pressable></View>
    <View style={styles.sectionHead}><View><Text style={styles.kicker}>МЕЖДУ НАМИ</Text><Text style={styles.sectionTitle}>Сейчас</Text></View><View style={styles.count}><Text style={styles.countText}>{open.length}</Text></View></View>
    {open.length ? open.map((a) => { const yes = confirmationsFor(a.id); const isActive = active(a.id); const myYes = mine(a.id); const creator = names.get(a.created_by) ?? 'Участник'; return <View key={a.id} style={[styles.card, isActive && styles.cardActive, shadows.soft]}><View style={styles.rowBetween}><View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeWait]}><Text style={[styles.badgeText, { color: isActive ? colors.green : '#9A6A1B' }]}>{isActive ? 'НАША ДОГОВОРЁННОСТЬ' : 'ЖДЁМ СОГЛАСИЯ'}</Text></View><Pressable disabled={busyId === a.id} onPress={() => askArchive(a)}><Text style={styles.archive}>Убрать</Text></Pressable></View><View style={styles.agreementHead}><Image source={agreementsImage} style={styles.agreementImage} resizeMode="contain" /><Text style={styles.agreementTitle}>{a.title}</Text></View>{a.note ? <Text style={styles.copy}>{a.note}</Text> : null}<Text style={styles.proposed}>Предложил: {creator}</Text><View style={styles.people}>{members.map((m) => { const ok = yes.some((c) => c.user_id === m.user_id); return <View key={m.user_id} style={styles.person}><View style={[styles.avatar, ok && styles.avatarYes]}><Text style={{ color: ok ? colors.green : colors.muted, fontWeight: '900' }}>{m.display_name.slice(0, 1).toUpperCase()}</Text></View><View><Text style={styles.personName}>{m.display_name}</Text><Text style={[styles.personState, ok && { color: colors.green }]}>{ok ? 'согласен ✓' : 'ещё не подтвердил'}</Text></View></View>; })}</View>{!myYes ? <Pressable disabled={busyId === a.id} onPress={() => void confirm(a)} style={[styles.confirm, busyId === a.id && { opacity: 0.5 }]}>{busyId === a.id ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>Я согласен с этим</Text>}</Pressable> : !isActive ? <Text style={styles.waiting}>Твоё согласие уже есть. Теперь решение за вторым участником.</Text> : null}</View>; }) : <View style={styles.empty}><Image source={agreementsImage} style={styles.emptyImage} resizeMode="contain" /><Text style={styles.emptyTitle}>Пока без формальных договорённостей</Text><Text style={styles.copy}>Они нужны только там, где помогают быть понятнее друг другу.</Text></View>}
    {archived.length ? <View style={[styles.archiveCard, shadows.soft]}><Text style={styles.kicker}>БЫЛО ВАЖНО РАНЬШЕ</Text>{archived.map((a, i) => <View key={a.id} style={[styles.archiveRow, i > 0 && styles.border]}><Image source={agreementsImage} style={styles.archiveImage} resizeMode="contain" /><View style={{ flex: 1 }}><Text style={styles.archiveTitle}>{a.title}</Text><Text style={styles.archiveMeta}>Снята, но остаётся частью истории</Text></View></View>)}</View> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, content: { padding: 16, paddingBottom: 38, gap: 16 }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center' }, top: { flexDirection: 'row', alignItems: 'center', gap: 11 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 31, color: colors.navyDeep }, topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 }, topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  stats: { flexDirection: 'row', gap: 18, alignItems: 'center' }, statValue: { color: colors.white, fontSize: 23, fontWeight: '900' }, statLabel: { color: '#BFD2D4', fontSize: 8 }, divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  create: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm, gap: 10 }, createHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, createImage: { width: 66, height: 66 }, kicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900' }, helper: { color: colors.muted, fontSize: 9, lineHeight: 14 }, input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, color: colors.text }, note: { minHeight: 88, paddingTop: 11 }, primary: { minHeight: 46, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, count: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, countText: { color: colors.navyDeep, fontSize: 11, fontWeight: '900' }, card: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm }, cardActive: { borderColor: '#BBD9C7', backgroundColor: '#FBFFFC' }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, badge: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 }, badgeActive: { backgroundColor: colors.mint }, badgeWait: { backgroundColor: '#FFF0CF' }, badgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.6 }, archive: { color: colors.muted, fontSize: 8, fontWeight: '900' }, agreementHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }, agreementImage: { width: 54, height: 54 }, agreementTitle: { flex: 1, color: colors.navyDeep, fontSize: 19, lineHeight: 24, fontWeight: '900' }, copy: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 }, proposed: { color: colors.mutedSoft, fontSize: 8, marginTop: 9 }, people: { gap: 9, marginTop: 15 }, person: { flexDirection: 'row', alignItems: 'center', gap: 9 }, avatar: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' }, avatarYes: { backgroundColor: colors.mint }, personName: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' }, personState: { color: colors.mutedSoft, fontSize: 8 }, confirm: { minHeight: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 15 }, confirmText: { color: colors.white, fontSize: 10, fontWeight: '900' }, waiting: { color: colors.muted, fontSize: 9, lineHeight: 14, backgroundColor: colors.sandWarm, padding: 11, borderRadius: 14, marginTop: 15, textAlign: 'center' },
  empty: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.lineWarm }, emptyImage: { width: 84, height: 84 }, emptyTitle: { color: colors.navyDeep, fontSize: 16, fontWeight: '900', marginTop: 5 }, archiveCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 16, borderWidth: 1, borderColor: colors.lineWarm }, archiveRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9 }, border: { borderTopWidth: 1, borderTopColor: colors.lineWarm }, archiveImage: { width: 42, height: 42, opacity: 0.68 }, archiveTitle: { color: colors.text, fontSize: 10, fontWeight: '800' }, archiveMeta: { color: colors.mutedSoft, fontSize: 7, marginTop: 2 },
});
