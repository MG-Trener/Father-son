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
import { router, useLocalSearchParams } from 'expo-router';
import { AppCard } from '../components/AppCard';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type SkillNode = {
  id: string;
  path_id: string;
  title: string;
  description: string;
  node_type: string;
};

const categoryMeta: Record<string, { icon: string; title: string }> = {
  school: { icon: '📚', title: 'Школа' },
  football: { icon: '⚽', title: 'Футбол' },
  chess: { icon: '♟', title: 'Шахматы' },
  english: { icon: 'EN', title: 'English' },
  leadership: { icon: '🧭', title: 'Лидерство' },
  together: { icon: '❤️', title: 'Папа & Я' },
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
  const assignee = child ?? me;
  const category = node?.path_id ?? (typeof params.category === 'string' ? params.category : 'together');
  const meta = categoryMeta[category] ?? categoryMeta.together;
  const xpReward = rewardForNode(node?.node_type);

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

      Alert.alert('Миссия создана', `${assignee.display_name} увидит её в разделе «Развитие».`);
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось создать миссию', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>Новая миссия</Text>
              <Text style={styles.subtitle}>Небольшой конкретный шаг вместо оценки или контроля.</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.navy} style={styles.loader} />
          ) : (
            <>
              <View style={styles.categoryHero}>
                <Text style={styles.categoryIcon}>{meta.icon}</Text>
                <View style={styles.categoryText}>
                  <Text style={styles.categoryLabel}>{meta.title}</Text>
                  <Text style={styles.categoryHint}>{node ? `Ступень: ${node.title}` : 'Свободная миссия'}</Text>
                </View>
                <View style={styles.xpBadge}><Text style={styles.xpText}>+{xpReward} XP</Text></View>
              </View>

              <AppCard title={`Для: ${assignee?.display_name ?? 'участника команды'}`}>
                <Text style={styles.label}>Название</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Например: Сам выберу цель недели"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  maxLength={120}
                />

                <Text style={styles.label}>Что считается выполнением</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Коротко и без двусмысленности"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.descriptionInput]}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                />

                <Text style={styles.label}>Срок</Text>
                <View style={styles.daysRow}>
                  {[3, 7, 14, 30].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setDays(value)}
                      style={[styles.dayChip, days === value && styles.dayChipActive]}
                    >
                      <Text style={[styles.dayText, days === value && styles.dayTextActive]}>{value} дн.</Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={[styles.primary, (!assignee || busy) && styles.disabled]}
                  onPress={() => void createMission()}
                  disabled={!assignee || busy}
                >
                  <Text style={styles.primaryText}>{busy ? 'Создаём…' : 'Запустить миссию'}</Text>
                </Pressable>
              </AppCard>

              <Text style={styles.note}>После выполнения миссия попадёт в вашу Историю. Если она связана со ступенью развития, ступень закроется автоматически.</Text>
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
  content: { padding: 18, paddingBottom: 34, gap: 17 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  loader: { marginTop: 50 },
  categoryHero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIcon: { width: 42, fontSize: 27, fontWeight: '900', color: colors.white, textAlign: 'center' },
  categoryText: { flex: 1 },
  categoryLabel: { color: colors.white, fontSize: 18, fontWeight: '900' },
  categoryHint: { color: '#D9E3E5', fontSize: 12, lineHeight: 17, marginTop: 2 },
  xpBadge: { backgroundColor: colors.amber, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  xpText: { color: colors.navyDeep, fontWeight: '900', fontSize: 11 },
  label: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  input: { minHeight: 49, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  descriptionInput: { minHeight: 108, paddingTop: 13, paddingBottom: 13 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.white },
  dayChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  dayText: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  dayTextActive: { color: colors.navyDeep },
  primary: { minHeight: 51, backgroundColor: colors.navy, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.5 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
});
