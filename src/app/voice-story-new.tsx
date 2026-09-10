import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { colors, radius } from '../theme';

const MAX_DURATION_MS = 20 * 60 * 1000;
const MIN_DURATION_MS = 500;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Голосовая история</Text>
            <Text style={styles.subtitle}>Не сообщение на бегу, а кусочек жизни, который останется в вашей истории.</Text>
          </View>
        </View>

        {prompt ? (
          <View style={styles.promptCard}>
            <Text style={styles.promptEyebrow}>ВОПРОС ДЛЯ РАЗГОВОРА</Text>
            <Text style={styles.promptText}>{prompt}</Text>
          </View>
        ) : null}

        <View style={styles.recorderCard}>
          <Text style={styles.timer}>{formatDuration(shownDuration)}</Text>
          <Text style={styles.timerHint}>
            {recorderState.isRecording
              ? 'Запись идёт. Говори спокойно — максимум 20 минут.'
              : recordedUri
                ? 'Запись готова. Прослушай её перед отправкой.'
                : 'Нажми на микрофон, когда будешь готов.'}
          </Text>

          <Pressable
            disabled={busy}
            onPress={() => void (recorderState.isRecording ? stopRecording() : startRecording())}
            style={[styles.recordButton, recorderState.isRecording && styles.recordButtonActive, busy && styles.disabled]}
          >
            <Text style={styles.recordIcon}>{recorderState.isRecording ? '■' : '●'}</Text>
          </Pressable>
          <Text style={styles.recordLabel}>{recorderState.isRecording ? 'Остановить' : recordedUri ? 'Записать заново' : 'Начать запись'}</Text>

          {recordedUri ? (
            <View style={styles.playbackRow}>
              <Pressable style={styles.playButton} onPress={() => void togglePlayback()}>
                <Text style={styles.playButtonText}>{playerStatus.playing ? 'Пауза' : '▶ Прослушать'}</Text>
              </Pressable>
              <Pressable style={styles.resetButton} onPress={resetRecording}>
                <Text style={styles.resetButtonText}>Удалить локально</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.fieldCard}>
          <Text style={styles.label}>Название — необязательно</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Например: После футбольного матча"
            placeholderTextColor={colors.muted}
            maxLength={120}
            style={styles.input}
          />
          <Text style={styles.counter}>{title.length}/120</Text>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>🔒</Text>
          <View style={styles.noteBody}>
            <Text style={styles.noteTitle}>Только ваша команда</Text>
            <Text style={styles.noteText}>Запись сохраняется в приватном семейном хранилище и не становится публичной.</Text>
          </View>
        </View>

        <Pressable
          disabled={!recordedUri || recorderState.isRecording || busy}
          onPress={() => void saveStory()}
          style={[styles.saveButton, (!recordedUri || recorderState.isRecording || busy) && styles.disabled]}
        >
          <Text style={styles.saveText}>{busy ? 'Сохраняем…' : 'Сохранить голосовую историю'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  backButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  backText: { color: colors.navy, fontSize: 30, lineHeight: 32, marginTop: -3 },
  headerText: { flex: 1, paddingTop: 2 },
  title: { color: colors.navyDeep, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  promptCard: { backgroundColor: '#FFF0CF', borderRadius: radius.lg, padding: 16, gap: 6 },
  promptEyebrow: { color: '#8A5D12', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  promptText: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  recorderCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 22, alignItems: 'center', gap: 10 },
  timer: { color: colors.white, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerHint: { color: '#CFDADB', fontSize: 12, lineHeight: 18, textAlign: 'center', minHeight: 36 },
  recordButton: { width: 84, height: 84, borderRadius: 42, marginTop: 6, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center', borderWidth: 7, borderColor: '#FFFFFF22' },
  recordButtonActive: { backgroundColor: '#E36A5B' },
  recordIcon: { color: colors.navyDeep, fontSize: 30, fontWeight: '900' },
  recordLabel: { color: colors.white, fontSize: 13, fontWeight: '900' },
  playbackRow: { width: '100%', flexDirection: 'row', gap: 9, marginTop: 8 },
  playButton: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  playButtonText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  resetButton: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: '#6E8587', alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  fieldCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  label: { color: colors.text, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: 13, color: colors.text, fontSize: 14 },
  counter: { color: colors.muted, fontSize: 10, textAlign: 'right' },
  noteCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 15, flexDirection: 'row', gap: 12 },
  noteIcon: { fontSize: 22 },
  noteBody: { flex: 1 },
  noteTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  noteText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  saveButton: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
