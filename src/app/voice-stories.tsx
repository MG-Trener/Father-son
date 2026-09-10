import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type VoiceStory = {
  id: string;
  author_user_id: string;
  title: string | null;
  prompt: string | null;
  storage_path: string;
  duration_ms: number;
  recorded_at: string;
};

const durationLabel = (millis: number) => {
  const totalSeconds = Math.max(0, Math.round(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const dateLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

export default function VoiceStoriesScreen() {
  const { family, members } = useFamily();
  const [stories, setStories] = useState<VoiceStory[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase && family));
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);

  const names = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.display_name])),
    [members],
  );

  const load = useCallback(async () => {
    if (!supabase || !family) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('voice_stories')
      .select('id,author_user_id,title,prompt,storage_path,duration_ms,recorded_at')
      .eq('family_id', family.id)
      .eq('status', 'ready')
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (error) {
      Alert.alert('Не удалось загрузить архив', error.message);
    } else {
      setStories((data ?? []) as VoiceStory[]);
    }
    setLoading(false);
  }, [family]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (playingId && playerStatus.didJustFinish) {
      setPlayingId(null);
    }
  }, [playerStatus.didJustFinish, playingId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const playStory = async (story: VoiceStory) => {
    if (!supabase) return;

    if (playingId === story.id && playerStatus.playing) {
      player.pause();
      return;
    }

    setOpeningId(story.id);
    try {
      const { data, error } = await supabase.storage
        .from('voice-stories')
        .createSignedUrl(story.storage_path, 10 * 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Не удалось получить временную ссылку на запись.');

      player.replace(data.signedUrl);
      setPlayingId(story.id);
      player.play();
    } catch (caught) {
      Alert.alert('Не удалось открыть запись', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Голосовые истории</Text>
            <Text style={styles.subtitle}>Голоса Михаила и Артура, которые не потеряются в обычном чате.</Text>
          </View>
        </View>

        <Pressable style={styles.recordCard} onPress={() => router.push('/voice-story-new')}>
          <Text style={styles.recordIcon}>🎙</Text>
          <View style={styles.recordCopy}>
            <Text style={styles.recordTitle}>Записать новую историю</Text>
            <Text style={styles.recordText}>Мысль, история после матча, важный вопрос или просто несколько слов друг другу.</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <View style={styles.privateCard}>
          <Text style={styles.privateIcon}>🔒</Text>
          <Text style={styles.privateText}>Записи хранятся в приватном семейном bucket. Для проигрывания приложение получает временную ссылку на 10 минут.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : stories.length ? (
          <View style={styles.list}>
            {stories.map((story) => {
              const author = names.get(story.author_user_id) ?? 'Участник команды';
              const isPlaying = playingId === story.id && playerStatus.playing;
              const isOpening = openingId === story.id;
              return (
                <View key={story.id} style={styles.storyCard}>
                  <View style={styles.storyTop}>
                    <View style={styles.storyCopy}>
                      <Text style={styles.storyTitle}>{story.title || 'Голосовая история'}</Text>
                      <Text style={styles.meta}>{author} · {dateLabel(story.recorded_at)} · {durationLabel(story.duration_ms)}</Text>
                    </View>
                    <Pressable
                      disabled={isOpening}
                      onPress={() => void playStory(story)}
                      style={[styles.playButton, isPlaying && styles.playButtonActive]}
                    >
                      {isOpening ? (
                        <ActivityIndicator size="small" color={colors.navyDeep} />
                      ) : (
                        <Text style={styles.playText}>{isPlaying ? 'Ⅱ' : '▶'}</Text>
                      )}
                    </Pressable>
                  </View>
                  {story.prompt ? (
                    <View style={styles.promptBox}>
                      <Text style={styles.promptLabel}>ВОПРОС</Text>
                      <Text style={styles.promptText}>{story.prompt}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎧</Text>
            <Text style={styles.emptyTitle}>Архив пока пуст</Text>
            <Text style={styles.emptyText}>Первая запись может быть совсем короткой: расскажите друг другу, чем запомнился сегодняшний день.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 15 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 30, lineHeight: 32, marginTop: -3 },
  headerText: { flex: 1, paddingTop: 1 },
  title: { color: colors.navyDeep, fontSize: 28, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  recordCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordIcon: { fontSize: 28 },
  recordCopy: { flex: 1 },
  recordTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  recordText: { color: '#CFDADB', fontSize: 11, lineHeight: 16, marginTop: 3 },
  arrow: { color: colors.white, fontSize: 27 },
  privateCard: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  privateIcon: { fontSize: 17 },
  privateText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 },
  loader: { marginVertical: 36 },
  list: { gap: 11 },
  storyCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 15, gap: 10 },
  storyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storyCopy: { flex: 1 },
  storyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  playButtonActive: { backgroundColor: colors.amber },
  playText: { color: colors.navyDeep, fontSize: 17, fontWeight: '900' },
  promptBox: { backgroundColor: colors.sand, borderRadius: radius.md, padding: 10, gap: 3 },
  promptLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  promptText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 24, alignItems: 'center', gap: 7 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
