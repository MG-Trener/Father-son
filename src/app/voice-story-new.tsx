import { useFeedback } from "../components/Feedback";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Platform, Text, TextInput } from "react-native";
import { Button, Card, Heading, Page, ui } from "../components/Everyday";
import { useAuth } from "../context/AuthContext";
import { useFamily } from "../context/FamilyContext";
import {
  registerVoiceStory,
  removeVoiceStoryAudio,
  uploadVoiceStoryAudio,
  type VoiceStory,
} from "../data/memoryArchiveRepository";
import { notifyFamilyEvent } from "../lib/pushNotifications";
import { supabase } from "../lib/supabase";
import { AudioOperation } from "../domain/audioOperation";
import { editWindowHint, recordEditError } from "../domain/recordEditing";
import { useRecordEditing } from "../hooks/useRecordEditing";

const MAX_DURATION_MS = 20 * 60 * 1000;
const formatDuration = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export default function VoiceStoryNewScreen() {
  const feedback = useFeedback();
  const params = useLocalSearchParams<{
    prompt?: string;
    replaceId?: string;
  }>();
  const { session } = useAuth();
  const { family } = useFamily();
  const canEdit = useRecordEditing(session?.user.id);
  const focused = useIsFocused();
  const focusRef = useRef(focused);
  focusRef.current = focused;
  const operation = useRef(new AudioOperation()).current;
  const [error, setError] = useState("");
  const recordingError = useRef(false);
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, directory: "document" },
    (status) => {
      if (status.hasError && operation.active) {
        recordingError.current = true;
        setError("Микрофон был прерван. Запишите голос ещё раз.");
      }
    },
  );
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  const [title, setTitle] = useState("");
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState<VoiceStory | null>(null);
  const [loading, setLoading] = useState(Boolean(params.replaceId));
  const recording = useRef(false);
  const startedAt = useRef(0);
  // Keep the upload identity on retry. A lost RPC response must not duplicate the story.
  const upload = useRef<{
    uri: string;
    path: string;
    uploaded: boolean;
    title: string;
  } | null>(null);
  const prompt =
    original?.prompt ??
    (typeof params.prompt === "string"
      ? params.prompt.trim().slice(0, 500) || null
      : null);
  const editable =
    !params.replaceId ||
    Boolean(original && canEdit(original.created_at, original.author_user_id));

  useLayoutEffect(() => {
    operation.activate();
    return () => {
      operation.dispose();
      // Layout cleanup runs BEFORE expo-audio's passive cleanup releases the native player.
      try {
        player.pause();
      } catch {
        /* already stopped by the OS */
      }
      // The recorder hook owns disposal; calling stop() again here races its release.
    };
  }, [operation, player]);

  useEffect(() => {
    if (!params.replaceId || !supabase || !family) return;
    let cancelled = false;
    void supabase
      .from("voice_stories")
      .select("*")
      .eq("id", params.replaceId)
      .eq("family_id", family.id)
      .single()
      .then(({ data, error: failure }) => {
        if (cancelled) return;
        setLoading(false);
        if (failure || !data) {
          setError("Запись недоступна. Вернитесь к голосовым историям.");
          return;
        }
        setOriginal(data);
        setTitle(data.title ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [params.replaceId, family?.id]);

  const startRecording = async () => {
    if (!editable || recording.current || !focusRef.current) return;
    const token = operation.begin();
    if (token === null) return;
    setBusy(true);
    setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!operation.valid(token) || !focusRef.current) return;
      if (!permission.granted) throw new Error("MICROPHONE_PERMISSION");
      player.pause();
      recordingError.current = false;
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      if (!operation.valid(token) || !focusRef.current) return;
      await recorder.prepareToRecordAsync();
      if (!operation.valid(token) || !focusRef.current) return;
      recorder.record();
      recording.current = true;
      startedAt.current = Date.now();
    } catch {
      if (operation.valid(token))
        setError(
          "Не удалось начать запись. Проверьте разрешение на микрофон и попробуйте ещё раз.",
        );
    } finally {
      if (operation.valid(token)) setBusy(false);
      operation.finish(token);
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;
    const token = operation.begin();
    if (token === null) return;
    recording.current = false;
    setBusy(true);
    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(recorderState.durationMillis, Date.now() - startedAt.current),
    );
    try {
      await recorder.stop();
      if (!operation.valid(token)) return;
      const uri = recorder.uri;
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      if (!operation.valid(token)) return;
      if (!uri || recordingError.current || duration < 500)
        throw new Error("RECORDING_INVALID");
      setRecordedUri(uri);
      setRecordedDuration(duration);
      // Load for listening only on explicit playback, after the recorder is fully stopped.
    } catch {
      if (operation.valid(token))
        setError(
          "Запись не завершилась корректно. Попробуйте записать ещё раз.",
        );
    } finally {
      if (operation.valid(token)) setBusy(false);
      operation.finish(token);
    }
  };
  useEffect(() => {
    if (
      recorderState.isRecording &&
      recorderState.durationMillis >= MAX_DURATION_MS
    )
      void stopRecording();
  }, [recorderState.durationMillis, recorderState.isRecording]);
  useEffect(() => {
    if (!focused) {
      try {
        player.pause();
      } catch {
        /* native lifecycle cleanup */
      }
      if (recording.current) void stopRecording();
    }
  }, [focused]);

  const playbackSource = useRef<string | null>(null);
  const togglePlayback = async () => {
    if (!recordedUri) return;
    const token = operation.begin();
    if (token === null) return;
    try {
      if (playerStatus.playing) {
        player.pause();
        return;
      }
      if (playbackSource.current !== recordedUri) {
        player.replace(recordedUri);
        playbackSource.current = recordedUri;
      } else if (playerStatus.didJustFinish) await player.seekTo(0);
      if (operation.valid(token)) player.play();
    } catch {
      if (operation.valid(token))
        setError("Не удалось прослушать запись. Попробуйте ещё раз.");
    } finally {
      operation.finish(token);
    }
  };

  const saveStory = async () => {
    const client = supabase;
    if (!client || !session || !family || !recordedUri || !editable) return;
    const token = operation.begin();
    if (token === null) return;
    setBusy(true);
    setError("");
    try {
      player.pause();
      if (!upload.current || upload.current.uri !== recordedUri)
        upload.current = {
          uri: recordedUri,
          path: `${family.id}/${session.user.id}/${Crypto.randomUUID()}.m4a`,
          uploaded: false,
          title: title.trim(),
        };
      const attempt = upload.current;
      if (!attempt.uploaded) {
        const audio =
          Platform.OS === "web"
            ? await (await fetch(recordedUri)).arrayBuffer()
            : await new File(recordedUri).arrayBuffer();
        if (!audio.byteLength) throw new Error("EMPTY_RECORDING");
        try {
          await uploadVoiceStoryAudio(client, attempt.path, audio);
        } catch (e) {
          // The upload itself can succeed even when its response is lost.
          const { data } = await client.storage
            .from("voice-stories")
            .info(attempt.path);
          if (!data || data.size !== audio.byteLength) throw e;
        }
        attempt.uploaded = true;
      }
      let savedId: string;
      if (original) {
        const result = await client.rpc("replace_voice_story", {
          p_id: original.id,
          p_expected_path: original.storage_path,
          p_storage_path: attempt.path,
          p_duration_ms: recordedDuration,
          p_title: attempt.title || null,
        });
        if (result.error) throw result.error;
        savedId = original.id;
        // Only an acknowledged replacement allows cleaning the old file. Referenced objects are protected by RLS.
        void removeVoiceStoryAudio(client, original.storage_path).catch(
          () => undefined,
        );
      } else {
        const result = await registerVoiceStory(client, {
          familyId: family.id,
          storagePath: attempt.path,
          durationMs: recordedDuration,
          title: attempt.title || null,
          prompt,
        });
        savedId = result.voiceStoryId;
        if (result.eventId) void notifyFamilyEvent(result.eventId);
      }
      // Never delete the upload on an ambiguous failure: the server may already reference it.
      if (!operation.valid(token) || !focusRef.current) return;
      feedback(
        original
          ? "Голосовая запись заменена — можно слушать"
          : "Голосовая история сохранена — можно слушать",
      );
      router.replace({ pathname: "/voice-stories", params: { id: savedId } });
    } catch (caught) {
      if (operation.valid(token))
        setError(
          original
            ? recordEditError(caught)
            : "Не удалось подтвердить сохранение. Запись остаётся здесь — нажмите сохранить ещё раз.",
        );
    } finally {
      if (operation.valid(token)) setBusy(false);
      operation.finish(token);
    }
  };
  const resetRecording = () => {
    if (busy) return;
    try {
      player.pause();
    } catch {
      return;
    }
    setRecordedUri(null);
    setRecordedDuration(0);
    upload.current = null;
    playbackSource.current = null;
  };
  const isRecording = recorderState.isRecording;
  const isReady = Boolean(recordedUri && !isRecording);
  return (
    <Page>
      <Heading
        title={params.replaceId ? "Перезаписать голос" : "Голосовая история"}
        subtitle={
          prompt || "Несколько слов, которые хочется сохранить своим голосом."
        }
        back
      />
      {error ? (
        <Text accessibilityRole="alert" style={ui.body}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <Text style={ui.caption}>Открываем запись…</Text>
      ) : !editable ? (
        <Card>
          <Text style={ui.body}>{editWindowHint}</Text>
          <Button label="Вернуться к записи" onPress={() => router.back()} />
        </Card>
      ) : (
        <>
          {original ? (
            <Text style={ui.caption}>
              Старая запись останется доступной до сохранения новой.{" "}
              {editWindowHint}
            </Text>
          ) : null}
          <Card tone="warm">
            <Text style={ui.sectionTitle}>
              {isRecording
                ? "Идёт запись"
                : isReady
                  ? "Запись готова"
                  : "Готовы начать?"}
            </Text>
            <Text style={ui.title}>
              {formatDuration(
                isRecording ? recorderState.durationMillis : recordedDuration,
              )}
            </Text>
            <Text style={ui.body}>
              {isRecording
                ? "Говорите в своём темпе. Нажмите «Остановить», когда закончите."
                : "До 20 минут. Перед сохранением можно прослушать запись."}
            </Text>
            {isRecording ? (
              <Button
                label="Остановить запись"
                busy={busy}
                onPress={() => void stopRecording()}
              />
            ) : !isReady ? (
              <Button
                label="Начать запись"
                busy={busy}
                onPress={() => void startRecording()}
              />
            ) : (
              <>
                <Button
                  label={playerStatus.playing ? "Пауза" : "Прослушать запись"}
                  secondary
                  disabled={busy}
                  onPress={() => void togglePlayback()}
                />
                <Button
                  label="Записать заново"
                  secondary
                  disabled={busy}
                  onPress={resetRecording}
                />
              </>
            )}
          </Card>
          {isReady ? (
            <Card>
              <Text style={ui.rowTitle}>Название — по желанию</Text>
              <TextInput
                accessibilityLabel="Название голосовой истории"
                style={ui.input}
                value={title}
                onChangeText={setTitle}
                editable={!busy && !upload.current?.uploaded}
                maxLength={120}
                placeholder="Например: наша прогулка"
              />
              <Text style={ui.caption}>
                После сохранения запись появится на экране прослушивания.
              </Text>
              <Button
                label={
                  original
                    ? "Заменить голосовую запись"
                    : "Сохранить голосовую историю"
                }
                busy={busy}
                onPress={() => void saveStory()}
              />
            </Card>
          ) : null}
        </>
      )}
    </Page>
  );
}
