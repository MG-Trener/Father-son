import { useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radius, shadows } from '../theme';
import { supabase } from '../lib/supabase';

export default function SignInScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!supabase) {
      Alert.alert('Supabase не настроен', 'Добавьте EXPO_PUBLIC_SUPABASE_URL и publishable key в .env.');
      return;
    }

    if (!email.trim() || password.length < 6) {
      Alert.alert('Проверьте данные', 'Введите email и пароль не короче 6 символов.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace('/');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: name.trim() || undefined,
          },
        },
      });
      if (error) throw error;

      if (data.session) {
        router.replace('/');
      } else {
        Alert.alert('Почти готово', 'Проверьте почту и подтвердите регистрацию, затем войдите.');
        setMode('signin');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить вход.';
      Alert.alert('Ошибка', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
            <View style={styles.orbLarge} />
            <View style={styles.orbSmall} />
            <View style={styles.starOne} />
            <View style={styles.starTwo} />

            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>ПЯ</Text>
              </View>
              <View>
                <Text style={styles.brand}>Папа & Я</Text>
                <Text style={styles.kicker}>МИХАИЛ + АРТУР</Text>
              </View>
            </View>

            <View style={styles.teamScene}>
              <View style={styles.personColumn}>
                <View style={[styles.avatar, styles.avatarDad]}>
                  <Text style={styles.avatarText}>М</Text>
                </View>
                <Text style={styles.personName}>Михаил</Text>
                <Text style={styles.personRole}>Папа</Text>
              </View>

              <View style={styles.route}>
                <View style={styles.routeTopRow}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeDash} />
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>∞</Text>
                  </View>
                  <View style={styles.routeDash} />
                  <View style={styles.routeDotActive} />
                </View>
                <Text style={styles.routeText}>ОДНА КОМАНДА</Text>
              </View>

              <View style={styles.personColumn}>
                <View style={[styles.avatar, styles.avatarSon]}>
                  <Text style={styles.avatarText}>А</Text>
                </View>
                <Text style={styles.personName}>Артур</Text>
                <Text style={styles.personRole}>Сын</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Ближе, даже когда не рядом.</Text>
            <Text style={styles.heroCopy}>
              Разговоры, голосовые истории, встречи, миссии и путь взросления — в одном приватном пространстве вашей команды.
            </Text>
          </LinearGradient>

          <View style={[styles.formCard, shadows.soft]}>
            <View style={styles.modeSwitch}>
              <Pressable
                style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
                onPress={() => setMode('signin')}
              >
                <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Войти</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
                onPress={() => setMode('signup')}
              >
                <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Создать аккаунт</Text>
              </Pressable>
            </View>

            <View style={styles.formHeading}>
              <Text style={styles.title}>{mode === 'signin' ? 'Возвращаемся в команду' : 'Начинаем вашу историю'}</Text>
              <Text style={styles.description}>
                {mode === 'signin'
                  ? 'Войди в ваше семейное пространство и продолжи с того места, где остановились.'
                  : 'У каждого будет свой аккаунт. После регистрации вы свяжете два телефона в одну семейную команду.'}
              </Text>
            </View>

            {mode === 'signup' ? (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Имя</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Например, Михаил"
                  placeholderTextColor={colors.mutedSoft}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            ) : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedSoft}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Пароль</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Не короче 6 символов"
                placeholderTextColor={colors.mutedSoft}
                style={styles.input}
                secureTextEntry
              />
            </View>

            <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
              <LinearGradient colors={gradients.connection} style={styles.primaryGradient}>
                <Text style={styles.primaryText}>
                  {busy ? 'Подключаем…' : mode === 'signin' ? 'Открыть нашу команду' : 'Создать аккаунт'}
                </Text>
                {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
              </LinearGradient>
            </Pressable>

            <View style={styles.privacyCard}>
              <View style={styles.privacyIcon}>
                <Text style={styles.privacyIconText}>⌁</Text>
              </View>
              <View style={styles.privacyTextWrap}>
                <Text style={styles.privacyTitle}>Приватное пространство</Text>
                <Text style={styles.privacyCopy}>
                  Без геолокации, контроля «когда был онлайн» и скрытого наблюдения. Только то, чем вы сами решили поделиться.
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>Одна команда. Где бы мы ни были.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, padding: 18, gap: 18, justifyContent: 'center' },
  hero: { minHeight: 390, borderRadius: radius.xl, padding: 22, overflow: 'hidden', justifyContent: 'space-between' },
  orbLarge: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.10)', top: -82, right: -58 },
  orbSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.09)', bottom: 64, left: -42 },
  starOne: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sun, top: 116, right: 54, opacity: 0.8 },
  starTwo: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: colors.white, top: 154, right: 94, opacity: 0.7 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: colors.sun, fontSize: 16, fontWeight: '900' },
  brand: { color: colors.white, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  kicker: { color: '#BFD3D7', fontSize: 9, fontWeight: '900', letterSpacing: 1.7, marginTop: 2 },
  teamScene: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  personColumn: { width: 76, alignItems: 'center' },
  avatar: { width: 66, height: 66, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  avatarDad: { backgroundColor: colors.tealBright },
  avatarSon: { backgroundColor: colors.orange },
  avatarText: { color: colors.white, fontSize: 25, fontWeight: '900' },
  personName: { color: colors.white, fontSize: 12, fontWeight: '900', marginTop: 8 },
  personRole: { color: '#AFC7CC', fontSize: 9, fontWeight: '800', marginTop: 1 },
  route: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  routeTopRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7FA3AA' },
  routeDotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sun },
  routeDash: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  routeBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,215,106,0.13)', borderWidth: 1, borderColor: 'rgba(255,215,106,0.32)', alignItems: 'center', justifyContent: 'center' },
  routeBadgeText: { color: colors.sun, fontSize: 17, fontWeight: '900' },
  routeText: { color: '#BFD3D7', fontSize: 8, letterSpacing: 1.4, fontWeight: '900', marginTop: 8 },
  heroTitle: { color: colors.white, fontSize: 29, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, maxWidth: '88%' },
  heroCopy: { color: '#D6E5E6', fontSize: 13, lineHeight: 19, maxWidth: '94%', marginTop: 8 },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.lineWarm },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.sandWarm, borderRadius: radius.md, padding: 4 },
  modeButton: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modeButtonActive: { backgroundColor: colors.navyDeep },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: colors.white },
  formHeading: { gap: 5, marginBottom: 2 },
  title: { color: colors.navyDeep, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 11, fontWeight: '900', paddingLeft: 2 },
  input: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 15, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  primary: { borderRadius: radius.md, overflow: 'hidden', marginTop: 2 },
  primaryGradient: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  disabled: { opacity: 0.55 },
  primaryText: { color: colors.navyDeep, fontWeight: '900', fontSize: 14 },
  primaryArrow: { color: colors.navyDeep, fontWeight: '900', fontSize: 20, marginTop: -2 },
  privacyCard: { flexDirection: 'row', gap: 11, backgroundColor: '#EEF5F2', borderRadius: radius.md, padding: 12, alignItems: 'flex-start' },
  privacyIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  privacyIconText: { color: colors.green, fontSize: 20, fontWeight: '900' },
  privacyTextWrap: { flex: 1 },
  privacyTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  privacyCopy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  footer: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center', paddingBottom: 4 },
});
