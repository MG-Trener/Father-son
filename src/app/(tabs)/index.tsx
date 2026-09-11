import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { supabase } from '../../lib/supabase';
import { colors, moduleColors, radius, shadows } from '../../theme';

const directions = [
  { id: 'school', icon: '📘', title: 'Школа', detail: 'Знания и уверенность', color: moduleColors.school },
  { id: 'football', icon: '⚽', title: 'Футбол', detail: 'Сила и характер', color: moduleColors.football },
  { id: 'chess', icon: '♟', title: 'Шахматы', detail: 'Мыслить на шаг вперёд', color: moduleColors.chess },
  { id: 'english', icon: 'EN', title: 'English', detail: 'Открывать мир', color: moduleColors.english },
  { id: 'leadership', icon: '★', title: 'Лидерство', detail: 'Решения и ответственность', color: moduleColors.leadership },
] as const;

const moodChoices = [
  { key: 'great', emoji: '😄', label: 'Огонь' },
  { key: 'good', emoji: '🙂', label: 'Хорошо' },
  { key: 'okay', emoji: '😐', label: 'Норм' },
  { key: 'low', emoji: '😕', label: 'Так себе' },
  { key: 'sad', emoji: '😔', label: 'Грустно' },
] as const;

type MoodRow = { user_id: string; mood: string; created_at: string };
type LatestMoodMap = Record<string, MoodRow>;
type UpcomingMeeting = { id: string; meeting_date: string; title: string };

const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const daysUntil = (dateValue: string) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meeting = new Date(`${dateValue}T00:00:00`);
  return Math.max(0, Math.round((meeting.getTime() - today.getTime()) / 86_400_000));
};

const countdownText = (meeting: UpcomingMeeting | null) => {
  if (!meeting) return 'Запланировать';
  const days = daysUntil(meeting.meeting_date);
  if (days === 0) return 'Сегодня!';
  if (days === 1) return 'Завтра';
  if (days >= 2 && days <= 4) return `Через ${days} дня`;
  return `Через ${days} дней`;
};

const moodPresentation = (mood?: string) => (
  moodChoices.find((choice) => choice.key === mood) ?? { key: 'none', emoji: '○', label: 'Нет отметки' }
);

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || '•';

export default function HomeScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [latestMoods, setLatestMoods] = useState<LatestMoodMap>({});
  const [interactions, setInteractions] = useState(0);
  const [completedMissions, setCompletedMissions] = useState(0);
  const [growthCount, setGrowthCount] = useState(0);
  const [nextMeeting, setNextMeeting] = useState<UpcomingMeeting | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent'), [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child'), [members]);

  const parentName = parent?.display_name ?? 'Михаил';
  const childName = child?.display_name ?? 'Артур';
  const isChild = me?.role === 'child';
  const myName = isChild ? childName : parentName;
  const teamName = family?.name ?? `${parentName} + ${childName}`;
  const isLive = Boolean(supabase && session && family && me);

  const loadHomeData = useCallback(async () => {
    if (!supabase || !family) return;

    const [moodsResult, interactionsResult, missionsResult, growthResult, meetingResult] = await Promise.all([
      supabase.from('moods').select('user_id,mood,created_at').eq('family_id', family.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('activity_events').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('category', 'together'),
      supabase.from('missions').select('id', { count: 'exact', head: true }).eq('family_id', family.id).eq('status', 'completed'),
      supabase.from('growth_entries').select('id', { count: 'exact', head: true }).eq('family_id', family.id),
      supabase.from('meetings').select('id,meeting_date,title').eq('family_id', family.id).eq('status', 'planned').gte('meeting_date', todayIso()).order('meeting_date', { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (!moodsResult.error) {
      const next: LatestMoodMap = {};
      for (const row of (moodsResult.data ?? []) as MoodRow[]) if (!next[row.user_id]) next[row.user_id] = row;
      setLatestMoods(next);
    }
    if (!interactionsResult.error) setInteractions(interactionsResult.count ?? 0);
    if (!missionsResult.error) setCompletedMissions(missionsResult.count ?? 0);
    if (!growthResult.error) setGrowthCount(growthResult.count ?? 0);
    if (!meetingResult.error) setNextMeeting((meetingResult.data as UpcomingMeeting | null) ?? null);
  }, [family]);

  useEffect(() => { void loadHomeData(); }, [loadHomeData]);

  const saveMood = async (mood: string) => {
    if (!supabase || !family || !session || actionBusy) return;
    setActionBusy(true);
    try {
      const { error } = await supabase.from('moods').insert({ family_id: family.id, user_id: session.user.id, mood });
      if (error) throw error;
      await loadHomeData();
    } catch (caught) {
      Alert.alert('Не удалось сохранить настроение', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setActionBusy(false);
    }
  };

  const sendFiveMinutes = async () => {
    if (!supabase || !family || !session || actionBusy) {
      if (!isLive) Alert.alert('Демо-режим', 'После подключения Supabase эта карточка отправит сигнал второму участнику.');
      return;
    }
    setActionBusy(true);
    try {
      const { error } = await supabase.rpc('send_connection_signal', {
        p_family_id: family.id,
        p_signal_type: 'five_minutes',
        p_message: null,
      });
      if (error) {
        if (error.message.includes('SIGNAL_TOO_SOON')) {
          Alert.alert('Сигнал уже отправлен', 'Подожди немного перед повторной отправкой.');
          return;
        }
        throw error;
      }
      setInteractions((value) => value + 1);
      Alert.alert('Отправлено ✦', `${isChild ? parentName : childName} увидит, что у тебя есть несколько минут на связь.`);
    } catch (caught) {
      Alert.alert('Не удалось отправить сигнал', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setActionBusy(false);
    }
  };

  const parentMood = moodPresentation(parent ? latestMoods[parent.user_id]?.mood : 'great');
  const childMood = moodPresentation(child ? latestMoods[child.user_id]?.mood : 'good');
  const myMood = me ? moodPresentation(latestMoods[me.user_id]?.mood) : null;
  const todayQuestion = isChild
    ? 'Какой момент сегодня ты хотел бы показать папе?'
    : 'Что сегодня ты хотел бы рассказать Артуру не как совет, а просто как историю?';

  const heroTitle = isChild ? `Привет, ${myName}!` : `Привет, ${myName}`;
  const heroSubtitle = isChild
    ? 'Сегодня — ещё один маленький шаг к твоей большой истории.'
    : `Самое важное для ${childName} — знать, что папа рядом.`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>Папа <Text style={styles.brandAmp}>&</Text> Я</Text>
            <Text style={styles.brandCaption}>Больше, чем планы. Настоящее вместе.</Text>
          </View>
          <Pressable style={styles.teamChip} onPress={() => router.push('/(tabs)/us')}>
            <View style={styles.teamFaces}>
              <View style={[styles.miniFace, styles.miniFaceDad]}><Text style={styles.miniFaceText}>{initial(parentName)}</Text></View>
              <View style={[styles.miniFace, styles.miniFaceChild]}><Text style={styles.miniFaceText}>{initial(childName)}</Text></View>
            </View>
            <Text style={styles.teamChipText}>{teamName}</Text>
          </Pressable>
        </View>

        <ImageBackground
          source={require('../../../assets/generated/family-hero.png')}
          style={[styles.hero, shadows.lift]}
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={isChild ? ['rgba(8,31,42,0.16)', 'rgba(8,31,42,0.40)', 'rgba(5,22,31,0.92)'] : ['rgba(8,31,42,0.12)', 'rgba(8,31,42,0.48)', 'rgba(5,22,31,0.94)']}
            locations={[0, 0.48, 1]}
            style={styles.heroOverlay}
          >
            <View style={styles.heroTopRow}>
              <View style={[styles.modePill, isChild ? styles.modePillChild : styles.modePillDad]}>
                <Text style={styles.modePillText}>{isChild ? 'МОЙ ПУТЬ' : 'РЕЖИМ ПАПЫ'}</Text>
              </View>
              <View style={styles.heroQuotePill}>
                <Text style={styles.heroQuote}>Вместе к большему</Text>
              </View>
            </View>

            <View style={styles.heroBottom}>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

              <Pressable style={styles.meetingBar} onPress={() => router.push('/meeting-plan')}>
                <View style={styles.meetingIcon}><Text style={styles.meetingIconText}>⌁</Text></View>
                <View style={styles.meetingCopy}>
                  <Text style={styles.meetingEyebrow}>СЛЕДУЮЩАЯ ВСТРЕЧА</Text>
                  <Text style={styles.meetingTitle}>{countdownText(nextMeeting)}</Text>
                  <Text style={styles.meetingHint} numberOfLines={1}>{nextMeeting?.title ?? 'Выбрать дату и придумать приключение'}</Text>
                </View>
                <Text style={styles.meetingArrow}>›</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </ImageBackground>

        {isLive ? (
          <View style={[styles.moodCard, shadows.soft]}>
            <View style={styles.sectionHead}>
              <View>
                <Text style={styles.eyebrow}>СЕГОДНЯ</Text>
                <Text style={styles.sectionTitle}>Как ты?</Text>
              </View>
              {myMood ? <Text style={styles.moodCurrent}>{myMood.emoji} {myMood.label}</Text> : null}
            </View>
            <View style={styles.moodRow}>
              {moodChoices.map((choice) => {
                const active = me ? latestMoods[me.user_id]?.mood === choice.key : false;
                return (
                  <Pressable
                    key={choice.key}
                    disabled={actionBusy}
                    onPress={() => void saveMood(choice.key)}
                    style={[styles.moodButton, active && styles.moodButtonActive]}
                  >
                    <Text style={styles.moodEmoji}>{choice.emoji}</Text>
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>ВАЖНОЕ НА СЕГОДНЯ</Text>
            <Text style={styles.sectionTitle}>{isChild ? 'Мои маленькие шаги' : 'Быть рядом'}</Text>
          </View>
          <Text style={styles.sectionTiny}>без гонки и давления</Text>
        </View>

        <View style={styles.actionGrid}>
          <Pressable style={[styles.actionCard, styles.actionCardPrimary, shadows.soft]} onPress={() => void sendFiveMinutes()} disabled={actionBusy}>
            <View style={styles.actionIconLight}><Text style={styles.actionIconLightText}>♥</Text></View>
            <Text style={styles.actionKicker}>БЫСТРАЯ СВЯЗЬ</Text>
            <Text style={styles.actionTitleLight}>Есть 5 минут?</Text>
            <Text style={styles.actionTextLight}>{isChild ? 'Позвать папу поговорить или сыграть.' : `Показать ${childName}, что сейчас ты свободен для него.`}</Text>
            <View style={styles.actionFooterLight}><Text style={styles.actionFooterLightText}>Позвать</Text><Text style={styles.actionFooterLightArrow}>→</Text></View>
          </Pressable>

          <Pressable
            style={[styles.actionCard, styles.actionCardWarm, shadows.soft]}
            onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: todayQuestion } })}
          >
            <Text style={styles.actionQuote}>“</Text>
            <Text style={styles.actionKickerWarm}>ВОПРОС ДНЯ</Text>
            <Text style={styles.actionQuestion}>{todayQuestion}</Text>
            <Text style={styles.actionAnswer}>Ответить ↗</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>ПУТЬ АРТУРА</Text>
            <Text style={styles.sectionTitle}>Растём в своём темпе</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/development')}><Text style={styles.sectionLink}>Весь путь →</Text></Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.directionRow}>
          {directions.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.directionCard, { backgroundColor: item.color.base }, shadows.soft]}
              onPress={() => router.push({ pathname: '/growth-journal', params: { category: item.id } })}
            >
              <View style={[styles.directionIcon, { backgroundColor: item.color.strong }]}>
                <Text style={styles.directionIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.directionTitle}>{item.title}</Text>
              <Text style={styles.directionDetail}>{item.detail}</Text>
              <View style={[styles.directionLine, { backgroundColor: item.color.glow }]}>
                <View style={[styles.directionLineFill, { backgroundColor: item.color.strong }]} />
              </View>
              <Text style={[styles.directionOpen, { color: item.color.strong }]}>Открыть →</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={[styles.bookCard, shadows.soft]} onPress={() => router.push('/(tabs)/yearbook')}>
          <LinearGradient colors={['#F6E7CB', '#FFF9EE']} style={styles.bookGradient}>
            <View style={styles.bookBadge}><Text style={styles.bookBadgeText}>КНИГА ГОДА</Text></View>
            <Text style={styles.bookTitle}>Не потерять то, что действительно важно</Text>
            <Text style={styles.bookText}>Миссии, достижения, голосовые истории и ваши ответы собираются в одну историю взросления.</Text>
            <View style={styles.bookFooter}>
              <View>
                <Text style={styles.bookStat}>{growthCount + completedMissions + interactions}</Text>
                <Text style={styles.bookStatLabel}>моментов уже сохранено</Text>
              </View>
              <View style={styles.bookButton}><Text style={styles.bookButtonText}>Открыть книгу</Text><Text style={styles.bookButtonArrow}>›</Text></View>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={[styles.growthCard, shadows.soft]}>
          <View style={styles.growthHeader}>
            <View>
              <Text style={styles.eyebrow}>НАШ РОСТ</Text>
              <Text style={styles.sectionTitle}>Команда в цифрах</Text>
            </View>
            <View style={styles.growthHeart}><Text style={styles.growthHeartText}>♥</Text></View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}><Text style={styles.statValue}>{completedMissions}</Text><Text style={styles.statLabel}>миссий</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statValue}>{interactions}</Text><Text style={styles.statLabel}>моментов вместе</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Text style={styles.statValue}>{growthCount}</Text><Text style={styles.statLabel}>записей пути</Text></View>
          </View>
          <View style={styles.moodPeopleRow}>
            <View style={styles.personMood}><View style={[styles.personAvatar, styles.personAvatarDad]}><Text style={styles.personAvatarText}>{initial(parentName)}</Text></View><View><Text style={styles.personName}>{parentName}</Text><Text style={styles.personMoodText}>{parentMood.emoji} {parentMood.label}</Text></View></View>
            <View style={styles.personMood}><View style={[styles.personAvatar, styles.personAvatarChild]}><Text style={styles.personAvatarText}>{initial(childName)}</Text></View><View><Text style={styles.personName}>{childName}</Text><Text style={styles.personMoodText}>{childMood.emoji} {childMood.label}</Text></View></View>
          </View>
        </View>

        <View style={styles.signatureCard}>
          <Text style={styles.signatureMark}>⌁</Text>
          <Text style={styles.signatureText}>{isChild ? '«Ты можешь больше, чем думаешь. И я всегда рядом.»' : '«Не успеть всё. Успеть главное.»'}</Text>
          <Text style={styles.signatureAuthor}>{isChild ? '— Папа ♥' : `— для ${childName}`}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E7' },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, gap: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 2 },
  brand: { color: colors.navyDeep, fontSize: 29, fontWeight: '900', letterSpacing: -1.2 },
  brandAmp: { color: colors.amber },
  brandCaption: { color: '#7B7A72', fontSize: 10, fontWeight: '700', marginTop: 2 },
  teamChip: { maxWidth: 160, minHeight: 47, backgroundColor: colors.paper, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#E8DFD0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamFaces: { width: 48, flexDirection: 'row' },
  miniFace: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  miniFaceDad: { backgroundColor: colors.navy, zIndex: 2 },
  miniFaceChild: { backgroundColor: colors.amber, marginLeft: -8 },
  miniFaceText: { color: colors.white, fontWeight: '900', fontSize: 11 },
  teamChipText: { flexShrink: 1, color: colors.navy, fontSize: 9, fontWeight: '900' },
  hero: { height: 386, borderRadius: 30, overflow: 'hidden' },
  heroImage: { borderRadius: 30 },
  heroOverlay: { flex: 1, padding: 18, justifyContent: 'space-between' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modePill: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  modePillDad: { backgroundColor: 'rgba(7,31,42,0.58)' },
  modePillChild: { backgroundColor: 'rgba(245,172,60,0.90)' },
  modePillText: { color: colors.white, fontSize: 8, letterSpacing: 1.2, fontWeight: '900' },
  heroQuotePill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  heroQuote: { color: colors.white, fontSize: 9, fontWeight: '800' },
  heroBottom: { gap: 7 },
  heroTitle: { color: colors.white, fontSize: 32, lineHeight: 35, fontWeight: '900', letterSpacing: -1.2 },
  heroSubtitle: { color: '#F7F1E8', fontSize: 13, lineHeight: 19, fontWeight: '700', maxWidth: '88%', marginBottom: 8 },
  meetingBar: { minHeight: 78, backgroundColor: 'rgba(255,255,255,0.93)', borderRadius: 20, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  meetingIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F8E0AA', alignItems: 'center', justifyContent: 'center' },
  meetingIconText: { color: colors.navyDeep, fontSize: 28, fontWeight: '900', transform: [{ rotate: '-12deg' }] },
  meetingCopy: { flex: 1 },
  meetingEyebrow: { color: '#899394', fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  meetingTitle: { color: colors.navyDeep, fontSize: 18, fontWeight: '900', marginTop: 1 },
  meetingHint: { color: '#737E80', fontSize: 9, marginTop: 2, fontWeight: '600' },
  meetingArrow: { color: colors.navyDeep, fontSize: 29, opacity: 0.7 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  eyebrow: { color: '#879194', fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 3, letterSpacing: -0.4 },
  sectionTiny: { color: '#A19D92', fontSize: 8, fontWeight: '700', maxWidth: 90, textAlign: 'right' },
  sectionLink: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  moodCard: { backgroundColor: colors.paper, borderRadius: 24, padding: 15, borderWidth: 1, borderColor: '#E9DFD0' },
  moodCurrent: { color: colors.green, fontSize: 10, fontWeight: '900', backgroundColor: '#E1F0E7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  moodRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  moodButton: { flex: 1, minHeight: 62, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F1E9', borderWidth: 1.5, borderColor: 'transparent' },
  moodButtonActive: { backgroundColor: '#E2F1E9', borderColor: colors.green, transform: [{ translateY: -2 }] },
  moodEmoji: { fontSize: 22 },
  moodLabel: { color: '#7B8587', fontSize: 7.5, fontWeight: '800', marginTop: 4 },
  moodLabelActive: { color: colors.green },
  actionGrid: { flexDirection: 'row', gap: 11 },
  actionCard: { flex: 1, minHeight: 225, borderRadius: 26, padding: 16, overflow: 'hidden' },
  actionCardPrimary: { backgroundColor: '#0E4252' },
  actionCardWarm: { backgroundColor: '#F0C46D' },
  actionIconLight: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.13)' },
  actionIconLightText: { color: '#FFD26A', fontSize: 20 },
  actionKicker: { color: '#9FC3CA', fontSize: 7.5, fontWeight: '900', letterSpacing: 1, marginTop: 19 },
  actionTitleLight: { color: colors.white, fontSize: 25, lineHeight: 28, fontWeight: '900', marginTop: 3, letterSpacing: -0.8 },
  actionTextLight: { color: '#D0E0E3', fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 8 },
  actionFooterLight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  actionFooterLightText: { color: '#FFD26A', fontSize: 10, fontWeight: '900' },
  actionFooterLightArrow: { color: colors.white, fontSize: 19 },
  actionQuote: { position: 'absolute', right: 13, top: 4, color: 'rgba(255,255,255,0.34)', fontSize: 88, fontWeight: '900' },
  actionKickerWarm: { color: '#805E22', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  actionQuestion: { color: '#3C3425', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 34 },
  actionAnswer: { color: '#3C3425', fontSize: 10, fontWeight: '900', marginTop: 'auto' },
  directionRow: { gap: 10, paddingRight: 8, paddingBottom: 2 },
  directionCard: { width: 150, minHeight: 176, borderRadius: 23, padding: 14, overflow: 'hidden' },
  directionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  directionIconText: { color: colors.white, fontSize: 19, fontWeight: '900' },
  directionTitle: { color: colors.navyDeep, fontSize: 15, fontWeight: '900', marginTop: 12 },
  directionDetail: { color: '#657477', fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 3, minHeight: 27 },
  directionLine: { height: 6, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  directionLineFill: { width: '62%', height: '100%', borderRadius: 4 },
  directionOpen: { fontSize: 9, fontWeight: '900', marginTop: 10 },
  bookCard: { borderRadius: 27, overflow: 'hidden' },
  bookGradient: { padding: 18 },
  bookBadge: { alignSelf: 'flex-start', backgroundColor: '#0D4050', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  bookBadgeText: { color: '#FFD16A', fontSize: 7.5, fontWeight: '900', letterSpacing: 1.1 },
  bookTitle: { color: colors.navyDeep, fontSize: 22, lineHeight: 26, fontWeight: '900', marginTop: 14, maxWidth: '88%', letterSpacing: -0.5 },
  bookText: { color: '#6A6E69', fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 7, maxWidth: '94%' },
  bookFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  bookStat: { color: colors.navyDeep, fontSize: 25, fontWeight: '900' },
  bookStatLabel: { color: '#8A8C84', fontSize: 8, fontWeight: '700', marginTop: 1 },
  bookButton: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bookButtonText: { color: colors.navyDeep, fontSize: 9, fontWeight: '900' },
  bookButtonArrow: { color: colors.navyDeep, fontSize: 19, lineHeight: 19 },
  growthCard: { backgroundColor: colors.paper, borderRadius: 27, padding: 17, borderWidth: 1, borderColor: '#E9DFD0' },
  growthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  growthHeart: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#E1F0E7', alignItems: 'center', justifyContent: 'center' },
  growthHeartText: { color: colors.green, fontSize: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 18, backgroundColor: '#F6F1E8', borderRadius: 20, paddingVertical: 14 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  statValue: { color: colors.navyDeep, fontSize: 21, fontWeight: '900' },
  statLabel: { color: '#7E8889', fontSize: 7.5, fontWeight: '800', textAlign: 'center', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#DED8CC', marginVertical: 2 },
  moodPeopleRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  personMood: { flex: 1, minHeight: 63, borderRadius: 18, borderWidth: 1, borderColor: '#E8E1D5', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  personAvatar: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  personAvatarDad: { backgroundColor: colors.navy },
  personAvatarChild: { backgroundColor: colors.amber },
  personAvatarText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  personName: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  personMoodText: { color: '#7B8587', fontSize: 8, fontWeight: '700', marginTop: 2 },
  signatureCard: { minHeight: 93, borderRadius: 25, backgroundColor: '#EFE2CE', padding: 17, paddingLeft: 63, justifyContent: 'center', overflow: 'hidden' },
  signatureMark: { position: 'absolute', left: 17, top: 22, color: '#31515B', fontSize: 34, fontWeight: '900', transform: [{ rotate: '-12deg' }] },
  signatureText: { color: '#513F2F', fontSize: 13, lineHeight: 18, fontWeight: '800', fontStyle: 'italic' },
  signatureAuthor: { color: '#7D6652', fontSize: 9, fontWeight: '900', marginTop: 5, alignSelf: 'flex-end' },
});
