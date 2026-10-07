import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { brandAssets } from '../brandAssets';
import {
  createVoiceStorySignedUrl,
  listVoiceStories,
  type VoiceStory,
} from '../data/memoryArchiveRepository';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

const artwork = {
  voice: brandAssets.utility.voice,
  recognition: brandAssets.utility.recognition,
  together: brandAssets.navigation.together,
  book: brandAssets.navigation.book,
} as const;

const archiveWave = [12, 23, 17, 32, 21, 28, 14, 35, 24, 19, 30, 15];

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

const totalMinutesLabel = (stories: VoiceStory[]) => {
  const minutes = Math.max(0, Math.round(stories.reduce((sum, story) => sum + story.duration_ms, 0) / 60_000));
  return `${minutes}`;
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
  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }

    try {
      setStories(await listVoiceStories(client, family.id));
    } catch (caught) {
      Alert.alert('Не удалось загрузить архив', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
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
    const client = supabase;
    if (!client) return;

    if (playingId === story.id && playerStatus.playing) {
      player.pause();
      return;
    }

    setOpeningId(story.id);
    try {
      const signedUrl = await createVoiceStorySignedUrl(client, story.storage_path);
      player.replace(signedUrl);
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>Голосовой архив</Text>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroOrb} />
          <View style={styles.heroRing} />
          <View style={styles.heroHeading}>
            <View style={styles.heroArtworkShell}><Image source={artwork.book} style={styles.heroArtwork} resizeMode="contain" /></View>
            <View style={styles.heroHeadingCopy}>
              <Text style={styles.heroKicker}>КОЛЛЕКЦИЯ ГОЛОСОВ</Text>
              <Text style={styles.heroTitle}>То, что через годы будет особенно ценно услышать снова.</Text>
            </View>
          </View>

          <View style={styles.teamRow}>
            <View style={styles.person}>
              <View style={[styles.avatar, styles.avatarDad]}><Text style={styles.avatarText}>М</Text></View>
              <Text style={styles.personName}>{parent?.display_name ?? 'Михаил'}</Text>
            </View>
            <View style={styles.connection}>
              <View style={styles.connectionLine} />
              <View style={styles.audioBadge}><Image source={artwork.voice} style={styles.audioBadgeImage} resizeMode="contain" /></View>
              <View style={styles.connectionLine} />
            </View>
            <View style={styles.person}>
              <View style={[styles.avatar, styles.avatarSon]}><Text style={styles.avatarText}>А</Text></View>
              <Text style={styles.personName}>{child?.display_name ?? 'Артур'}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stories.length}</Text>
              <Text style={styles.statLabel}>историй</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalMinutesLabel(stories)}</Text>
              <Text style={styles.statLabel}>минут голоса</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>∞</Text>
              <Text style={styles.statLabel}>на память</Text>
            </View>
          </View>
        </LinearGradient>

        <Pressable style={[styles.recordCard, shadows.soft]} onPress={() => router.push('/voice-story-new')}>
          <LinearGradient colors={gradients.connection} style={styles.recordGradient}>
            <View style={styles.recordVisual}>
              <View style={styles.recordDot}><Image source={artwork.voice} style={styles.recordDotImage} resizeMode="contain" /></View>
              <View style={styles.miniWave}>
                {archiveWave.slice(0, 8).map((height, index) => (
                  <View key={`new-${height}-${index}`} style={[styles.miniWaveBar, { height: Math.max(7, Math.floor(height * 0.65)) }]} />
                ))}
              </View>
            </View>
            <View style={styles.recordCopy}>
              <Text style={styles.recordKicker}>НОВАЯ АУДИОКАПСУЛА</Text>
              <Text style={styles.recordTitle}>Записать новый момент</Text>
              <Text style={styles.recordText}>После матча, перед сном, после важного разговора — или просто без повода.</Text>
            </View>
            <View style={styles.recordArrow}><Text style={styles.recordArrowText}>→</Text></View>
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Наши записи</Text>
          <View style={styles.sectionLine} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
        ) : stories.length ? (
          <View style={styles.list}>
            {stories.map((story, index) => {
              const author = names.get(story.author_user_id) ?? 'Участник команды';
              const isPlaying = playingId === story.id && playerStatus.playing;
              const isOpening = openingId === story.id;
              const isParentStory = story.author_user_id === parent?.user_id;
              return (
                <View key={story.id} style={[styles.storyCard, shadows.soft]}>
                  <View style={styles.storyTop}>
                    <View style={[styles.authorBadge, isParentStory ? styles.authorDad : styles.authorSon]}>
                      <Text style={styles.authorLetter}>{author.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.storyCopy}>
                      <Text style={styles.storyKicker}>ЗАПИСЬ #{stories.length - index}</Text>
                      <Text style={styles.storyTitle}>{story.title || 'Голосовая история'}</Text>
                      <Text style={styles.meta}>{author} · {dateLabel(story.recorded_at)}</Text>
                    </View>
                    <View style={styles.durationChip}><Text style={styles.durationText}>{durationLabel(story.duration_ms)}</Text></View>
                  </View>

                  <View style={styles.audioRow}>
                    <Pressable
                      disabled={isOpening}
                      onPress={() => void playStory(story)}
                      style={[styles.playButton, isPlaying && styles.playButtonActive]}
                    >
                      {isOpening ? (
                        <ActivityIndicator size="small" color={colors.navyDeep} />
                      ) : (
                        <Text style={[styles.playText, isPlaying && styles.playTextActive]}>{isPlaying ? 'Ⅱ' : '▶'}</Text>
                      )}
                    </Pressable>
                    <View style={styles.storyWave}>
                      {archiveWave.map((height, waveIndex) => (
                        <View
                          key={`${story.id}-${waveIndex}`}
                          style={[
                            styles.storyWaveBar,
                            { height },
                            isPlaying && waveIndex % 3 !== 0 ? styles.storyWaveBarActive : null,
                          ]}
                        />
                      ))}
                    </View>
                  </View>

                  {story.prompt ? (
                    <View style={styles.promptBox}>
                      <View style={styles.promptIcon}><Image source={artwork.recognition} style={styles.promptIconImage} resizeMode="contain" /></View>
                      <View style={styles.promptBody}>
                        <Text style={styles.promptLabel}>С ЧЕГО НАЧАЛСЯ ЭТОТ РАЗГОВОР</Text>
                        <Text style={styles.promptText}>{story.prompt}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyCard, shadows.soft]}>
            <View style={styles.emptyVisual}>
              <View style={styles.emptyCircle}><Image source={artwork.together} style={styles.emptyIconImage} resizeMode="contain" /></View>
              <View style={styles.emptyWave}>
                {archiveWave.slice(0, 7).map((height, index) => (
                  <View key={`empty-${index}`} style={[styles.emptyBar, { height: Math.max(6, Math.floor(height * 0.5)) }]} />
                ))}
              </View>
            </View>
            <Text style={styles.emptyTitle}>Здесь появятся ваши голоса</Text>
            <Text style={styles.emptyText}>Первая запись может быть совсем короткой: чем запомнился сегодняшний день, что рассмешило или что хочется сказать друг другу.</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/voice-story-new')}>
              <Text style={styles.emptyButtonText}>Записать первую →</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.privateCard}>
          <View style={styles.lockBadge}><Text style={styles.lockText}>⌁</Text></View>
          <View style={styles.privateBody}>
            <Text style={styles.privateTitle}>Приватный семейный архив</Text>
            <Text style={styles.privateText}>Для проигрывания приложение получает временную ссылку только на 10 минут. Постоянной публичной ссылки на аудио нет.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  hero: { minHeight: 340, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'space-between' },
  heroOrb: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,215,106,0.09)', top: -78, right: -54 },
  heroRing: { position: 'absolute', width: 115, height: 115, borderRadius: 58, borderWidth: 2, borderColor: 'rgba(255,255,255,0.09)', bottom: 26, left: -48 },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroHeadingCopy: { flex: 1 },
  heroArtworkShell: { width: 66, height: 66, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroArtwork: { width: 57, height: 57 },
  heroKicker: { color: colors.sun, fontSize: 14, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5, maxWidth: '96%', marginTop: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  person: { width: 64, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarDad: { backgroundColor: colors.tealBright },
  avatarSon: { backgroundColor: colors.orange },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  personName: { color: colors.white, fontSize: 14, fontWeight: '900', marginTop: 5 },
  connection: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  connectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  audioBadge: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  audioBadgeImage: { width: 36, height: 36 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: radius.lg, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center' },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.white, fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#BDD0D4', fontSize: 14, fontWeight: '800', marginTop: 2 },
  statDivider: { width: 1, height: 29, backgroundColor: 'rgba(255,255,255,0.12)' },
  recordCard: { borderRadius: radius.xl, overflow: 'hidden' },
  recordGradient: { minHeight: 165, padding: 18, justifyContent: 'flex-end' },
  recordVisual: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  recordDot: { width: 58, height: 58, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center' },
  recordDotImage: { width: 51, height: 51 },
  miniWave: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniWaveBar: { width: 4, borderRadius: 3, backgroundColor: 'rgba(8,43,56,0.52)' },
  recordCopy: { maxWidth: '82%' },
  recordKicker: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', letterSpacing: 1.4, opacity: 0.72 },
  recordTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 3 },
  recordText: { color: '#4E493F', fontSize: 14, lineHeight: 20, marginTop: 4 },
  recordArrow: { position: 'absolute', right: 18, bottom: 18, width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  recordArrowText: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  sectionTitle: { color: colors.navyDeep, fontSize: 16, fontWeight: '900' },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.lineWarm },
  loader: { marginVertical: 36 },
  list: { gap: 12 },
  storyCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 16, gap: 13 },
  storyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorBadge: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  authorDad: { backgroundColor: colors.tealBright },
  authorSon: { backgroundColor: colors.orange },
  authorLetter: { color: colors.white, fontSize: 16, fontWeight: '900' },
  storyCopy: { flex: 1 },
  storyKicker: { color: colors.mutedSoft, fontSize: 14, fontWeight: '900', letterSpacing: 1.1 },
  storyTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
  durationChip: { backgroundColor: colors.sandWarm, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  durationText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  playButton: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  playButtonActive: { backgroundColor: colors.navyDeep },
  playText: { color: colors.navyDeep, fontSize: 15, fontWeight: '900' },
  playTextActive: { color: colors.white },
  storyWave: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', gap: 4 },
  storyWaveBar: { flex: 1, maxWidth: 4, borderRadius: 3, backgroundColor: colors.lineWarm },
  storyWaveBarActive: { backgroundColor: colors.tealBright },
  promptBox: { backgroundColor: colors.sandWarm, borderRadius: radius.md, padding: 11, flexDirection: 'row', gap: 9 },
  promptIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF7E6', alignItems: 'center', justifyContent: 'center' },
  promptIconImage: { width: 29, height: 29 },
  promptBody: { flex: 1 },
  promptLabel: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  promptText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineWarm, padding: 22, alignItems: 'center', gap: 8 },
  emptyVisual: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emptyCircle: { width: 58, height: 58, borderRadius: 19, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center' },
  emptyIconImage: { width: 50, height: 50 },
  emptyWave: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 },
  emptyBar: { width: 4, borderRadius: 3, backgroundColor: colors.lineWarm },
  emptyTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyButton: { marginTop: 7, backgroundColor: colors.navyDeep, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  emptyButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  privateCard: { backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'center' },
  lockBadge: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  lockText: { color: colors.green, fontSize: 17, fontWeight: '900' },
  privateBody: { flex: 1 },
  privateTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  privateText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
});