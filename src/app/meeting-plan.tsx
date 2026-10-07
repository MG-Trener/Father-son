import { AppScrollView as ScrollView } from '../components/AppScrollView';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type MeetingStatus = 'planned' | 'completed' | 'cancelled';
type IdeaReaction = 'want' | 'must' | 'maybe';

type Meeting = {
  id: string;
  meeting_date: string;
  title: string;
  note: string | null;
  status: MeetingStatus;
  created_by: string;
  updated_at: string;
};

type MeetingIdea = {
  id: string;
  meeting_id: string;
  family_id: string;
  created_by: string;
  title: string;
  created_at: string;
};

type MeetingIdeaReaction = {
  id: string;
  idea_id: string;
  user_id: string;
  reaction: IdeaReaction;
};

const reactionMeta: Record<IdeaReaction, { label: string; icon: string }> = {
  want: { label: 'Хочу', icon: '✨' },
  must: { label: 'Обязательно', icon: '🔥' },
  maybe: { label: 'Может быть', icon: '🤔' },
};

const todayIso = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());

const prettyDate = (value: string, year = true) => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'long',
  ...(year ? { year: 'numeric' as const } : {}),
});

const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
  day: 'numeric',
  month: 'short',
});

const daysUntil = (value: string) => {
  if (!validDate(value)) return null;
  const target = new Date(`${value}T12:00:00`).getTime();
  const today = new Date(`${todayIso()}T12:00:00`).getTime();
  return Math.max(0, Math.ceil((target - today) / 86_400_000));
};

const pluralDays = (value: number) => {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
};

export default function MeetingPlanScreen() {
  const { session } = useAuth();
  const { family, members, me } = useFamily();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<MeetingIdea[]>([]);
  const [reactions, setReactions] = useState<MeetingIdeaReaction[]>([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);

  const upcoming = useMemo(() => meetings
    .filter((item) => item.status === 'planned' && item.meeting_date >= todayIso())
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)), [meetings]);

  const history = useMemo(() => meetings
    .filter((item) => item.status === 'completed')
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date)), [meetings]);

  const selectedMeeting = useMemo(() => meetings.find((item) => item.id === selectedMeetingId)
    ?? upcoming[0]
    ?? history[0]
    ?? null, [meetings, selectedMeetingId, upcoming, history]);

  const nextMeeting = upcoming[0] ?? null;
  const countdown = nextMeeting ? daysUntil(nextMeeting.meeting_date) : null;

  const loadMeetings = useCallback(async () => {
    const client = supabase;
    if (!client || !family) {
      setLoading(false);
      return;
    }

    const { data, error } = await client
      .from('meetings')
      .select('id,meeting_date,title,note,status,created_by,updated_at')
      .eq('family_id', family.id)
      .in('status', ['planned', 'completed'])
      .order('meeting_date', { ascending: true });

    if (error) {
      Alert.alert('Не удалось загрузить планы', error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Meeting[];
    setMeetings(rows);
    setSelectedMeetingId((current) => {
      if (current && rows.some((item) => item.id === current)) return current;
      const next = rows.find((item) => item.status === 'planned' && item.meeting_date >= todayIso())
        ?? [...rows].reverse().find((item) => item.status === 'completed')
        ?? null;
      return next?.id ?? null;
    });
    setLoading(false);
  }, [family]);

  const loadIdeas = useCallback(async (meetingId: string | null) => {
    const client = supabase;
    if (!client || !family || !meetingId) {
      setIdeas([]);
      setReactions([]);
      return;
    }

    const ideasResult = await client
      .from('meeting_ideas')
      .select('id,meeting_id,family_id,created_by,title,created_at')
      .eq('meeting_id', meetingId)
      .eq('family_id', family.id)
      .order('created_at', { ascending: true });

    if (ideasResult.error) {
      Alert.alert('Не удалось загрузить идеи', ideasResult.error.message);
      return;
    }

    const rows = (ideasResult.data ?? []) as MeetingIdea[];
    setIdeas(rows);

    const ids = rows.map((item) => item.id);
    if (!ids.length) {
      setReactions([]);
      return;
    }

    const reactionsResult = await client
      .from('meeting_idea_reactions')
      .select('id,idea_id,user_id,reaction')
      .in('idea_id', ids);

    if (!reactionsResult.error) setReactions((reactionsResult.data ?? []) as MeetingIdeaReaction[]);
  }, [family]);

  useEffect(() => { void loadMeetings(); }, [loadMeetings]);
  useEffect(() => { void loadIdeas(selectedMeeting?.id ?? null); }, [loadIdeas, selectedMeeting?.id]);

  const refreshAll = async () => {
    setRefreshing(true);
    await loadMeetings();
    await loadIdeas(selectedMeeting?.id ?? null);
    setRefreshing(false);
  };

  const resetMeetingForm = () => {
    setDate('');
    setTitle('');
    setNote('');
    setShowNewMeeting(false);
  };

  const createMeeting = async () => {
    const client = supabase;
    if (!client || !family || !session || busy) return;
    if (!validDate(date) || date < todayIso()) {
      Alert.alert('Проверь дату', 'Выбери сегодняшнюю или будущую дату в формате ГГГГ-ММ-ДД.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Добавь название', 'Например: «Футбол и пицца» или «Наш выходной».');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await client.rpc('create_meeting_plan', {
        p_family_id: family.id,
        p_meeting_date: date,
        p_title: title.trim(),
        p_note: note.trim() || null,
      });
      if (error) throw error;

      const result = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : null;
      const meetingId = result && typeof result.meeting_id === 'string' ? result.meeting_id : null;
      if (!meetingId) throw new Error('MEETING_CREATE_RESULT_INVALID');

      resetMeetingForm();
      setSelectedMeetingId(meetingId);
      await loadMeetings();
      Alert.alert('План сохранён ✦', 'Теперь у вас есть ещё одна общая точка впереди.');
    } catch (caught) {
      Alert.alert('Не удалось сохранить план', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const addIdea = async () => {
    const client = supabase;
    if (!client || !family || !session || !selectedMeeting || selectedMeeting.status !== 'planned' || busy) return;
    const clean = newIdea.trim();
    if (!clean) return;

    setBusy(true);
    try {
      const { error } = await client.from('meeting_ideas').insert({
        meeting_id: selectedMeeting.id,
        family_id: family.id,
        created_by: session.user.id,
        title: clean,
        reaction: null,
      });
      if (error) throw error;
      setNewIdea('');
      await loadIdeas(selectedMeeting.id);
    } catch (caught) {
      Alert.alert('Не удалось добавить идею', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const setIdeaReaction = async (ideaId: string, reaction: IdeaReaction) => {
    const client = supabase;
    if (!client || !family || !session || busy) return;
    const mine = reactions.find((item) => item.idea_id === ideaId && item.user_id === session.user.id) ?? null;

    setBusy(true);
    try {
      if (mine?.reaction === reaction) {
        const { error } = await client
          .from('meeting_idea_reactions')
          .delete()
          .eq('idea_id', ideaId)
          .eq('user_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await client
          .from('meeting_idea_reactions')
          .upsert({
            idea_id: ideaId,
            family_id: family.id,
            user_id: session.user.id,
            reaction,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'idea_id,user_id' });
        if (error) throw error;
      }
      await loadIdeas(selectedMeeting?.id ?? null);
    } catch (caught) {
      Alert.alert('Не удалось сохранить реакцию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const completeMeeting = () => {
    const client = supabase;
    if (!client || !family || !session || !selectedMeeting || selectedMeeting.status !== 'planned' || busy) return;

    Alert.alert(
      'Встреча состоялась? 🤝',
      'Перенесём её в историю и предложим сохранить короткое воспоминание.',
      [
        { text: 'Пока нет', style: 'cancel' },
        {
          text: 'Да, встретились',
          onPress: () => void (async () => {
            setBusy(true);
            try {
              const { error } = await client.rpc('complete_meeting_plan', {
                p_meeting_id: selectedMeeting.id,
              });
              if (error) throw error;

              await loadMeetings();
              Alert.alert('Встреча в истории ✦', 'Сохранить одну мысль или момент?', [
                { text: 'Позже', style: 'cancel' },
                {
                  text: 'Сохранить момент',
                  onPress: () => router.push({ pathname: '/reflection-new', params: { prompt: `Что хочется запомнить после встречи «${selectedMeeting.title}»?` } }),
                },
              ]);
            } catch (caught) {
              Alert.alert('Не удалось завершить встречу', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
            } finally {
              setBusy(false);
            }
          })(),
        },
      ],
    );
  };

  const cancelMeeting = () => {
    const client = supabase;
    if (!client || !family || !selectedMeeting || selectedMeeting.status !== 'planned' || busy) return;
    Alert.alert('Отменить этот план?', 'Он исчезнет из будущих встреч, но не затронет другие планы.', [
      { text: 'Не отменять', style: 'cancel' },
      {
        text: 'Отменить план',
        style: 'destructive',
        onPress: () => void (async () => {
          setBusy(true);
          try {
            const { error } = await client
              .from('meetings')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() })
              .eq('id', selectedMeeting.id)
              .eq('family_id', family.id);
            if (error) throw error;
            setSelectedMeetingId(null);
            await loadMeetings();
          } catch (caught) {
            Alert.alert('Не удалось отменить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
          } finally {
            setBusy(false);
          }
        })(),
      },
    ]);
  };

  const ideaReactionCount = (ideaId: string, reaction: IdeaReaction) => reactions
    .filter((item) => item.idea_id === ideaId && item.reaction === reaction).length;

  const myReaction = (ideaId: string) => reactions.find((item) => item.idea_id === ideaId && item.user_id === me?.user_id)?.reaction ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor={colors.navy} />}
        >
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
            <View style={styles.topCopy}>
              <Text style={styles.topKicker}>ПАПА & Я</Text>
              <Text style={styles.topTitle}>Наши планы</Text>
            </View>
            <Pressable style={styles.addTop} onPress={() => setShowNewMeeting((value) => !value)}>
              <Text style={styles.addTopText}>{showNewMeeting ? '×' : '+'}</Text>
            </Pressable>
          </View>

          <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroPeople}>
              <View style={styles.personBox}>
                <View style={[styles.avatar, styles.avatarDad]}><Text style={styles.avatarText}>{(parent?.display_name ?? 'М').slice(0, 1).toUpperCase()}</Text></View>
                <Text style={styles.personName}>{parent?.display_name ?? 'Михаил'}</Text>
              </View>
              <View style={styles.routeWrap}>
                <View style={styles.routeLine} />
                <View style={styles.routeStar}><Image source={require('../../assets/generated/feature-together.png')} style={styles.routeStarImage} resizeMode="contain" /></View>
                <View style={styles.routeLine} />
              </View>
              <View style={styles.personBox}>
                <View style={[styles.avatar, styles.avatarSon]}><Text style={styles.avatarText}>{(child?.display_name ?? 'А').slice(0, 1).toUpperCase()}</Text></View>
                <Text style={styles.personName}>{child?.display_name ?? 'Артур'}</Text>
              </View>
            </View>

            {nextMeeting ? (
              <>
                <Text style={styles.heroKicker}>СЛЕДУЮЩАЯ ТОЧКА</Text>
                <Text style={styles.heroTitle}>{nextMeeting.title}</Text>
                <Text style={styles.heroDate}>{prettyDate(nextMeeting.meeting_date)}</Text>
                {countdown !== null ? (
                  <View style={styles.countdownRow}>
                    <Text style={styles.countdownValue}>{countdown}</Text>
                    <Text style={styles.countdownText}>{pluralDays(countdown)} до встречи</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.heroKicker}>СЛЕДУЮЩАЯ ТОЧКА</Text>
                <Text style={styles.heroTitle}>Придумаем, чего ждать вместе</Text>
                <Text style={styles.heroDate}>Даже небольшой план делает расстояние между встречами короче.</Text>
              </>
            )}
          </LinearGradient>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, shadows.soft]}><Text style={styles.statValue}>{upcoming.length}</Text><Text style={styles.statLabel}>впереди</Text></View>
            <View style={[styles.statCard, shadows.soft]}><Text style={styles.statValue}>{history.length}</Text><Text style={styles.statLabel}>в истории</Text></View>
            <View style={[styles.statCard, shadows.soft]}><Text style={styles.statValue}>{ideas.length}</Text><Text style={styles.statLabel}>идей сейчас</Text></View>
          </View>

          {showNewMeeting ? (
            <View style={[styles.newCard, shadows.soft]}>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionKicker}>НОВЫЙ ПЛАН</Text><Text style={styles.sectionTitle}>Добавить встречу</Text></View>
                <Image source={require('../../assets/generated/utility-calendar.png')} style={styles.sectionImage} resizeMode="contain" />
              </View>
              <TextInput value={date} onChangeText={setDate} placeholder="2026-09-20" placeholderTextColor={colors.mutedSoft} keyboardType="numbers-and-punctuation" style={styles.input} />
              {validDate(date) ? <Text style={styles.hint}>{prettyDate(date)}</Text> : null}
              <TextInput value={title} onChangeText={setTitle} placeholder="Футбол и пицца" placeholderTextColor={colors.mutedSoft} maxLength={100} style={styles.input} />
              <TextInput value={note} onChangeText={setNote} placeholder="Что хочется успеть вместе…" placeholderTextColor={colors.mutedSoft} maxLength={800} multiline textAlignVertical="top" style={[styles.input, styles.noteInput]} />
              <View style={styles.formActions}>
                <Pressable style={styles.secondaryButton} onPress={resetMeetingForm}><Text style={styles.secondaryText}>Отмена</Text></Pressable>
                <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void createMeeting()}>
                  <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : 'Добавить план'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionTitleRow}>
            <View><Text style={styles.sectionKicker}>ВПЕРЕДИ</Text><Text style={styles.sectionTitle}>Ближайшие встречи</Text></View>
            <Pressable onPress={() => setShowNewMeeting(true)}><Text style={styles.textAction}>+ добавить</Text></Pressable>
          </View>

          {upcoming.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meetingRail}>
              {upcoming.map((item, index) => {
                const active = selectedMeeting?.id === item.id;
                const left = daysUntil(item.meeting_date);
                return (
                  <Pressable key={item.id} onPress={() => setSelectedMeetingId(item.id)} style={[styles.meetingCard, active && styles.meetingCardActive, shadows.soft]}>
                    <View style={styles.meetingCardTop}>
                      <Text style={[styles.meetingDate, active && styles.meetingDateActive]}>{shortDate(item.meeting_date)}</Text>
                      <Text style={[styles.meetingNumber, active && styles.meetingNumberActive]}>0{index + 1}</Text>
                    </View>
                    <Text style={[styles.meetingTitle, active && styles.meetingTitleActive]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[styles.meetingNote, active && styles.meetingNoteActive]} numberOfLines={2}>{item.note || 'Главное — время вместе.'}</Text>
                    {left !== null ? <Text style={[styles.meetingDays, active && styles.meetingDaysActive]}>{left === 0 ? 'сегодня' : `через ${left} ${pluralDays(left)}`}</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Pressable style={[styles.emptyCard, shadows.soft]} onPress={() => setShowNewMeeting(true)}>
              <View style={styles.emptyImageWrap}><Image source={require('../../assets/generated/utility-calendar.png')} style={styles.emptyImage} resizeMode="contain" /></View>
              <View style={styles.emptyCopy}><Text style={styles.emptyTitle}>Пока ничего не запланировано</Text><Text style={styles.emptyText}>Добавьте хотя бы одну маленькую общую точку впереди.</Text></View>
              <Text style={styles.emptyArrow}>→</Text>
            </Pressable>
          )}

          {selectedMeeting ? (
            <View style={[styles.detailCard, shadows.soft]}>
              <View style={styles.detailHead}>
                <View style={styles.detailDateBox}>
                  <Text style={styles.detailDay}>{new Date(`${selectedMeeting.meeting_date}T12:00:00`).getDate()}</Text>
                  <Text style={styles.detailMonth}>{new Date(`${selectedMeeting.meeting_date}T12:00:00`).toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase()}</Text>
                </View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailKicker}>{selectedMeeting.status === 'completed' ? 'В НАШЕЙ ИСТОРИИ' : 'ВЫБРАННЫЙ ПЛАН'}</Text>
                  <Text style={styles.detailTitle}>{selectedMeeting.title}</Text>
                  {selectedMeeting.note ? <Text style={styles.detailNote}>{selectedMeeting.note}</Text> : null}
                </View>
              </View>

              <View style={styles.divider} />
              <View style={styles.ideaHeader}>
                <View><Text style={styles.sectionKicker}>КОПИЛКА ИДЕЙ</Text><Text style={styles.ideaTitle}>Что хочется сделать?</Text></View>
                <View style={styles.ideaCount}><Text style={styles.ideaCountText}>{ideas.length}</Text></View>
              </View>

              {ideas.length ? (
                <View style={styles.ideasList}>
                  {ideas.map((idea, index) => {
                    const mine = myReaction(idea.id);
                    return (
                      <View key={idea.id} style={styles.ideaItem}>
                        <View style={styles.ideaTopLine}>
                          <View style={[styles.ideaNumber, index % 2 === 0 ? styles.ideaNumberWarm : styles.ideaNumberCool]}><Text style={styles.ideaNumberText}>{index + 1}</Text></View>
                          <View style={styles.ideaCopy}>
                            <Text style={styles.ideaText}>{idea.title}</Text>
                            <Text style={styles.ideaAuthor}>идея: {names.get(idea.created_by) ?? 'участник команды'}</Text>
                          </View>
                        </View>
                        <View style={styles.reactionsRow}>
                          {(Object.keys(reactionMeta) as IdeaReaction[]).map((reaction) => {
                            const meta = reactionMeta[reaction];
                            const active = mine === reaction;
                            const count = ideaReactionCount(idea.id, reaction);
                            return (
                              <Pressable
                                key={reaction}
                                disabled={busy || selectedMeeting.status !== 'planned'}
                                onPress={() => void setIdeaReaction(idea.id, reaction)}
                                style={[styles.reactionButton, active && styles.reactionButtonActive]}
                              >
                                <Text style={styles.reactionIcon}>{meta.icon}</Text>
                                <Text style={[styles.reactionLabel, active && styles.reactionLabelActive]}>{meta.label}</Text>
                                {count ? <Text style={[styles.reactionCount, active && styles.reactionCountActive]}>{count}</Text> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noIdeas}>Пока пусто. Добавьте первую идею — даже самую простую.</Text>
              )}

              {selectedMeeting.status === 'planned' ? (
                <>
                  <View style={styles.addIdeaRow}>
                    <TextInput
                      value={newIdea}
                      onChangeText={setNewIdea}
                      placeholder="Например: сыграть в шахматы в кафе"
                      placeholderTextColor={colors.mutedSoft}
                      maxLength={120}
                      style={styles.ideaInput}
                      onSubmitEditing={() => void addIdea()}
                    />
                    <Pressable style={[styles.ideaAddButton, (!newIdea.trim() || busy) && styles.disabled]} disabled={!newIdea.trim() || busy} onPress={() => void addIdea()}><Text style={styles.ideaAddText}>+</Text></Pressable>
                  </View>

                  <Pressable style={[styles.completeButton, busy && styles.disabled]} disabled={busy} onPress={completeMeeting}>
                    <LinearGradient colors={['#4B9875', '#2F7D68']} style={styles.completeGradient}>
                      <Text style={styles.completeText}>✓ Мы встретились</Text>
                      <Text style={styles.completeSub}>Сохранить в нашей истории</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable disabled={busy} onPress={cancelMeeting}><Text style={styles.cancelText}>Отменить этот план</Text></Pressable>
                </>
              ) : (
                <Pressable
                  style={styles.memoryButton}
                  onPress={() => router.push({ pathname: '/reflection-new', params: { prompt: `Что хочется запомнить после встречи «${selectedMeeting.title}»?` } })}
                >
                  <View style={styles.memoryIconWrap}><Image source={require('../../assets/generated/feature-book.png')} style={styles.memoryImage} resizeMode="contain" /></View>
                  <View style={styles.memoryCopy}><Text style={styles.memoryTitle}>Добавить воспоминание</Text><Text style={styles.memoryText}>Одна мысль, фраза или голосовая история.</Text></View>
                  <Text style={styles.memoryArrow}>→</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={styles.sectionTitleRow}>
            <View><Text style={styles.sectionKicker}>УЖЕ БЫЛО</Text><Text style={styles.sectionTitle}>Наша история встреч</Text></View>
          </View>

          {history.length ? (
            <View style={styles.historyList}>
              {history.slice(0, 12).map((item) => (
                <Pressable key={item.id} style={[styles.historyCard, shadows.soft]} onPress={() => setSelectedMeetingId(item.id)}>
                  <View style={styles.historyDot}><Image source={require('../../assets/generated/feature-book.png')} style={styles.historyImage} resizeMode="contain" /></View>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyDate}>{prettyDate(item.meeting_date, false)}</Text>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    {item.note ? <Text style={styles.historyNote} numberOfLines={1}>{item.note}</Text> : null}
                  </View>
                  <Text style={styles.historyArrow}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.historyEmpty}><Text style={styles.historyEmptyText}>Первая завершённая встреча появится здесь как часть вашей общей истории.</Text></View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40, gap: 18 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 32, lineHeight: 34, color: colors.navy, marginTop: -3 },
  topCopy: { flex: 1 },
  topKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, color: colors.teal },
  topTitle: { marginTop: 2, fontSize: 25, lineHeight: 29, fontWeight: '900', color: colors.text },
  addTop: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  addTopText: { color: colors.white, fontSize: 25, lineHeight: 27, fontWeight: '700' },
  hero: { minHeight: 310, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlowOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.12)', top: -80, right: -60 },
  heroGlowTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(44,139,140,0.22)', bottom: -70, left: -50 },
  heroPeople: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  personBox: { alignItems: 'center', minWidth: 72 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarDad: { backgroundColor: colors.amber },
  avatarSon: { backgroundColor: colors.tealBright },
  avatarText: { color: colors.white, fontSize: 21, fontWeight: '900' },
  personName: { marginTop: 6, color: colors.white, fontSize: 14, fontWeight: '800' },
  routeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  routeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  routeStar: { width: 40, height: 40, borderRadius: 16, marginHorizontal: 6, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  routeStarImage: { width: 36, height: 36 },
  heroKicker: { color: '#B7D8DC', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: colors.white, fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 7, maxWidth: '90%' },
  heroDate: { color: '#D8EAEB', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 7 },
  countdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 15 },
  countdownValue: { color: colors.sun, fontSize: 32, fontWeight: '900' },
  countdownText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 9 },
  statCard: { flex: 1, minHeight: 78, borderRadius: radius.md, backgroundColor: colors.paper, padding: 13, justifyContent: 'center' },
  statValue: { color: colors.navy, fontSize: 23, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 2 },
  newCard: { backgroundColor: colors.paper, borderRadius: radius.lg, padding: 18, gap: 11 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  sectionKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 1.4, color: colors.teal },
  sectionTitle: { marginTop: 3, color: colors.text, fontSize: 21, lineHeight: 25, fontWeight: '900' },
  sectionImage: { width: 46, height: 46 },
  input: { minHeight: 48, borderRadius: radius.md, backgroundColor: '#F5F2EB', borderWidth: 1, borderColor: colors.lineWarm, paddingHorizontal: 14, color: colors.text, fontSize: 15, fontWeight: '600' },
  noteInput: { minHeight: 90, paddingTop: 13 },
  hint: { marginTop: -6, marginLeft: 4, color: colors.muted, fontSize: 14, fontWeight: '600' },
  formActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1EF' },
  secondaryText: { color: colors.muted, fontWeight: '800' },
  primaryButton: { flex: 1.4, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
  primaryText: { color: colors.white, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 2 },
  textAction: { color: colors.teal, fontSize: 14, fontWeight: '900', paddingBottom: 3 },
  meetingRail: { paddingRight: 14, gap: 10 },
  meetingCard: { width: 176, minHeight: 165, borderRadius: radius.lg, backgroundColor: colors.paper, padding: 15, borderWidth: 1, borderColor: 'transparent' },
  meetingCardActive: { backgroundColor: colors.navy, borderColor: colors.tealBright },
  meetingCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meetingDate: { color: colors.teal, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  meetingDateActive: { color: colors.sun },
  meetingNumber: { color: '#C7D0CD', fontSize: 14, fontWeight: '900' },
  meetingNumberActive: { color: '#7FA0A8' },
  meetingTitle: { marginTop: 16, color: colors.text, fontSize: 18, lineHeight: 21, fontWeight: '900' },
  meetingTitleActive: { color: colors.white },
  meetingNote: { marginTop: 7, color: colors.muted, fontSize: 14, lineHeight: 20, flex: 1 },
  meetingNoteActive: { color: '#C7DCDF' },
  meetingDays: { marginTop: 12, color: colors.green, fontSize: 14, fontWeight: '900' },
  meetingDaysActive: { color: colors.sun },
  emptyCard: { minHeight: 96, borderRadius: radius.lg, backgroundColor: colors.paper, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyImageWrap: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emptyImage: { width: 42, height: 42 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  emptyText: { marginTop: 3, color: colors.muted, fontSize: 14, lineHeight: 20 },
  emptyArrow: { color: colors.teal, fontSize: 22 },
  detailCard: { borderRadius: radius.xl, backgroundColor: colors.paper, padding: 18 },
  detailHead: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  detailDateBox: { width: 60, minHeight: 68, borderRadius: radius.md, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  detailDay: { color: colors.navy, fontSize: 24, lineHeight: 26, fontWeight: '900' },
  detailMonth: { color: colors.teal, fontSize: 14, fontWeight: '900', marginTop: 3 },
  detailCopy: { flex: 1 },
  detailKicker: { color: colors.teal, fontSize: 14, fontWeight: '900', letterSpacing: 1.2 },
  detailTitle: { color: colors.text, fontSize: 22, lineHeight: 25, fontWeight: '900', marginTop: 4 },
  detailNote: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  divider: { height: 1, backgroundColor: colors.lineWarm, marginVertical: 18 },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ideaTitle: { marginTop: 3, color: colors.text, fontSize: 18, fontWeight: '900' },
  ideaCount: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  ideaCountText: { color: colors.navy, fontWeight: '900' },
  ideasList: { marginTop: 12, gap: 10 },
  ideaItem: { borderRadius: radius.md, backgroundColor: '#F7F4ED', padding: 12 },
  ideaTopLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ideaNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ideaNumberWarm: { backgroundColor: '#FFE2A1' },
  ideaNumberCool: { backgroundColor: '#D8EBED' },
  ideaNumberText: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  ideaCopy: { flex: 1 },
  ideaText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  ideaAuthor: { color: colors.mutedSoft, fontSize: 14, fontWeight: '700', marginTop: 2 },
  reactionsRow: { flexDirection: 'row', gap: 5, marginTop: 10 },
  reactionButton: { flex: 1, minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 3 },
  reactionButtonActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  reactionIcon: { fontSize: 14 },
  reactionLabel: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  reactionLabelActive: { color: colors.white },
  reactionCount: { color: colors.teal, fontSize: 14, fontWeight: '900' },
  reactionCountActive: { color: colors.sun },
  noIdeas: { marginTop: 12, color: colors.muted, fontSize: 14, lineHeight: 20 },
  addIdeaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  ideaInput: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: '#F5F2EB', paddingHorizontal: 15, color: colors.text, fontSize: 14, fontWeight: '700' },
  ideaAddButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  ideaAddText: { color: colors.navyDeep, fontSize: 24, fontWeight: '900', marginTop: -2 },
  completeButton: { marginTop: 18, borderRadius: radius.lg, overflow: 'hidden' },
  completeGradient: { minHeight: 68, paddingHorizontal: 18, justifyContent: 'center' },
  completeText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  completeSub: { color: '#D9EFE4', fontSize: 14, fontWeight: '700', marginTop: 3 },
  cancelText: { color: colors.mutedSoft, fontSize: 14, fontWeight: '800', textAlign: 'center', paddingVertical: 13 },
  memoryButton: { marginTop: 17, minHeight: 70, borderRadius: radius.md, backgroundColor: colors.sandWarm, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  memoryIconWrap: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memoryImage: { width: 38, height: 38 },
  memoryCopy: { flex: 1 },
  memoryTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  memoryText: { color: colors.muted, fontSize: 14, marginTop: 2 },
  memoryArrow: { color: colors.teal, fontSize: 20 },
  historyList: { gap: 8 },
  historyCard: { minHeight: 78, borderRadius: radius.md, backgroundColor: colors.paper, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  historyDot: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  historyImage: { width: 36, height: 36 },
  historyCopy: { flex: 1 },
  historyDate: { color: colors.teal, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  historyTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 2 },
  historyNote: { color: colors.muted, fontSize: 14, marginTop: 2 },
  historyArrow: { color: colors.mutedSoft, fontSize: 24 },
  historyEmpty: { borderRadius: radius.md, backgroundColor: '#EFEAE0', padding: 16 },
  historyEmptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
