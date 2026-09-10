import { useState } from 'react';
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
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type SetupMode = 'create' | 'join';

type CreateTeamResult = {
  family_id: string;
  invite_code: string;
  invite_expires_at: string;
};

const friendlyError = (message: string) => {
  if (message.includes('ALREADY_IN_FAMILY')) return 'Этот аккаунт уже состоит в семейной команде.';
  if (message.includes('INVALID_INVITE_CODE')) return 'Проверь код приглашения. Он состоит из 12 символов.';
  if (message.includes('INVITE_NOT_FOUND_OR_EXPIRED')) return 'Код не найден, уже использован или срок его действия закончился.';
  if (message.includes('FAMILY_FULL')) return 'В этой версии команда уже укомплектована: папа и сын.';
  if (message.includes('PARENT_REQUIRED')) return 'Создавать приглашение может только папа этой команды.';
  return message;
};

export default function TeamSetupScreen() {
  const { signOut } = useAuth();
  const { family, refresh } = useFamily();
  const [mode, setMode] = useState<SetupMode>('create');
  const [parentName, setParentName] = useState('Михаил');
  const [childName, setChildName] = useState('Артур');
  const [inviteCode, setInviteCode] = useState('');
  const [createdInvite, setCreatedInvite] = useState<CreateTeamResult | null>(null);
  const [busy, setBusy] = useState(false);

  const createTeam = async () => {
    if (!supabase) return;
    if (!parentName.trim()) {
      Alert.alert('Введите имя', 'Укажите имя папы.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_family_team', {
        p_display_name: parentName.trim(),
        p_family_name: 'Михаил + Артур',
      });
      if (error) throw error;

      setCreatedInvite(data as unknown as CreateTeamResult);
      await refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать команду.';
      Alert.alert('Не получилось создать команду', friendlyError(message));
    } finally {
      setBusy(false);
    }
  };

  const joinTeam = async () => {
    if (!supabase) return;
    if (!childName.trim() || !inviteCode.trim()) {
      Alert.alert('Заполните данные', 'Введите имя и код приглашения от папы.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_family_by_code', {
        p_invite_code: inviteCode.trim(),
        p_display_name: childName.trim(),
      });
      if (error) throw error;

      await refresh();
      router.replace('/(tabs)');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось присоединиться к команде.';
      Alert.alert('Не получилось присоединиться', friendlyError(message));
    } finally {
      setBusy(false);
    }
  };

  const exit = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  if (createdInvite) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.brand}>Папа & Я</Text>
            <Text style={styles.kicker}>КОМАНДА СОЗДАНА</Text>
            <Text style={styles.title}>Михаил + Артур</Text>
            <Text style={styles.copy}>Открой приложение на телефоне Артура, создай ему отдельный аккаунт и введи этот код.</Text>
          </View>

          <View style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>КОД ДЛЯ АРТУРА</Text>
            <Text selectable style={styles.inviteCode}>{createdInvite.invite_code}</Text>
            <Text style={styles.inviteHint}>Одноразовый · действует 7 дней · в базе хранится только защищённый хэш</Text>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Как подключить второй телефон</Text>
            <Text style={styles.tipLine}>1. Установить «Папа & Я» на телефон Артура.</Text>
            <Text style={styles.tipLine}>2. Создать отдельный аккаунт Артура.</Text>
            <Text style={styles.tipLine}>3. Выбрать «У меня есть код папы».</Text>
            <Text style={styles.tipLine}>4. Ввести код выше — после этого оба телефона увидят одну команду.</Text>
          </View>

          <Pressable style={styles.primary} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.primaryText}>Перейти в приложение</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (family) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.brand}>Папа & Я</Text>
          <Text style={styles.title}>{family.name}</Text>
          <Text style={styles.copy}>Этот аккаунт уже подключён к команде.</Text>
          <Pressable style={styles.primaryWide} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.primaryText}>Открыть приложение</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.brand}>Папа & Я</Text>
            <Text style={styles.title}>Создаём вашу команду</Text>
            <Text style={styles.copy}>У Михаила и Артура будут отдельные аккаунты, но общее приватное пространство.</Text>
          </View>

          <View style={styles.segment}>
            <Pressable style={[styles.segmentButton, mode === 'create' && styles.segmentActive]} onPress={() => setMode('create')}>
              <Text style={[styles.segmentText, mode === 'create' && styles.segmentTextActive]}>Я Михаил</Text>
            </Pressable>
            <Pressable style={[styles.segmentButton, mode === 'join' && styles.segmentActive]} onPress={() => setMode('join')}>
              <Text style={[styles.segmentText, mode === 'join' && styles.segmentTextActive]}>Я Артур</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {mode === 'create' ? (
              <>
                <Text style={styles.cardTitle}>Создать команду</Text>
                <Text style={styles.cardCopy}>Михаил создаёт «Михаил + Артур» и получает одноразовый код для второго телефона.</Text>
                <TextInput
                  value={parentName}
                  onChangeText={setParentName}
                  placeholder="Имя папы"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  autoCapitalize="words"
                />
                <Pressable style={[styles.primary, busy && styles.disabled]} onPress={createTeam} disabled={busy}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Создать и получить код</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Присоединиться к папе</Text>
                <Text style={styles.cardCopy}>Артур вводит код, который показан на телефоне Михаила.</Text>
                <TextInput
                  value={childName}
                  onChangeText={setChildName}
                  placeholder="Имя сына"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  autoCapitalize="words"
                />
                <TextInput
                  value={inviteCode}
                  onChangeText={(value) => setInviteCode(value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.codeInput]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={14}
                />
                <Pressable style={[styles.primary, busy && styles.disabled]} onPress={joinTeam} disabled={busy}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Присоединиться к команде</Text>}
                </Pressable>
              </>
            )}
          </View>

          <Pressable onPress={exit}>
            <Text style={styles.exit}>Выйти из аккаунта</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  content: { flexGrow: 1, padding: 22, justifyContent: 'center', gap: 18 },
  centered: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hero: { gap: 7 },
  brand: { color: colors.navyDeep, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  segment: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.line },
  segmentButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy },
  segmentText: { color: colors.muted, fontWeight: '800' },
  segmentTextActive: { color: colors.white },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 12 },
  cardTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  cardCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 3 },
  input: { height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  codeInput: { textAlign: 'center', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  primary: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryWide: { minHeight: 50, minWidth: 230, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  exit: { color: colors.muted, textAlign: 'center', paddingVertical: 10, fontWeight: '700' },
  inviteCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 10 },
  inviteLabel: { color: '#C9D7D7', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  inviteCode: { color: colors.white, fontSize: 31, fontWeight: '900', letterSpacing: 2 },
  inviteHint: { color: '#D7E1E2', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  tipCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 8 },
  tipTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 2 },
  tipLine: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
