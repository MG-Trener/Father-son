import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

type FutureLetter = {
  id: string;
  family_id: string;
  author_user_id: string;
  recipient_user_id: string;
  title: string;
  unlock_at: string;
  status: 'draft' | 'sealed';
  created_at: string;
  sealed_at: string | null;
  opened_at: string | null;
};

const isUnlocked = (letter: FutureLetter) => letter.status === 'sealed' && new Date(letter.unlock_at).getTime() <= Date.now();
const prettyDate = (value: string) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const daysUntil = (value: string) => Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));

export default function LettersScreen() {
  const { family, members, me } = useFamily();
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const isChild = me?.role === 'child';

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('future_letters')
      .select('id,family_id,author_user_id,recipient_user_id,title,unlock_at,status,created_at,sealed_at,opened_at')
      .eq('family_id', family.id)
      .order('unlock_at', { ascending: true });
    if (error) Alert.alert('Не удалось загрузить письма', error.message);
    else setLetters((data ?? []) as FutureLetter[]);
    setLoading(false);
  }, [family]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const drafts = letters.filter((letter) => letter.status === 'draft' && letter.author_user_id === me?.user_id);
  const sealed = letters.filter((letter) => letter.status === 'sealed');

  const openLetter = (letter: FutureLetter) => {
    if (letter.status === 'draft') {
      if (letter.author_user_id === me?.user_id) router.push({ pathname: '/future-letter-new', params: { id: letter.id } });
      return;
    }
    if (!isUnlocked(letter)) {
      Alert.alert('Письмо запечатано 🔒', `Оно откроется ${prettyDate(letter.unlock_at)}. До этого момента даже текст не загружается в приложение.`);
      return;
    }
    if (me?.user_id !== letter.author_user_id && me?.user_id !== letter.recipient_user_id) {
      Alert.alert('Это личное письмо', 'Прочитать его смогут только автор и адресат после даты открытия.');
      return;
    }
    router.push({ pathname: '/future-letter-view', params: { id: letter.id } });
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}>
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.topCopy}><Text style={styles.topKicker}>ПАПА & Я · 11–18</Text><Text style={styles.topTitle}>Письма в будущее</Text></View>
          <Pressable style={styles.add} onPress={() => router.push('/future-letter-new')}><Text style={styles.addText}>＋</Text></Pressable>
        </View>

        <LinearGradient colors={['#183C55', '#315E71', '#D49A4B']} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEnvelope}>✉️</Text>
          <Text style={styles.heroTitle}>{isChild ? 'Некоторые слова лучше сохранить надолго' : 'Слова, которые дождутся своего времени'}</Text>
          <Text style={styles.heroText}>{isChild
            ? 'Напиши себе будущему или папе. После запечатывания письмо нельзя подсмотреть раньше даты открытия.'
            : `Можно оставить ${child?.display_name ?? 'сыну'} письмо на следующий день рождения, 15-летие, 18-летие — или любую важную дату.`}</Text>
          <Pressable style={styles.heroButton} onPress={() => router.push('/future-letter-new')}><Text style={styles.heroButtonText}>Написать письмо →</Text></Pressable>
        </LinearGradient>

        {drafts.length ? (
          <View>
            <Text style={styles.sectionKicker}>ЧЕРНОВИКИ</Text>
            <Text style={styles.sectionTitle}>Ещё не запечатаны</Text>
            <View style={styles.list}>
              {drafts.map((letter) => (
                <Pressable key={letter.id} style={[styles.draftCard, shadows.soft]} onPress={() => openLetter(letter)}>
                  <View style={styles.draftIcon}><Text style={styles.draftIconText}>✎</Text></View>
                  <View style={styles.cardCopy}><Text style={styles.cardTitle}>{letter.title}</Text><Text style={styles.cardMeta}>Для {names.get(letter.recipient_user_id) ?? 'адресата'} · открыть {prettyDate(letter.unlock_at)}</Text></View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionKicker}>КАПСУЛА ВРЕМЕНИ</Text>
          <Text style={styles.sectionTitle}>Запечатанные письма</Text>
          <View style={styles.list}>
            {sealed.map((letter) => {
              const unlocked = isUnlocked(letter);
              const accessible = me?.user_id === letter.author_user_id || me?.user_id === letter.recipient_user_id;
              return (
                <Pressable key={letter.id} style={[styles.letterCard, unlocked && accessible && styles.letterReady, shadows.soft]} onPress={() => openLetter(letter)}>
                  <View style={[styles.seal, unlocked && accessible && styles.sealReady]}><Text style={styles.sealText}>{unlocked && accessible ? '✦' : '🔒'}</Text></View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardEyebrow}>{names.get(letter.author_user_id) ?? 'Автор'} → {names.get(letter.recipient_user_id) ?? 'Адресат'}</Text>
                    <Text style={styles.cardTitle}>{letter.title}</Text>
                    <Text style={styles.cardMeta}>{unlocked ? (accessible ? 'Можно открыть сейчас' : 'Личное письмо') : `${prettyDate(letter.unlock_at)} · ещё ${daysUntil(letter.unlock_at)} дн.`}</Text>
                  </View>
                  <Text style={styles.chevron}>{unlocked && accessible ? '›' : ''}</Text>
                </Pressable>
              );
            })}
            {!sealed.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📮</Text>
                <Text style={styles.emptyTitle}>Первый конверт ещё впереди</Text>
                <Text style={styles.emptyText}>Письмо можно запечатать на конкретную дату. После этого содержимое действительно закрывается до срока.</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.ruleCard, shadows.soft]}>
          <Text style={styles.ruleIcon}>🔐</Text>
          <View style={styles.ruleCopy}><Text style={styles.ruleTitle}>Настоящая печать</Text><Text style={styles.ruleText}>После запечатывания текст письма недоступен через приложение до даты открытия. Конверт остаётся видимым, содержание — нет.</Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 19 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8DFD1' },
  backText: { color: colors.navyDeep, fontSize: 28, lineHeight: 28, fontWeight: '700', marginTop: -3 },
  topCopy: { flex: 1 },
  topKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  add: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  addText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  hero: { minHeight: 250, borderRadius: radius.xl, padding: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,220,130,0.13)', right: -55, top: -80 },
  heroEnvelope: { fontSize: 42, position: 'absolute', right: 22, top: 22 },
  heroTitle: { color: colors.white, fontSize: 26, lineHeight: 29, fontWeight: '900', maxWidth: '88%' },
  heroText: { color: '#E4ECEC', fontSize: 10, lineHeight: 15, marginTop: 8, maxWidth: '91%' },
  heroButton: { alignSelf: 'flex-start', backgroundColor: colors.white, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 15, marginTop: 16 },
  heroButtonText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  sectionKicker: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 2, marginBottom: 10 },
  list: { gap: 9 },
  draftCard: { minHeight: 76, borderRadius: 22, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  draftIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#E7F0F2', alignItems: 'center', justifyContent: 'center' },
  draftIconText: { color: colors.teal, fontSize: 18, fontWeight: '900' },
  letterCard: { minHeight: 93, borderRadius: 24, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  letterReady: { borderColor: '#D9B56F', backgroundColor: '#FFFBF1' },
  seal: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFE9DF', alignItems: 'center', justifyContent: 'center' },
  sealReady: { backgroundColor: colors.amber },
  sealText: { fontSize: 20 },
  cardCopy: { flex: 1 },
  cardEyebrow: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardTitle: { color: colors.navyDeep, fontSize: 13, lineHeight: 17, fontWeight: '900', marginTop: 2 },
  cardMeta: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  chevron: { color: colors.navy, fontSize: 24, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 25, paddingHorizontal: 18, backgroundColor: '#FFFDF8', borderRadius: 24, borderWidth: 1, borderColor: '#E8DFD1' },
  emptyIcon: { fontSize: 35 },
  emptyTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', marginTop: 7 },
  emptyText: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 4 },
  ruleCard: { backgroundColor: '#173C4A', borderRadius: radius.xl, padding: 17, flexDirection: 'row', gap: 12 },
  ruleIcon: { fontSize: 27 },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  ruleText: { color: '#D5E2E3', fontSize: 9, lineHeight: 14, marginTop: 3 },
});
