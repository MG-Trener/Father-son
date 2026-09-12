import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';
import { colors, gradients, radius, shadows } from '../theme';

type SetupMode = 'create' | 'join';

type CreateTeamResult = {
  family_id: string;
  invite_code: string;
  invite_expires_at: string;
};

const artwork = {
  app: require('../../assets/generated/app-icon.png'),
  family: require('../../assets/generated/feature-family.png'),
  path: require('../../assets/generated/feature-path.png'),
  together: require('../../assets/generated/feature-together.png'),
  agreements: require('../../assets/generated/utility-agreements.png'),
} as const;

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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.team} style={[styles.inviteHero, shadows.lift]}>
            <View style={styles.orbLarge} />
            <View style={styles.orbSmall} />
            <View style={styles.heroBrandRow}><Image source={artwork.app} style={styles.brandImage} resizeMode="contain" /><View><Text style={styles.heroKicker}>КОМАНДА СОЗДАНА</Text><Text style={styles.heroBrand}>Папа & Я</Text></View></View>
            <Text style={styles.heroTitle}>Остался один шаг — соединить два телефона.</Text>

            <View style={styles.phoneRoute}>
              <View style={styles.phoneCard}><View style={styles.phoneImageBox}><Image source={artwork.family} style={styles.phoneImage} resizeMode="contain" /></View><Text style={styles.phoneName}>Михаил</Text><Text style={styles.phoneState}>готов</Text></View>
              <View style={styles.routeWrap}><View style={styles.routeLine} /><View style={styles.routeBadge}><Image source={artwork.together} style={styles.routeImage} resizeMode="contain" /></View><View style={styles.routeLine} /></View>
              <View style={styles.phoneCard}><View style={styles.phoneImageBox}><Image source={artwork.path} style={styles.phoneImage} resizeMode="contain" /></View><Text style={styles.phoneName}>Артур</Text><Text style={styles.phoneState}>ждём</Text></View>
            </View>
          </LinearGradient>

          <View style={[styles.codeCard, shadows.soft]}>
            <Image source={artwork.agreements} style={styles.codeImage} resizeMode="contain" />
            <Text style={styles.codeKicker}>КОД ДЛЯ АРТУРА</Text>
            <Text selectable style={styles.inviteCode}>{createdInvite.invite_code}</Text>
            <View style={styles.codeDivider} />
            <Text style={styles.codeHint}>Одноразовый · действует 7 дней</Text>
            <Text style={styles.codeFine}>В базе хранится только защищённый хэш кода.</Text>
          </View>

          <View style={styles.stepsCard}>
            <View style={styles.stepsHeading}><Image source={artwork.path} style={styles.stepsImage} resizeMode="contain" /><Text style={styles.stepsTitle}>Подключаем Артура</Text></View>
            {[
              ['1', 'Установить «Папа & Я» на второй телефон.'],
              ['2', 'Создать отдельный аккаунт Артура.'],
              ['3', 'Выбрать роль «Я Артур».'],
              ['4', 'Ввести код выше — оба телефона увидят одну команду.'],
            ].map(([number, text]) => <View key={number} style={styles.stepRow}><View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{number}</Text></View><Text style={styles.stepText}>{text}</Text></View>)}
          </View>

          <Pressable style={styles.primary} onPress={() => router.replace('/(tabs)')}><LinearGradient colors={gradients.connection} style={styles.primaryGradient}><Text style={styles.primaryTextDark}>Перейти в приложение</Text><Text style={styles.primaryArrow}>→</Text></LinearGradient></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (family) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <LinearGradient colors={gradients.team} style={[styles.alreadyCard, shadows.lift]}>
            <View style={styles.orbLarge} />
            <Image source={artwork.family} style={styles.alreadyImage} resizeMode="contain" />
            <Text style={styles.heroKicker}>КОМАНДА УЖЕ СВЯЗАНА</Text>
            <Text style={styles.heroBrand}>Папа & Я</Text>
            <Text style={styles.heroTitle}>{family.name}</Text>
            <Text style={styles.alreadyCopy}>Этот аккаунт уже подключён к вашей общей истории.</Text>
            <Pressable style={styles.alreadyButton} onPress={() => router.replace('/(tabs)')}><Text style={styles.alreadyButtonText}>Открыть приложение →</Text></Pressable>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  const isParent = mode === 'create';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.team} style={[styles.setupHero, shadows.lift]}>
            <View style={styles.orbLarge} />
            <View style={styles.orbSmall} />
            <View style={styles.heroBrandRow}><Image source={artwork.app} style={styles.brandImage} resizeMode="contain" /><View><Text style={styles.heroKicker}>СОЗДАЁМ КОМАНДУ</Text><Text style={styles.heroBrand}>Папа & Я</Text></View></View>
            <Image source={artwork.family} style={styles.setupHeroImage} resizeMode="contain" />
            <Text style={styles.heroTitle}>Два аккаунта. Одна общая история.</Text>
            <Text style={styles.heroCopy}>Выбери, на чьём телефоне сейчас открыто приложение.</Text>
          </LinearGradient>

          <View style={styles.roleGrid}>
            <Pressable style={[styles.roleCard, mode === 'create' && styles.roleCardSelected]} onPress={() => setMode('create')}>
              <LinearGradient colors={mode === 'create' ? ['#194D5C', '#267281'] : ['#FFFDF8', '#F7F2E8']} style={styles.roleGradient}>
                <View style={styles.roleImageBox}><Image source={artwork.family} style={styles.roleImage} resizeMode="contain" /></View>
                <Text style={[styles.roleKicker, mode === 'create' && styles.roleTextSelected]}>ПАПА</Text>
                <Text style={[styles.roleTitle, mode === 'create' && styles.roleTextSelected]}>Я Михаил</Text>
                <Text style={[styles.roleCopy, mode === 'create' && styles.roleCopySelected]}>Создаю нашу команду и приглашаю Артура.</Text>
                {mode === 'create' ? <View style={styles.selectedBadge}><Text style={styles.selectedBadgeText}>✓ выбрано</Text></View> : null}
              </LinearGradient>
            </Pressable>

            <Pressable style={[styles.roleCard, mode === 'join' && styles.roleCardSelectedSon]} onPress={() => setMode('join')}>
              <LinearGradient colors={mode === 'join' ? ['#D97045', '#F0A24D'] : ['#FFFDF8', '#F7F2E8']} style={styles.roleGradient}>
                <View style={styles.roleImageBox}><Image source={artwork.path} style={styles.roleImage} resizeMode="contain" /></View>
                <Text style={[styles.roleKicker, mode === 'join' && styles.roleTextSelected]}>СЫН</Text>
                <Text style={[styles.roleTitle, mode === 'join' && styles.roleTextSelected]}>Я Артур</Text>
                <Text style={[styles.roleCopy, mode === 'join' && styles.roleCopySelected]}>Получил код папы и присоединяюсь к нему.</Text>
                {mode === 'join' ? <View style={styles.selectedBadgeLight}><Text style={styles.selectedBadgeTextDark}>✓ выбрано</Text></View> : null}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={[styles.formCard, shadows.soft]}>
            <View style={styles.formHeaderRow}>
              <View style={[styles.formIcon, { backgroundColor: isParent ? colors.mint : '#FFF0D4' }]}><Image source={isParent ? artwork.family : artwork.path} style={styles.formIconImage} resizeMode="contain" /></View>
              <View style={styles.formHeaderText}><Text style={styles.cardTitle}>{isParent ? 'Создать команду' : 'Подключиться к папе'}</Text><Text style={styles.cardCopy}>{isParent ? 'После создания появится одноразовый код для телефона Артура.' : 'Введи код, который показан на телефоне Михаила.'}</Text></View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>{isParent ? 'Имя папы' : 'Имя сына'}</Text>
              <TextInput value={isParent ? parentName : childName} onChangeText={isParent ? setParentName : setChildName} placeholder={isParent ? 'Михаил' : 'Артур'} placeholderTextColor={colors.mutedSoft} style={styles.input} autoCapitalize="words" />
            </View>

            {!isParent ? <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>Код от папы</Text><TextInput value={inviteCode} onChangeText={(value) => setInviteCode(value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" placeholderTextColor={colors.mutedSoft} style={[styles.input, styles.codeInput]} autoCapitalize="characters" autoCorrect={false} maxLength={14} /></View> : null}

            <Pressable style={[styles.primary, busy && styles.disabled]} onPress={isParent ? createTeam : joinTeam} disabled={busy}>
              <LinearGradient colors={isParent ? gradients.team : gradients.connection} style={styles.primaryGradient}>
                {busy ? <ActivityIndicator color={colors.white} /> : <><Text style={isParent ? styles.primaryText : styles.primaryTextDark}>{isParent ? 'Создать команду и получить код' : 'Присоединиться к команде'}</Text><Text style={isParent ? styles.primaryArrowLight : styles.primaryArrow}>→</Text></>}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.promiseCard}><Image source={artwork.together} style={styles.promiseImage} resizeMode="contain" /><View style={styles.promiseTextWrap}><Text style={styles.promiseTitle}>Связь, а не контроль</Text><Text style={styles.promiseCopy}>Отдельные аккаунты, общие моменты. Без скрытого наблюдения и без оценки «хороший/плохой».</Text></View></View>

          <Pressable onPress={exit}><Text style={styles.exit}>Выйти из аккаунта</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, keyboard: { flex: 1 }, content: { flexGrow: 1, padding: 18, justifyContent: 'center', gap: 16 }, centered: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center' },
  setupHero: { minHeight: 235, borderRadius: radius.xl, padding: 22, justifyContent: 'flex-end', overflow: 'hidden' }, inviteHero: { minHeight: 350, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'space-between' }, alreadyCard: { width: '100%', borderRadius: radius.xl, padding: 26, minHeight: 350, justifyContent: 'center', overflow: 'hidden' },
  orbLarge: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,215,106,0.10)', top: -74, right: -45 }, orbSmall: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)', bottom: -18, left: -22 }, heroBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandImage: { width: 52, height: 52, borderRadius: 16 }, heroKicker: { color: colors.sun, fontSize: 9, fontWeight: '900', letterSpacing: 1.8 }, heroBrand: { color: colors.white, fontSize: 20, fontWeight: '900', marginTop: 4 }, heroTitle: { color: colors.white, fontSize: 27, lineHeight: 31, fontWeight: '900', letterSpacing: -0.7, marginTop: 14, maxWidth: '82%' }, heroCopy: { color: '#D7E6E8', fontSize: 12, lineHeight: 18, marginTop: 7, maxWidth: '70%' }, setupHeroImage: { position: 'absolute', width: 128, height: 128, right: 8, bottom: 10, opacity: 0.95 }, alreadyImage: { width: 120, height: 120, alignSelf: 'flex-end', marginBottom: 20 },
  roleGrid: { flexDirection: 'row', gap: 10 }, roleCard: { flex: 1, minHeight: 205, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineWarm }, roleCardSelected: { borderColor: colors.tealBright, ...shadows.soft }, roleCardSelectedSon: { borderColor: colors.orange, ...shadows.soft }, roleGradient: { flex: 1, padding: 14, justifyContent: 'flex-end' }, roleImageBox: { width: 58, height: 58, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 }, roleImage: { width: 54, height: 54 }, roleKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 }, roleTitle: { color: colors.navyDeep, fontSize: 17, fontWeight: '900', marginTop: 3 }, roleCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 }, roleTextSelected: { color: colors.white }, roleCopySelected: { color: '#E2EDEE' }, selectedBadge: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill }, selectedBadgeLight: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: 'rgba(255,255,255,0.32)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill }, selectedBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' }, selectedBadgeTextDark: { color: colors.navyDeep, fontSize: 8, fontWeight: '900' },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 15, borderWidth: 1, borderColor: colors.lineWarm }, formHeaderRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, formIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, formIconImage: { width: 45, height: 45 }, formHeaderText: { flex: 1 }, cardTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' }, cardCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 4 }, fieldWrap: { gap: 6 }, fieldLabel: { color: colors.text, fontSize: 11, fontWeight: '900', paddingLeft: 2 }, input: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 15, backgroundColor: colors.white, color: colors.text, fontSize: 15 }, codeInput: { textAlign: 'center', fontSize: 19, fontWeight: '900', letterSpacing: 2 },
  primary: { borderRadius: radius.md, overflow: 'hidden' }, primaryGradient: { minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, primaryText: { color: colors.white, fontSize: 13, fontWeight: '900' }, primaryTextDark: { color: colors.navyDeep, fontSize: 13, fontWeight: '900' }, primaryArrow: { color: colors.navyDeep, fontSize: 20, fontWeight: '900' }, primaryArrowLight: { color: colors.white, fontSize: 20, fontWeight: '900' }, disabled: { opacity: 0.55 },
  promiseCard: { flexDirection: 'row', gap: 12, backgroundColor: '#EEF5F2', borderRadius: radius.lg, padding: 14, alignItems: 'center' }, promiseImage: { width: 54, height: 54 }, promiseTextWrap: { flex: 1 }, promiseTitle: { color: colors.text, fontSize: 11, fontWeight: '900' }, promiseCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 }, exit: { color: colors.muted, textAlign: 'center', paddingVertical: 8, fontWeight: '800', fontSize: 11 },
  phoneRoute: { flexDirection: 'row', alignItems: 'center', marginTop: 16 }, phoneCard: { width: 82, alignItems: 'center' }, phoneImageBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, phoneImage: { width: 58, height: 58 }, phoneName: { color: colors.white, fontSize: 11, fontWeight: '900', marginTop: 7 }, phoneState: { color: '#BFD3D7', fontSize: 9, marginTop: 2 }, routeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }, routeLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.24)' }, routeBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,215,106,0.14)', borderWidth: 1, borderColor: 'rgba(255,215,106,0.28)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, routeImage: { width: 44, height: 44 },
  codeCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: colors.lineWarm }, codeImage: { width: 64, height: 64, marginBottom: 4 }, codeKicker: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, inviteCode: { color: colors.navyDeep, fontSize: 30, fontWeight: '900', letterSpacing: 2.2, marginTop: 10 }, codeDivider: { width: 48, height: 3, borderRadius: 2, backgroundColor: colors.amber, marginVertical: 13 }, codeHint: { color: colors.text, fontSize: 11, fontWeight: '900' }, codeFine: { color: colors.muted, fontSize: 9, marginTop: 3 },
  stepsCard: { backgroundColor: colors.sandWarm, borderRadius: radius.xl, padding: 18, gap: 12 }, stepsHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 }, stepsImage: { width: 46, height: 46 }, stepsTitle: { color: colors.navyDeep, fontSize: 17, fontWeight: '900', flex: 1 }, stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, stepBadge: { width: 28, height: 28, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, stepBadgeText: { color: colors.teal, fontSize: 11, fontWeight: '900' }, stepText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 }, alreadyCopy: { color: '#D7E6E8', fontSize: 12, lineHeight: 18, marginTop: 8 }, alreadyButton: { marginTop: 24, alignSelf: 'flex-start', backgroundColor: colors.sun, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md }, alreadyButtonText: { color: colors.navyDeep, fontSize: 12, fontWeight: '900' },
});