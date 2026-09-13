import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { brandAssets } from '../brandAssets';
import { openFutureLetter, type OpenedFutureLetter } from '../data/memoryArchiveRepository';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

const artwork = {
  book: brandAssets.features.book,
  path: brandAssets.features.path,
  family: brandAssets.features.family,
} as const;

export default function FutureLetterView() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { members } = useFamily();
  const [letter, setLetter] = useState<OpenedFutureLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const letterId = typeof params.id === 'string' ? params.id : null;

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !letterId) {
      setLoading(false);
      return;
    }

    try {
      setLetter(await openFutureLetter(client, letterId));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось открыть письмо.';
      const sealed = message.includes('LETTER_STILL_SEALED');
      Alert.alert(
        sealed ? 'Письмо ещё запечатано' : 'Не удалось открыть письмо',
        sealed ? 'Его время ещё не пришло.' : message,
        [{ text: 'Назад', onPress: () => router.replace('/letters') }],
      );
    } finally {
      setLoading(false);
    }
  }, [letterId]);

  useEffect(() => { void load(); }, [load]);

  const nameFor = (id: string) => members.find((member) => member.user_id === id)?.display_name ?? 'Участник';

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;
  if (!letter) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.replace('/letters')}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.kicker}>КАПСУЛА ВРЕМЕНИ ОТКРЫТА</Text><Text style={styles.topTitle}>Письмо из прошлого</Text></View>
        </View>

        <LinearGradient colors={['#173C54', '#365F70', '#D49B4B']} style={[styles.hero, shadows.lift]}>
          <View style={styles.glow} />
          <View style={styles.heroArtworkShell}><Image source={artwork.path} style={styles.heroArtwork} resizeMode="contain" /></View>
          <Text style={styles.heroMeta}>{nameFor(letter.authorUserId)} → {nameFor(letter.recipientUserId)}</Text>
          <Text style={styles.heroTitle}>{letter.title}</Text>
          <Text style={styles.heroDate}>Ждало до {new Date(letter.unlockAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </LinearGradient>

        <View style={[styles.paper, shadows.soft]}>
          <View style={styles.paperTop}>
            <Text style={styles.paperTo}>Для {nameFor(letter.recipientUserId)}</Text>
            <View style={styles.paperMark}><Image source={artwork.book} style={styles.paperMarkImage} resizeMode="contain" /></View>
          </View>
          <Text style={styles.body}>{letter.body}</Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signature}>{nameFor(letter.authorUserId)}</Text>
          <Text style={styles.opened}>Открыто {new Date(letter.openedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        </View>

        <View style={styles.note}>
          <View style={styles.noteIconShell}><Image source={artwork.family} style={styles.noteIcon} resizeMode="contain" /></View>
          <Text style={styles.noteText}>Теперь это письмо стало частью вашей общей истории. Его можно перечитывать в любое время.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 36, gap: 16 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 28, lineHeight: 28, fontWeight: '700', marginTop: -3 },
  kicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  hero: { minHeight: 215, borderRadius: radius.xl, padding: 20, justifyContent: 'flex-end', overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,220,130,0.14)', right: -50, top: -75 },
  heroArtworkShell: { position: 'absolute', right: 15, top: 12, width: 78, height: 78, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroArtwork: { width: 68, height: 68 },
  heroMeta: { color: '#E2EBEB', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { color: colors.white, fontSize: 27, lineHeight: 30, fontWeight: '900', marginTop: 5, maxWidth: '89%' },
  heroDate: { color: '#F0D6A7', fontSize: 9, fontWeight: '800', marginTop: 9 },
  paper: { backgroundColor: '#FFFDF7', borderRadius: radius.xl, borderWidth: 1, borderColor: '#E9DFCF', padding: 22 },
  paperTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#EDE4D7' },
  paperTo: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  paperMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F6E8CE', alignItems: 'center', justifyContent: 'center' },
  paperMarkImage: { width: 35, height: 35 },
  body: { color: '#2D444B', fontSize: 14, lineHeight: 22, marginTop: 21 },
  signatureLine: { width: 72, height: 1, backgroundColor: '#D9CCB9', marginTop: 28 },
  signature: { color: colors.navyDeep, fontSize: 13, fontWeight: '900', marginTop: 7 },
  opened: { color: colors.muted, fontSize: 8, marginTop: 3 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#EAF1EE', borderRadius: 22, padding: 15 },
  noteIconShell: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#DCEBE5', alignItems: 'center', justifyContent: 'center' },
  noteIcon: { width: 38, height: 38 },
  noteText: { flex: 1, color: '#4E6866', fontSize: 9, lineHeight: 14, fontWeight: '700' },
});