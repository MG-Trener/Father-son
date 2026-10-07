import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Text,
  TextInput
} from 'react-native';
import { Button, Card, Heading, Page, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import {
  registerVoiceStory,
  removeVoiceStoryAudio,
  uploadVoiceStoryAudio,
} from '../data/memoryArchiveRepository';
import { notifyFamilyEvent } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';

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
  const recordingRef = useRef(false);
  recordingRef.current = recorderState.isRecording;
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
    if (recordingRef.current) {
      void recorder.stop().catch(() => undefined);
    }
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  }, [recorder]);

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
    const client = supabase;
    if (!client || !session || !family || !recordedUri || busy) return;
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
      await uploadVoiceStoryAudio(client, path, audio);
      uploadedPath = path;

      const result = await registerVoiceStory(client, {
        familyId: family.id,
        storagePath: path,
        durationMs: Math.min(recordedDuration, MAX_DURATION_MS),
        title: title.trim() || null,
        prompt,
      });
      if (result.eventId) void notifyFamilyEvent(result.eventId);

      Alert.alert('Голосовая история сохранена', `${otherName} увидит её в вашей общей истории.`);
      router.back();
    } catch (caught) {
      if (uploadedPath) {
        await removeVoiceStoryAudio(client, uploadedPath).catch(() => undefined);
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

  return <Page>
    <Heading title="Голосовая история" subtitle={prompt || 'Несколько слов, которые хочется сохранить своим голосом.'} back />
    <Card tone="warm">
      <Text style={ui.sectionTitle}>{recorderState.isRecording ? 'Идёт запись' : isReady ? 'Запись готова' : 'Готовы начать?'}</Text>
      <Text style={ui.title}>{formatDuration(shownDuration)}</Text>
      <Text style={ui.body}>{recorderState.isRecording ? 'Говорите в своём темпе. Нажмите «Остановить», когда закончите.' : 'До 20 минут. Перед сохранением можно прослушать запись.'}</Text>
      {recorderState.isRecording ? <Button label="Остановить запись" onPress={() => void stopRecording()} /> : !isReady ? <Button label="Начать запись" disabled={busy} onPress={() => void startRecording()} /> : <><Button label={playerStatus.playing ? 'Пауза' : 'Прослушать запись'} secondary onPress={() => void togglePlayback()} /><Button label="Записать заново" secondary disabled={busy} onPress={() => Alert.alert('Записать заново?', 'Текущая несохранённая запись будет заменена.', [{ text: 'Оставить', style: 'cancel' }, { text: 'Записать заново', onPress: resetRecording }])} /></>}
    </Card>
    {isReady ? <Card><Text style={ui.rowTitle}>Название — по желанию</Text><TextInput accessibilityLabel="Название голосовой истории" style={ui.input} value={title} onChangeText={setTitle} maxLength={120} placeholder="Например: наша прогулка" /><Text style={ui.caption}>После сохранения историю смогут послушать папа и сын.</Text><Button label="Сохранить голосовую историю" busy={busy} onPress={() => void saveStory()} /></Card> : null}
  </Page>;
}
