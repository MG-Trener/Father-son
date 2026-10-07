import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { brandAssets } from '../brandAssets';
import {
  createFutureLetter,
  deleteFutureLetterDraft,
  getFutureLetterDraft,
  sealFutureLetter,
  updateFutureLetterDraft,
} from '../data/memoryArchiveRepository';
import { useFamily } from '../context/FamilyContext';
import { futureLetterRecipients } from '../domain/futureLetters';
import { supabase } from '../lib/supabase';
import { colors, radius, shadows } from '../theme';

const artwork = {
  book: brandAssets.features.book,
  letter: brandAssets.utility.letter,
  family: brandAssets.features.family,
} as const;

const toIsoDay = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const parseDay = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const nextBirthday = (birthDate: string | null) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let result = new Date(now.getFullYear(), birth.getMonth(), birth.getDate(), 12, 0, 0);
  if (result.getTime() <= now.getTime()) result = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate(), 12, 0, 0);
  return result;
};

const birthdayAtAge = (birthDate: string | null, age: number) => {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const result = new Date(birth);
  result.setFullYear(birth.getFullYear() + age);
  return result.getTime() > Date.now() ? result : null;
};

export default function FutureLetterComposer() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { family, members, me } = useFamily();
  const recipients = useMemo(() => futureLetterRecipients(members, me), [members, me]);
  const names = useMemo(() => new Map(members.map((member) => [member.user_id, member.display_name])), [members]);
  const letterId = typeof params.id === 'string' ? params.id : null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [unlockDay, setUnlockDay] = useState('');
  const [loading, setLoading] = useState(Boolean(letterId));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!recipientId && me) setRecipientId(me.user_id);
  }, [recipientId, me]);

  const recipient = recipients.find(option => option.id === recipientId);

  useEffect(() => {
    if (!unlockDay) {
      const fallback = new Date();
      fallback.setFullYear(fallback.getFullYear() + 1);
      setUnlockDay(toIsoDay(fallback));
    }
  }, [unlockDay]);

  const loadDraft = useCallback(async () => {
    const client = supabase;
    if (!letterId || !client || !me) return;
    try {
      const draft = await getFutureLetterDraft(client, letterId);
      if (draft.author_user_id !== me.user_id || draft.status !== 'draft') {
        Alert.alert('Письмо уже запечатано', 'После запечатывания редактировать его нельзя.');
        router.replace('/letters');
        return;
      }
      setTitle(draft.title);
      setBody(draft.body);
      setRecipientId(draft.recipient_user_id);
      setUnlockDay(toIsoDay(new Date(draft.unlock_at)));
    } catch (caught) {
      Alert.alert('Черновик не найден', caught instanceof Error ? caught.message : 'Текст недоступен.');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [letterId, me]);

  useEffect(() => { void loadDraft(); }, [loadDraft]);

  const presets = useMemo(() => {
    const result: { label: string; date: Date }[] = [];
    const next = nextBirthday(recipient?.birthDate ?? null);
    if (next) result.push({ label: 'Следующий день рождения', date: next });
    const fifteen = recipient?.role === 'child' ? birthdayAtAge(recipient.birthDate, 15) : null;
    if (fifteen) result.push({ label: 'В 15 лет', date: fifteen });
    const eighteen = recipient?.role === 'child' ? birthdayAtAge(recipient.birthDate, 18) : null;
    if (eighteen) result.push({ label: 'В 18 лет', date: eighteen });
    const year = new Date();
    year.setFullYear(year.getFullYear() + 1);
    result.push({ label: 'Через год', date: year });
    return result;
  }, [recipient?.birthDate, recipient?.role]);

  const validate = () => {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const date = parseDay(unlockDay);
    if (!cleanTitle) { Alert.alert('Добавь заголовок', 'Например: «Тебе через год».'); return null; }
    if (!cleanBody) { Alert.alert('Письмо пустое', 'Напиши хотя бы несколько слов.'); return null; }
    if (!recipientId || !recipient) { Alert.alert('Выбери адресата', 'Получатель должен быть участником вашей семьи.'); return null; }
    if (!date || date.getTime() <= Date.now()) { Alert.alert('Проверь дату', 'Нужна будущая дата в формате ГГГГ-ММ-ДД.'); return null; }
    return { cleanTitle, cleanBody, date };
  };

  const save = async () => {
    const client = supabase;
    if (!client || !family || busy) return null;
    const valid = validate();
    if (!valid) return null;
    setBusy(true);
    try {
      if (letterId) {
        await updateFutureLetterDraft(client, {
          letterId,
          title: valid.cleanTitle,
          body: valid.cleanBody,
          unlockAt: valid.date.toISOString(),
          recipientUserId: recipientId,
        });
        return letterId;
      }
      return await createFutureLetter(client, {
        familyId: family.id,
        recipientUserId: recipientId,
        title: valid.cleanTitle,
        body: valid.cleanBody,
        unlockAt: valid.date.toISOString(),
      });
    } catch (caught) {
      Alert.alert('Не удалось сохранить письмо', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    const id = await save();
    if (!id) return;
    Alert.alert('Черновик сохранён', 'Можно вернуться к нему и дописать позже.', [{ text: 'Хорошо', onPress: () => router.replace('/letters') }]);
  };

  const seal = () => {
    const valid = validate();
    if (!valid) return;
    Alert.alert(
      'Запечатать письмо?',
      `Кому: ${recipient?.label} · ${recipient?.name}. После запечатывания текст нельзя будет открыть или изменить до ${valid.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      [
        { text: 'Пока нет', style: 'cancel' },
        {
          text: 'Запечатать',
          onPress: () => void (async () => {
            const id = await save();
            const client = supabase;
            if (!id || !client) return;
            setBusy(true);
            try {
              await sealFutureLetter(client, id);
              Alert.alert('Письмо запечатано', 'Теперь содержание будет ждать своей даты.', [{ text: 'Готово', onPress: () => router.replace('/letters') }]);
            } catch (caught) {
              Alert.alert('Не удалось запечатать', caught instanceof Error ? caught.message : 'Черновик сохранён, попробуй запечатать позже.');
            } finally {
              setBusy(false);
            }
          })(),
        },
      ],
    );
  };

  const removeDraft = () => {
    const client = supabase;
    if (!letterId || !client) return;
    Alert.alert('Удалить черновик?', 'Текст будет удалён без возможности восстановления.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void (async () => {
          setBusy(true);
          try {
            await deleteFutureLetterDraft(client, letterId);
            router.replace('/letters');
          } catch (caught) {
            Alert.alert('Не удалось удалить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
          } finally {
            setBusy(false);
          }
        })(),
      },
    ]);
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loader}><ActivityIndicator size="large" color={colors.navy} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.kicker}>ПИСЬМО В БУДУЩЕЕ</Text><Text style={styles.topTitle}>{letterId ? 'Черновик' : 'Новый конверт'}</Text></View>
        </View>

        <LinearGradient colors={['#173C54', '#355F70', '#D49B4B']} style={[styles.intro, shadows.lift]}>
          <View style={styles.introArtworkShell}><Image source={artwork.letter} style={styles.introArtwork} resizeMode="contain" /></View>
          <Text style={styles.introTitle}>Слова для будущего</Text>
          <Text style={styles.introText}>{me?.role === 'child' ? 'Напиши себе или папе. Выбери, когда письмо можно будет открыть.' : 'Напиши себе или сыну. Выбери, когда письмо можно будет открыть.'}</Text>
        </LinearGradient>

        <View style={[styles.formCard, shadows.soft]}>
          <Text style={styles.label}>КОМУ ПИШЕМ?</Text>
          <View style={styles.recipientRow}>
            {recipients.map((option) => {
              const active = Boolean(option.id && recipientId === option.id);
              return (
                <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={`${option.label}. ${option.name}`} accessibilityState={{ selected: active, disabled: !option.id }} disabled={!option.id || busy} onPress={() => option.id && setRecipientId(option.id)} style={[styles.recipient, active && styles.recipientActive, !option.id && styles.disabled]}>
                  <Text style={[styles.recipientName, active && styles.recipientNameActive]}>{option.label}{active ? ' ✓' : ''}</Text>
                  <Text style={[styles.recipientRole, active && styles.recipientRoleActive]}>{option.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {!recipients[1].id ? <Text style={styles.dateHint}>Письма друг другу доступны после подключения второго аккаунта. Это можно сделать в разделе «Настройки».</Text> : <Text style={styles.dateHint}>Письмо себе читаешь только ты. Письмо другому участнику после выбранной даты могут прочитать автор и адресат.</Text>}

          <Text style={styles.label}>ЗАГОЛОВОК</Text>
          <TextInput accessibilityLabel="Заголовок письма" value={title} onChangeText={setTitle} maxLength={120} placeholder={`Например: «${names.get(recipientId) ?? 'Тебе'} в важный день»`} placeholderTextColor="#A1AAA9" style={styles.input} />

          <Text style={styles.label}>ТЕКСТ ПИСЬМА</Text>
          <TextInput accessibilityLabel="Текст письма" value={body} onChangeText={setBody} maxLength={8000} placeholder="Что ты хочешь сказать человеку, который откроет это позже?" placeholderTextColor="#A1AAA9" multiline style={styles.bodyInput} />
          <Text style={styles.counter}>{body.length}/8000</Text>

          <Text style={styles.label}>КОГДА ОТКРЫТЬ</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {presets.map((preset) => {
              const day = toIsoDay(preset.date);
              const active = unlockDay === day;
              return <Pressable key={`${preset.label}-${day}`} onPress={() => setUnlockDay(day)} style={[styles.preset, active && styles.presetActive]}><Text style={[styles.presetText, active && styles.presetTextActive]}>{preset.label}</Text></Pressable>;
            })}
          </ScrollView>
          <TextInput accessibilityLabel="Дата открытия письма" value={unlockDay} onChangeText={setUnlockDay} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="ГГГГ-ММ-ДД" placeholderTextColor="#A1AAA9" style={styles.dateInput} />
          <Text style={styles.dateHint}>Можно выбрать готовую дату выше или ввести свою.</Text>
        </View>

        <View style={[styles.sealInfo, shadows.soft]}>
          <View style={styles.lockCircle}><Image source={artwork.letter} style={styles.lockImage} resizeMode="contain" /></View>
          <View style={styles.sealCopy}><Text style={styles.sealTitle}>Что значит «запечатать»</Text><Text style={styles.sealText}>После запечатывания нельзя исправить дату, адресата или текст. Содержание снова станет доступно только после выбранной даты.</Text></View>
        </View>

        <Pressable disabled={busy} onPress={seal} style={[styles.sealButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <><Image source={artwork.letter} style={styles.sealButtonImage} resizeMode="contain" /><Text style={styles.sealButtonText}>Сохранить и запечатать</Text></>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => void saveDraft()} style={[styles.draftButton, busy && styles.disabled]}><Text style={styles.draftButtonText}>Сохранить как черновик</Text></Pressable>
        {letterId ? <Pressable disabled={busy} onPress={removeDraft} style={styles.deleteButton}><Text style={styles.deleteText}>Удалить черновик</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 34, gap: 14 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  back: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E8DFD1', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 28, lineHeight: 28, fontWeight: '700', marginTop: -3 },
  kicker: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  topTitle: { color: colors.navyDeep, fontSize: 21, fontWeight: '900', marginTop: 2 },
  intro: { minHeight: 130, borderRadius: radius.xl, padding: 19, justifyContent: 'center', overflow: 'hidden' },
  introArtworkShell: { position: 'absolute', right: 15, top: 13, width: 72, height: 72, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  introArtwork: { width: 63, height: 63 },
  introTitle: { color: colors.white, fontSize: 22, lineHeight: 27, fontWeight: '900', maxWidth: '70%' },
  introText: { color: '#DFE9E9', fontSize: 15, lineHeight: 22, marginTop: 7, maxWidth: '70%' },
  formCard: { backgroundColor: '#FFFDF8', borderRadius: radius.xl, padding: 17, borderWidth: 1, borderColor: '#E8DFD1' },
  label: { color: colors.muted, fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  recipientRow: { flexDirection: 'row', gap: 8 },
  recipient: { flex: 1, minHeight: 95, borderRadius: 20, backgroundColor: '#F5F0E7', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  recipientActive: { backgroundColor: '#E6F0F1', borderColor: colors.teal },
  avatar: { width: 37, height: 37, borderRadius: 14, backgroundColor: '#D9D4CB', alignItems: 'center', justifyContent: 'center' },
  avatarActive: { backgroundColor: colors.teal },
  avatarText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  avatarTextActive: { color: colors.white },
  recipientName: { color: colors.navyDeep, fontSize: 17, fontWeight: '700', marginTop: 6 },
  recipientNameActive: { color: colors.teal },
  recipientRole: { color: colors.muted, fontSize: 14, fontWeight: '800', marginTop: 1 },
  recipientRoleActive: { color: colors.teal },
  input: { minHeight: 48, borderRadius: 16, backgroundColor: '#F5F0E7', paddingHorizontal: 13, color: colors.navyDeep, fontSize: 14, fontWeight: '700' },
  bodyInput: { minHeight: 190, borderRadius: 18, backgroundColor: '#F5F0E7', padding: 13, color: colors.navyDeep, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 14, marginTop: 4 },
  presets: { gap: 7, paddingBottom: 7 },
  preset: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: '#F1ECE4' },
  presetActive: { backgroundColor: colors.navyDeep },
  presetText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  presetTextActive: { color: colors.white },
  dateInput: { minHeight: 46, borderRadius: 15, backgroundColor: '#F5F0E7', paddingHorizontal: 13, color: colors.navyDeep, fontSize: 14, fontWeight: '800' },
  dateHint: { color: colors.muted, fontSize: 14, marginTop: 5 },
  sealInfo: { borderRadius: radius.lg, backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#F0DEB6', padding: 15, flexDirection: 'row', gap: 11, alignItems: 'center' },
  lockCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F7E4B8', alignItems: 'center', justifyContent: 'center' },
  lockImage: { width: 41, height: 41 },
  sealCopy: { flex: 1 },
  sealTitle: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  sealText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  sealButton: { minHeight: 56, borderRadius: 17, backgroundColor: colors.navyDeep, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  sealButtonImage: { width: 36, height: 36 },
  sealButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  draftButton: { minHeight: 46, borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E1D8CB', alignItems: 'center', justifyContent: 'center' },
  draftButtonText: { color: colors.navyDeep, fontSize: 14, fontWeight: '900' },
  deleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#B0645E', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
