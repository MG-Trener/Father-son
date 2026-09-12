import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

const artwork = {
  book: require('../../assets/generated/nav-book.png'),
  together: require('../../assets/generated/nav-together.png'),
  voice: require('../../assets/generated/utility-voice.png'),
  recognition: require('../../assets/generated/utility-recognition.png'),
  goal: require('../../assets/generated/utility-goal.png'),
} as const;

export default function ReflectionNewScreen() {
  const params = useLocalSearchParams<{ prompt?: string; mode?: string }>();
  const { session } = useAuth();
  const { family, me, members } = useFamily();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = typeof params.prompt === 'string' && params.prompt.trim()
    ? params.prompt.trim()
    : params.mode === 'story'
      ? 'Что сегодня хочется сохранить друг для друга?'
      : 'Что хочется сказать сейчас?';
  const displayPrompt = prompt.replace(/\s*·\s*Книга года\s+\d+\s*$/i, '').trim();
  const isStory = params.mode === 'story';

  const other = useMemo(
    () => members.find((member) => member.user_id !== me?.user_id) ?? null,
    [members, me],
  );

  const save = async () => {
    if (!supabase || !family || !session || busy) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert('Пока пусто', 'Напиши хотя бы одну мысль, которую хочется сохранить.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc('create_reflection_entry', {
        p_family_id: family.id,
        p_body: trimmed,
        p_prompt: prompt,
      });
      if (error) throw error;
      Alert.alert(
        isStory ? 'История сохранена' : 'Ответ сохранён',
        `${other?.display_name ?? 'Второй участник'} увидит это в вашей общей Истории.`,
      );
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
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
            <Text style={styles.topTitle}>{isStory ? 'История дня' : 'Ответ друг другу'}</Text>
          </View>

          <LinearGradient colors={gradients.story} style={[styles.hero, shadows.lift]}>
            <View style={styles.heroOrb} />
            <View style={styles.heroRing} />
            <View style={styles.memoryBadge}>
              <Image source={isStory ? artwork.book : artwork.together} style={styles.memoryImage} resizeMode="contain" />
            </View>
            <Text style={styles.heroKicker}>{isStory ? 'СОХРАНИТЬ МОМЕНТ' : 'МЕЖДУ НАМИ'}</Text>
            <Text style={styles.heroTitle}>{displayPrompt}</Text>
            <Text style={styles.heroCopy}>Не отчёт и не обязанность. Просто одна мысль, которую будет интересно услышать или перечитать позже.</Text>
          </LinearGradient>

          <View style={styles.choiceLabelRow}>
            <Text style={styles.choiceLabel}>КАК СОХРАНИМ?</Text>
            <View style={styles.choiceLine} />
          </View>

          <Pressable
            style={[styles.voiceCard, shadows.soft]}
            onPress={() => router.push({ pathname: '/voice-story-new', params: { prompt } })}
          >
            <LinearGradient colors={gradients.team} style={styles.voiceGradient}>
              <View style={styles.voiceVisual}>
                <View style={styles.micCircle}><Image source={artwork.voice} style={styles.micImage} resizeMode="contain" /></View>
                <View style={styles.waveform}>
                  {[14, 26, 38, 22, 46, 30, 18, 36, 24].map((height, index) => (
                    <View key={`${height}-${index}`} style={[styles.waveBar, { height }]} />
                  ))}
                </View>
              </View>
              <View style={styles.voiceCopy}>
                <Text style={styles.voiceKicker}>ГОЛОСОМ</Text>
                <Text style={styles.voiceTitle}>Рассказать как есть</Text>
                <Text style={styles.voiceText}>Интонация, смех, паузы — всё то, что текст не сохранит.</Text>
              </View>
              <View style={styles.voiceArrow}><Text style={styles.voiceArrowText}>→</Text></View>
            </LinearGradient>
          </Pressable>

          <View style={[styles.editorCard, shadows.soft]}>
            <View style={styles.editorHeader}>
              <View style={styles.editorIcon}><Image source={artwork.recognition} style={styles.editorIconImage} resizeMode="contain" /></View>
              <View style={styles.editorHeaderText}>
                <Text style={styles.editorKicker}>ТЕКСТОМ</Text>
                <Text style={styles.editorTitle}>{isStory ? 'Написать историю' : 'Оставить ответ'}</Text>
              </View>
            </View>

            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={isStory ? 'Например: сегодня случилась одна смешная вещь…' : 'Напиши так, как сказал бы вслух…'}
              placeholderTextColor={colors.mutedSoft}
              style={styles.input}
              multiline
              textAlignVertical="top"
              maxLength={4000}
              autoFocus={false}
            />

            <View style={styles.counterRow}>
              <View style={styles.privateRow}>
                <View style={styles.lockDot}><Text style={styles.lockText}>⌁</Text></View>
                <Text style={styles.privateNote}>Только ваша команда</Text>
              </View>
              <Text style={styles.counter}>{body.length}/4000</Text>
            </View>

            <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => void save()}>
              <LinearGradient colors={gradients.connection} style={styles.primaryGradient}>
                <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : isStory ? 'Сохранить этот момент' : 'Сохранить ответ'}</Text>
                {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.timelineHint}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineLine} />
            <View style={styles.timelineStar}><Image source={artwork.goal} style={styles.timelineImage} resizeMode="contain" /></View>
            <View style={styles.timelineLine} />
            <View style={styles.timelineDotFuture} />
          </View>
          <Text style={styles.footer}>Сегодняшний момент станет одной точкой на вашей общей дороге 11 → 18 и дальше.</Text>
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
  hero: { minHeight: 285, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroOrb: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)', top: -62, right: -46 },
  heroRing: { position: 'absolute', width: 105, height: 105, borderRadius: 53, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', top: 38, right: 34 },
  memoryBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  memoryImage: { width: 54, height: 54 },
  heroKicker: { color: '#F4EEFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  heroTitle: { color: colors.white, fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 5, maxWidth: '93%' },
  heroCopy: { color: '#F0ECF8', fontSize: 11, lineHeight: 17, marginTop: 8, maxWidth: '94%' },
  choiceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  choiceLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  choiceLine: { flex: 1, height: 1, backgroundColor: colors.lineWarm },
  voiceCard: { borderRadius: radius.xl, overflow: 'hidden' },
  voiceGradient: { minHeight: 180, padding: 18, overflow: 'hidden' },
  voiceVisual: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  micCircle: { width: 64, height: 64, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  micImage: { width: 55, height: 55 },
  waveform: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', gap: 5 },
  waveBar: { width: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.70)' },
  voiceCopy: { maxWidth: '80%' },
  voiceKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  voiceTitle: { color: colors.white, fontSize: 20, fontWeight: '900', marginTop: 3 },
  voiceText: { color: '#D7E6E8', fontSize: 10, lineHeight: 15, marginTop: 4 },
  voiceArrow: { position: 'absolute', right: 18, bottom: 18, width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  voiceArrowText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  editorCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 18, gap: 13 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  editorIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FFF2D8', alignItems: 'center', justifyContent: 'center' },
  editorIconImage: { width: 43, height: 43 },
  editorHeaderText: { flex: 1 },
  editorKicker: { color: colors.purple, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  editorTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 2 },
  input: { minHeight: 190, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 15, backgroundColor: colors.white, color: colors.text, fontSize: 15, lineHeight: 22 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lockDot: { width: 24, height: 24, borderRadius: 9, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: colors.green, fontSize: 13, fontWeight: '900' },
  privateNote: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  counter: { color: colors.mutedSoft, fontSize: 10, fontWeight: '800' },
  primary: { borderRadius: radius.md, overflow: 'hidden' },
  primaryGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryText: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' },
  primaryArrow: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  timelineHint: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 34, marginTop: 2 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tealBright },
  timelineDotFuture: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineWarm },
  timelineLine: { flex: 1, height: 2, backgroundColor: colors.lineWarm },
  timelineStar: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  timelineImage: { width: 34, height: 34 },
  footer: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 30 },
});
