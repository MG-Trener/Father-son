import { useMemo, useState } from 'react';
import {
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

export default function ReflectionNewScreen() {
  const params = useLocalSearchParams<{ prompt?: string; mode?: string }>();
  const { session } = useAuth();
  const { family, me, members } = useFamily();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = typeof params.prompt === 'string' && params.prompt.trim()
    ? params.prompt.trim()
    : params.mode === 'story'
      ? 'Что сегодня хочется сохранить друг для друга?'
      : 'Что хочется сказать сейчас?';
  const isStory = params.mode === 'story';

  const other = useMemo(
    () => members.find((member) => member.user_id !== me?.user_id) ?? null,
    [members, me],
  );

  const save = async () => {
    if (!supabase || !family || !session || busy) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert('Пока пусто', 'Напиши хотя бы одну мысль, которую хочется сохранить.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc('create_reflection_entry', {
        p_family_id: family.id,
        p_body: trimmed,
        p_prompt: prompt,
      });
      if (error) throw error;
      Alert.alert(
        isStory ? 'История сохранена' : 'Ответ сохранён',
        `${other?.display_name ?? 'Второй участник'} увидит это в вашей общей Истории.`,
      );
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
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
              <Text style={styles.title}>{isStory ? 'История дня' : 'Ответ друг другу'}</Text>
              <Text style={styles.subtitle}>Не отчёт. Просто момент, который хочется оставить между вами.</Text>
            </View>
          </View>

          <AppCard title={isStory ? 'Что запомним сегодня?' : 'Вопрос'}>
            <Text style={styles.prompt}>{prompt}</Text>
          </AppCard>

          <View style={styles.voiceCard}>
            <View style={styles.voiceCopy}>
              <Text style={styles.voiceTitle}>🎙 Сказать голосом</Text>
              <Text style={styles.voiceText}>Запиши историю или ответ так, как рассказал бы друг другу при встрече.</Text>
            </View>
            <Pressable
              style={styles.voiceButton}
              onPress={() => router.push({ pathname: '/voice-story-new', params: { prompt } })}
            >
              <Text style={styles.voiceButtonText}>Записать</Text>
            </Pressable>
          </View>

          <View style={styles.editorCard}>
            <Text style={styles.label}>{isStory ? 'Или напиши историю' : 'Или напиши ответ'}</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={isStory ? 'Например: сегодня случилась одна смешная вещь…' : 'Напиши так, как сказал бы вслух…'}
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              textAlignVertical="top"
              maxLength={4000}
              autoFocus={false}
            />
            <View style={styles.counterRow}>
              <Text style={styles.privateNote}>🔒 Видят только участники вашей команды</Text>
              <Text style={styles.counter}>{body.length}/4000</Text>
            </View>
            <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => void save()}>
              <Text style={styles.primaryText}>{busy ? 'Сохраняем…' : isStory ? 'Сохранить историю' : 'Сохранить ответ'}</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>Текст и голос остаются внутри вашей приватной семейной истории.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { padding: 18, paddingBottom: 34, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navy, fontSize: 31, lineHeight: 33, marginTop: -2 },
  headerText: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 27, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  prompt: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  voiceCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceCopy: { flex: 1 },
  voiceTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  voiceText: { color: '#CFDADB', fontSize: 12, lineHeight: 17, marginTop: 3 },
  voiceButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  voiceButtonText: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
  editorCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: '900' },
  input: { minHeight: 220, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15, lineHeight: 22 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  privateNote: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  counter: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  primary: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
});
