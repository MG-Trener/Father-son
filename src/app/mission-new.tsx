import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { colors, gradients, moduleColors, radius, shadows } from '../theme';

type SkillNode = {
  id: string;
  path_id: string;
  title: string;
  description: string;
  node_type: string;
};

type CategoryMeta = { icon: string; title: string };

const fallbackMeta: CategoryMeta = { icon: '❤️', title: 'Папа & Я' };

const categoryMeta: Record<string, CategoryMeta> = {
  school: { icon: '📚', title: 'Школа' },
  football: { icon: '⚽', title: 'Футбол' },
  chess: { icon: '♟', title: 'Шахматы' },
  english: { icon: 'EN', title: 'English' },
  leadership: { icon: '🧭', title: 'Лидерство' },
  together: fallbackMeta,
};

const categoryGradient = (category: string) => {
  if (category === 'school') return gradients.school;
  if (category === 'football') return gradients.football;
  if (category === 'chess') return gradients.chess;
  if (category === 'english') return gradients.english;
  if (category === 'leadership') return gradients.leadership;
  return gradients.connection;
};

const categorySoft = (category: string) => {
  if (category === 'school') return moduleColors.school.base;
  if (category === 'football') return moduleColors.football.base;
  if (category === 'chess') return moduleColors.chess.base;
  if (category === 'english') return moduleColors.english.base;
  if (category === 'leadership') return moduleColors.leadership.base;
  return colors.sandWarm;
};

const rewardForNode = (nodeType?: string) => {
  if (nodeType === 'mentor') return 25;
  if (nodeType === 'milestone') return 20;
  return 10;
};

export default function MissionNewScreen() {
  const params = useLocalSearchParams<{ category?: string; node?: string }>();
  const { session } = useAuth();
  const { family, me, members } = useFamily();
  const [node, setNode] = useState<SkillNode | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(Boolean(params.node));
  const [busy, setBusy] = useState(false);

  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const category = node?.path_id ?? (typeof params.category === 'string' ? params.category : 'together');
  const assignee = category === 'together'
    ? (me?.role === 'child' ? parent ?? me : child ?? me)
    : child ?? me;
  const meta = categoryMeta[category] ?? fallbackMeta;
  const xpReward = rewardForNode(node?.node_type);
  const isTogether = category === 'together';

  useEffect(() => {
    const nodeId = typeof params.node === 'string' ? params.node : '';
    if (!supabase || !nodeId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void supabase
      .from('skill_nodes')
      .select('id,path_id,title,description,node_type')
      .eq('id', nodeId)
      .eq('hidden', false)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          Alert.alert('Не удалось открыть ступень', error.message);
        } else if (data) {
          const nextNode = data as SkillNode;
          setNode(nextNode);
          setTitle(nextNode.title);
          setDescription(nextNode.description);
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params.node]);

  const createMission = async () => {
    if (!supabase || !family || !session || !assignee || busy) return;
    if (!title.trim()) {
      Alert.alert('Добавь название', 'Коротко сформулируй, что нужно сделать.');
      return;
    }

    setBusy(true);
    try {
      const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.rpc('create_mission', {
        p_family_id: family.id,
        p_category: category,
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_assigned_to: assignee.user_id,
        p_due_at: dueAt,
        p_xp_reward: xpReward,
        p_skill_node_id: node?.id ?? null,
      });
      if (error) throw error;

      Alert.alert(
        'Миссия создана',
        isTogether
          ? `${me?.display_name ?? 'Ты'} и ${assignee.display_name} сможете отметить её выполненной.`
          : `${assignee.display_name} увидит её в разделе «Развитие».`,
      );
      router.back();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Попробуй ещё раз.';
      if (message.includes('PREVIOUS_SKILL_NODE_REQUIRED')) {
        Alert.alert('Сначала предыдущий шаг', 'Эта ступень откроется после завершения предыдущей.');
      } else if (message.includes('ACTIVE_MISSION_EXISTS')) {
        Alert.alert('Миссия уже есть', 'Для этой ступени уже запущена активная миссия.');
      } else {
        Alert.alert('Не удалось создать миссию', message);
      }
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
            <Text style={styles.topTitle}>{isTogether ? 'Совместная миссия' : 'Новая миссия'}</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
          ) : (
            <>
              <LinearGradient colors={categoryGradient(category)} style={[styles.hero, shadows.lift]}>
                <View style={styles.heroOrb} />
                <View style={styles.heroRing} />
                <View style={styles.heroTopRow}>
                  <View style={styles.iconBadge}><Text style={styles.iconText}>{meta.icon}</Text></View>
                  <View style={styles.xpBadge}><Text style={styles.xpText}>+{xpReward} XP</Text></View>
                </View>
                <Text style={styles.heroKicker}>{meta.title.toUpperCase()}</Text>
                <Text style={styles.heroTitle}>{node ? node.title : isTogether ? 'Сделать что-то вместе' : 'Новый конкретный шаг'}</Text>
                <Text style={styles.heroCopy}>
                  {isTogether
                    ? `Напарник: ${assignee?.display_name ?? 'второй участник'}. Небольшое общее дело, где важен вклад обоих.`
                    : `Для ${assignee?.display_name ?? 'участника команды'}. Не оценка и не контроль — понятная задача с ясным финишем.`}
                </Text>
              </LinearGradient>

              <View style={[styles.formCard, shadows.soft]}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: categorySoft(category) }]}>
                    <Text style={styles.sectionIconText}>✦</Text>
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Соберём миссию</Text>
                    <Text style={styles.sectionCopy}>Коротко, понятно и так, чтобы хотелось отметить «готово».</Text>
                  </View>
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Название</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={isTogether ? 'Например: сыграть партию и выбрать лучший ход' : 'Например: сам выберу цель недели'}
                    placeholderTextColor={colors.mutedSoft}
                    style={styles.input}
                    maxLength={120}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Что считается выполнением</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={isTogether ? 'Что вы оба должны сделать?' : 'Один конкретный результат без двусмысленности'}
                    placeholderTextColor={colors.mutedSoft}
                    style={[styles.input, styles.descriptionInput]}
                    multiline
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <View style={styles.deadlineRow}>
                    <Text style={styles.label}>Срок</Text>
                    <Text style={styles.deadlineHint}>{days === 3 ? 'быстрый рывок' : days === 7 ? 'на неделю' : days === 14 ? 'две недели' : 'на месяц'}</Text>
                  </View>
                  <View style={styles.daysRow}>
                    {[3, 7, 14, 30].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => setDays(value)}
                        style={[styles.dayChip, days === value && styles.dayChipActive]}
                      >
                        <Text style={[styles.dayNumber, days === value && styles.dayTextActive]}>{value}</Text>
                        <Text style={[styles.daySuffix, days === value && styles.dayTextActive]}>дн.</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.routePreview}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeLine} />
                  <View style={styles.routeFlag}><Text style={styles.routeFlagText}>⚑</Text></View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeReward}><Text style={styles.routeRewardText}>+{xpReward}</Text></View>
                </View>

                <Pressable
                  style={[styles.primary, (!assignee || busy) && styles.disabled]}
                  onPress={() => void createMission()}
                  disabled={!assignee || busy}
                >
                  <LinearGradient colors={categoryGradient(category)} style={styles.primaryGradient}>
                    <Text style={styles.primaryText}>{busy ? 'Создаём…' : isTogether ? 'Запустить нашу миссию' : 'Запустить миссию'}</Text>
                    {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
                  </LinearGradient>
                </Pressable>
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteIcon}>∞</Text>
                <Text style={styles.note}>
                  {isTogether
                    ? 'Автор и второй участник смогут завершить миссию. Результат и XP попадут в общую Историю.'
                    : 'После выполнения миссия попадёт в вашу Историю. Если она связана со ступенью развития, ступень закроется автоматически.'}
                </Text>
              </View>
            </>
          )}
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
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  topTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  loader: { marginTop: 50 },
  hero: { minHeight: 280, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)', top: -56, right: -45 },
  heroRing: { position: 'absolute', width: 95, height: 95, borderRadius: 48, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', top: 34, right: 38 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  iconBadge: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.white, fontSize: 27, fontWeight: '900' },
  xpBadge: { backgroundColor: colors.sun, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  xpText: { color: colors.navyDeep, fontWeight: '900', fontSize: 11 },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6, marginTop: 5, maxWidth: '88%' },
  heroCopy: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: '94%' },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 16, borderWidth: 1, borderColor: colors.lineWarm },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  sectionIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionIconText: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 19, fontWeight: '900' },
  sectionCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  fieldWrap: { gap: 6 },
  label: { color: colors.text, fontSize: 11, fontWeight: '900' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  descriptionInput: { minHeight: 108, paddingTop: 13, paddingBottom: 13 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deadlineHint: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  daysRow: { flexDirection: 'row', gap: 8 },
  dayChip: { flex: 1, minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  dayNumber: { color: colors.navyDeep, fontWeight: '900', fontSize: 16 },
  daySuffix: { color: colors.muted, fontWeight: '800', fontSize: 8, marginTop: 1 },
  dayTextActive: { color: colors.white },
  routePreview: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  routeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.tealBright },
  routeLine: { flex: 1, height: 2, backgroundColor: colors.lineWarm },
  routeFlag: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.sandWarm, alignItems: 'center', justifyContent: 'center' },
  routeFlagText: { color: colors.orange, fontSize: 17, fontWeight: '900' },
  routeReward: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.sun, alignItems: 'center', justifyContent: 'center' },
  routeRewardText: { color: colors.navyDeep, fontSize: 10, fontWeight: '900' },
  primary: { borderRadius: radius.md, overflow: 'hidden' },
  primaryGradient: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 18 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  primaryArrow: { color: colors.white, fontWeight: '900', fontSize: 20 },
  disabled: { opacity: 0.5 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14 },
  noteIcon: { color: colors.green, fontSize: 24, fontWeight: '900' },
  note: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15 },
});
