import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

const artwork = {
  voice: require('../../assets/generated/utility-voice.png'),
  recognition: require('../../assets/generated/utility-recognition.png'),
  together: require('../../assets/generated/nav-together.png'),
  goal: require('../../assets/generated/utility-goal.png'),
} as const;

const MAX_DURATION_MS = 20 * 60 * 1000;
const MIN_DURATION_MS = 500;
const waveformBars = [18, 34, 23, 48, 30, 56, 25, 42, 19, 51, 28, 39, 22, 46, 31];

const formatDuration = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const cleanFileName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);

export default function VoiceStoryNewScreen() {
  const params = useLocalSearchParams<{ prompt?: string }>();
  const { session } = useAuth();
  const { family, members } = useFamily();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  const [title, setTitle] = useState('');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [busy, setBusy] = useState(false);

  const prompt = typeof params.prompt === 'string' && params.prompt.trim()
    ? params.prompt.trim().slice(0, 500)
    : null;

  const otherName = useMemo(
    () => members.find((member) => member.user_id !== session?.user.id)?.display_name ?? 'другому участнику',
    [members, session?.user.id],
  );

  useEffect(() => {
    if (!recorderState.isRecording || recorderState.durationMillis < MAX_DURATION_MS) return;
    void stopRecording();
    // recorderState intentionally drives the automatic 20-minute stop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.durationMillis, recorderState.isRecording]);

  useEffect(() => () => {
    if (recorderState.isRecording) {
      void recorder.stop().catch(() => undefined);
    }
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  }, [recorder, recorderState.isRecording]);

  const startRecording = async () => {
    if (busy || recorderState.isRecording) return;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нужен микрофон', 'Разреши доступ к микрофону, чтобы записывать голосовые истории.');
        return;
      }

      player.pause();
      setRecordedUri(null);
      setRecordedDuration(0);

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (caught) {
      Alert.alert('Не удалось начать запись', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;

    const duration = Math.max(MIN_DURATION_MS, recorderState.durationMillis);
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error('Файл записи не найден.');
      setRecordedUri(uri);
      setRecordedDuration(duration);
      player.replace(uri);
    } catch (caught) {
      Alert.alert('Не удалось завершить запись', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    }
  };

  const togglePlayback = async () => {
    if (!recordedUri) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    if (playerStatus.didJustFinish || playerStatus.currentTime >= Math.max(0, playerStatus.duration - 0.2)) {
      await player.seekTo(0);
    }
    player.play();
  };

  const saveStory = async () => {
    if (!supabase || !session || !family || !recordedUri || busy) return;
    if (recordedDuration < MIN_DURATION_MS) {
      Alert.alert('Слишком короткая запись', 'Запиши хотя бы несколько слов.');
      return;
    }

    setBusy(true);
    let uploadedPath: string | null = null;

    try {
      const response = await fetch(recordedUri);
      if (!response.ok) throw new Error('Не удалось прочитать локальную запись.');
      const audio = await response.arrayBuffer();
      if (!audio.byteLength) throw new Error('Запись получилась пустой.');

      const suffix = cleanFileName(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      const path = `${family.id}/${session.user.id}/${suffix}.m4a`;
      const { error: uploadError } = await supabase.storage
        .from('voice-stories')
        .upload(path, audio, {
          contentType: 'audio/mp4',
          cacheControl: '3600',
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data, error: registerError } = await supabase.rpc('register_voice_story', {
        p_family_id: family.id,
        p_storage_path: path,
        p_duration_ms: Math.min(recordedDuration, MAX_DURATION_MS),
        p_title: title.trim() || null,
        p_prompt: prompt,
      });
      if (registerError) throw registerError;

      const result = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : {};
      const eventId = typeof result.event_id === 'string' ? result.event_id : null;
      if (eventId) void notifyFamilyEvent(eventId);

      Alert.alert('Голосовая история сохранена', `${otherName} увидит её в вашей общей истории.`);
      router.back();
    } catch (caught) {
      if (uploadedPath) {
        await supabase.storage.from('voice-stories').remove([uploadedPath]).catch(() => undefined);
      }
      const message = caught instanceof Error ? caught.message : 'Попробуй ещё раз.';
      Alert.alert(
        'Не удалось сохранить запись',
        message.toLowerCase().includes('bucket')
          ? 'Хранилище голосовых ещё не развёрнуто. Локальная запись остаётся на устройстве — попробуй после обновления backend.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const resetRecording = () => {
    player.pause();
    setRecordedUri(null);
    setRecordedDuration(0);
  };

  const shownDuration = recorderState.isRecording ? recorderState.durationMillis : recordedDuration;
  const isReady = Boolean(recordedUri && !recorderState.isRecording);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Голосовая история</Text>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} />
          <View style={styles.heroRing} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroHeading}>
              <View style={styles.heroArtworkShell}><Image source={artwork.voice} style={styles.heroArtwork} resizeMode="contain" /></View>
              <View style={styles.heroHeadingCopy}>
                <Text style={styles.heroKicker}>ГОЛОСОВАЯ КАПСУЛА</Text>
                <Text style={styles.heroTitle}>{recorderState.isRecording ? 'Сейчас звучит настоящий момент.' : isReady ? 'Этот момент уже можно сохранить.' : 'Расскажи так, как рассказал бы при встрече.'}</Text>
              </View>
            </View>
            <View style={[styles.stateBadge, recorderState.isRecording && styles.stateBadgeRecording]}>
              <Text style={styles.stateDot}>{recorderState.isRecording ? '●' : isReady ? '✓' : '○'}</Text>
              <Text style={styles.stateText}>{recorderState.isRecording ? 'REC' : isReady ? 'ГОТОВО' : 'ЖДЁМ'}</Text>
            </View>
          </View>

          <View style={styles.waveStage}>
            <View style={styles.waveform}>
              {waveformBars.map((height, index) => {
                const activeHeight = recorderState.isRecording
                  ? Math.max(10, height - ((index + Math.floor(shownDuration / 250)) % 4) * 5)
                  : isReady
                    ? height
                    : Math.max(8, Math.floor(height * 0.38));
                return <View key={`${height}-${index}`} style={[styles.waveBar, { height: activeHeight }, recorderState.isRecording && styles.waveBarRecording]} />;
              })}
            </View>
            <Text style={styles.timer}>{formatDuration(shownDuration)}</Text>
            <Text style={styles.timerHint}>
              {recorderState.isRecording
                ? 'Говори спокойно. Запись остановится сама через 20 минут.'
                : isReady
                  ? 'Прослушай запись или сохрани её в вашей общей истории.'
                  : 'Нажми большую кнопку — и просто начни говорить.'}
            </Text>
          </View>

          <Pressable
            disabled={busy}
            onPress={() => void (recorderState.isRecording ? stopRecording() : startRecording())}
            style={[styles.recordOuter, recorderState.isRecording && styles.recordOuterActive, busy && styles.disabled]}
          >
            <View style={[styles.recordMiddle, recorderState.isRecording && styles.recordMiddleActive]}>
              <View style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive]}>
                <Text style={styles.recordIcon}>{recorderState.isRecording ? '■' : '●'}</Text>
              </View>
            </View>
          </Pressable>
          <Text style={styles.recordLabel}>{recorderState.isRecording ? 'Остановить запись' : isReady ? 'Записать заново' : 'Начать запись'}</Text>
        </LinearGradient>

        {prompt ? (
          <View style={[styles.promptCard, shadows.soft]}>
            <View style={styles.promptIcon}><Image source={artwork.recognition} style={styles.promptIconImage} resizeMode="contain" /></View>
            <View style={styles.promptBody}>
              <Text style={styles.promptEyebrow}>ВОПРОС ДЛЯ РАЗГОВОРА</Text>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          </View>
        ) : null}

        {isReady ? (
          <View style={[styles.playbackCard, shadows.soft]}>
            <View style={styles.playbackHeader}>
              <View>
                <Text style={styles.playbackKicker}>ПРЕДПРОСЛУШИВАНИЕ</Text>
                <Text style={styles.playbackTitle}>Как звучит история?</Text>
              </View>
              <View style={styles.durationBadge}><Text style={styles.durationText}>{formatDuration(recordedDuration)}</Text></View>
            </View>
            <View style={styles.playbackWave}>
              {waveformBars.slice(0, 11).map((height, index) => (
                <View key={`play-${height}-${index}`} style={[styles.playBar, { height: Math.max(7, Math.floor(height * 0.55)) }]} />
              ))}
            </View>
            <View style={styles.playbackRow}>
              <Pressable style={styles.playButton} onPress={() => void togglePlayback()}>
                <Text style={styles.playButtonText}>{playerStatus.playing ? 'Ⅱ  Пауза' : '▶  Прослушать'}</Text>
              </Pressable>
              <Pressable style={styles.resetButton} onPress={resetRecording}>
                <Text style={styles.resetButtonText}>Удалить</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.fieldCard, shadows.soft]}>
          <View style={styles.fieldHeading}>
            <View style={styles.fieldIcon}><Image source={artwork.together} style={styles.fieldIconImage} resizeMode="contain" /></View>
            <View style={styles.fieldHeadingText}>
              <Text style={styles.label}>Дай этому моменту имя</Text>
              <Text style={styles.fieldHint}>Необязательно — можно оставить только голос.</Text>
            </View>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Например: После футбольного матча"
            placeholderTextColor={colors.mutedSoft}
            maxLength={120}
            style={styles.input}
          />
          <Text style={styles.counter}>{title.length}/120</Text>
        </View>

        <View style={styles.noteCard}>
          <View style={styles.lockBadge}><Text style={styles.lockIcon}>⌁</Text></View>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle}>Только Михаил и Артур</Text>
            <Text style={styles.noteText}>Аудио хранится в приватном семейном Storage. Публичной ссылки у записи нет.</Text>
          </View>
        </View>

        <Pressable
          disabled={!recordedUri || recorderState.isRecording || busy}
          onPress={() => void saveStory()}
          style={[styles.saveButton, (!recordedUri || recorderState.isRecording || busy) && styles.disabled]}
        >
          <LinearGradient colors={gradients.connection} style={styles.saveGradient}>
            <Text style={styles.saveText}>{busy ? 'Сохраняем…' : 'Добавить в нашу историю'}</Text>
            {!busy ? <Text style={styles.saveArrow}>→</Text> : null}
          </LinearGradient>
        </Pressable>

        <View style={styles.routeFooter}>
          <View style={styles.routeDot} />
          <View style={styles.routeLine} />
          <View style={styles.routeVoice}><Image source={artwork.goal} style={styles.routeVoiceImage} resizeMode="contain" /></View>
          <View style={styles.routeLine} />
          <View style={styles.routeDotFuture} />
        </View>
        <Text style={styles.footerText}>Через годы голос сохранит то, чего не видно в обычной записи: настроение, смех и интонацию.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  hero: { minHeight: 445, borderRadius: radius.xl, padding: 20, overflow: 'hidden', alignItems: 'center' },
  heroOrb: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.09)', top: -86, right: -56 },
  heroRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 2, borderColor: 'rgba(255,255,255,0.09)', bottom: 44, left: -58 },
  heroTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  heroHeading: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  heroHeadingCopy: { flex: 1 },
  heroArtworkShell: { width: 62, height: 62, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroArtwork: { width: 54, height: 54 },
  heroKicker: { color: colors.sun, fontSize: 8, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.35, marginTop: 5, maxWidth: 205 },
  stateBadge: { minWidth: 62, paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  stateBadgeRecording: { backgroundColor: 'rgba(233,111,95,0.20)' },
  stateDot: { color: colors.sun, fontSize: 9, fontWeight: '900' },
  stateText: { color: colors.white, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  waveStage: { width: '100%', alignItems: 'center', marginTop: 26 },
  waveform: { height: 62, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  waveBar: { width: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  waveBarRecording: { backgroundColor: colors.sun },
  timer: { color: colors.white, fontSize: 46, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: -1.5, marginTop: 5 },
  timerHint: { color: '#D4E3E5', fontSize: 10, lineHeight: 15, textAlign: 'center', maxWidth: 260, minHeight: 30, marginTop: 2 },
  recordOuter: { width: 104, height: 104, borderRadius: 52, marginTop: 12, backgroundColor: 'rgba(255,215,106,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,215,106,0.18)' },
  recordOuterActive: { backgroundColor: 'rgba(233,111,95,0.10)', borderColor: 'rgba(233,111,95,0.28)' },
  recordMiddle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,215,106,0.18)', alignItems: 'center', justifyContent: 'center' },
  recordMiddleActive: { backgroundColor: 'rgba(233,111,95,0.20)' },
  recordButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  recordButtonActive: { backgroundColor: colors.coral },
  recordIcon: { color: colors.navyDeep, fontSize: 24, fontWeight: '900' },
  recordLabel: { color: colors.white, fontSize: 11, fontWeight: '900', marginTop: 7 },
  promptCard: { backgroundColor: '#FFF0CF', borderRadius: radius.xl, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: '#F4DBA3' },
  promptIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFF7E6', alignItems: 'center', justifyContent: 'center' },
  promptIconImage: { width: 40, height: 40 },
  promptBody: { flex: 1 },
  promptEyebrow: { color: '#8A5D12', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  promptText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 4 },
  playbackCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: colors.lineWarm, gap: 13 },
  playbackHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playbackKicker: { color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  playbackTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 2 },
  durationBadge: { backgroundColor: colors.mint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  durationText: { color: colors.green, fontSize: 10, fontWeight: '900', fontVariant: ['tabular-nums'] },
  playbackWave: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  playBar: { flex: 1, maxWidth: 5, borderRadius: 3, backgroundColor: colors.tealBright },
  playbackRow: { flexDirection: 'row', gap: 9 },
  playButton: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  playButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  resetButton: { minWidth: 92, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  resetButtonText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  fieldCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 17, gap: 10 },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  fieldIconImage: { width: 42, height: 42 },
  fieldHeadingText: { flex: 1 },
  label: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' },
  fieldHint: { color: colors.muted, fontSize: 9, marginTop: 2 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.text, fontSize: 14 },
  counter: { color: colors.mutedSoft, fontSize: 9, textAlign: 'right' },
  noteCard: { backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'center' },
  lockBadge: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { color: colors.green, fontSize: 17, fontWeight: '900' },
  noteBody: { flex: 1 },
  noteTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  saveButton: { borderRadius: radius.md, overflow: 'hidden' },
  saveGradient: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  saveText: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' },
  saveArrow: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  routeFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, marginTop: 4 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.tealBright },
  routeDotFuture: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lineWarm },
  routeLine: { flex: 1, height: 2, backgroundColor: colors.lineWarm },
  routeVoice: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  routeVoiceImage: { width: 34, height: 34 },
  footerText: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 30 },
});
