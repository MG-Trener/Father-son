import { useState } from 'react';
import {
  Alert,
  Image,
  ImageBackground,
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
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() || undefined } },
      });
      if (error) throw error;

      if (data.session) router.replace('/');
      else {
        Alert.alert('Почти готово', 'Проверьте почту и подтвердите регистрацию, затем войдите.');
        setMode('signin');
      }
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось выполнить вход.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, shadows.lift]}>
            <ImageBackground
              source={require('../../assets/generated/family-hero.webp')}
              resizeMode="cover"
              style={styles.heroBackground}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={['rgba(5,25,34,0.22)', 'rgba(5,37,48,0.64)', 'rgba(5,25,34,0.97)']}
                locations={[0, 0.48, 1]}
                style={styles.heroOverlay}
              >
                <View style={styles.brandRow}>
                  <View style={styles.brandMark}>
                    <Image source={require('../../assets/generated/app-icon.png')} style={styles.brandImage} resizeMode="contain" />
                  </View>
                  <View style={styles.brandCopy}>
                    <Text style={styles.brand}>Папа <Text style={styles.amp}>&</Text> Я</Text>
                    <Text style={styles.kicker}>МИХАИЛ + АРТУР</Text>
                  </View>
                </View>

                <View style={styles.heroCopyWrap}>
                  <View style={styles.teamPill}>
                    <Image source={require('../../assets/generated/feature-together.png')} style={styles.teamPillImage} resizeMode="contain" />
                    <Text style={styles.teamPillText}>ОДНА КОМАНДА</Text>
                  </View>
                  <Text style={styles.heroTitle}>Быть ближе. Расти вместе.</Text>
                  <Text style={styles.heroCopy}>
                    Разговоры, встречи, голосовые истории, развитие и память — в одном приватном пространстве папы и сына.
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>

          <View style={[styles.formCard, shadows.soft]}>
            <View style={styles.modeSwitch}>
              <Pressable style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]} onPress={() => setMode('signin')}>
                <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Войти</Text>
              </Pressable>
              <Pressable style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]} onPress={() => setMode('signup')}>
                <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Создать аккаунт</Text>
              </Pressable>
            </View>

            <View style={styles.formHeading}>
              <View style={styles.headingRow}>
                <View style={styles.headingIcon}>
                  <Image source={require('../../assets/generated/feature-home.png')} style={styles.headingIconImage} resizeMode="contain" />
                </View>
                <View style={styles.headingCopy}>
                  <Text style={styles.title}>{mode === 'signin' ? 'Возвращаемся в команду' : 'Начинаем вашу историю'}</Text>
                  <Text style={styles.description}>
                    {mode === 'signin'
                      ? 'Войди в семейное пространство и продолжи с того места, где вы остановились.'
                      : 'У каждого будет свой аккаунт. После регистрации два телефона соединятся в одну семейную команду.'}
                  </Text>
                </View>
              </View>
            </View>

            {mode === 'signup' ? (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Имя</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Например, Михаил" placeholderTextColor={colors.mutedSoft} style={styles.input} autoCapitalize="words" />
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

            <Pressable style={[styles.primary, busy && styles.disabled]} onPress={() => void submit()} disabled={busy}>
              <LinearGradient colors={gradients.connection} style={styles.primaryGradient}>
                <Text style={styles.primaryText}>{busy ? 'Подключаем…' : mode === 'signin' ? 'Открыть нашу команду' : 'Создать аккаунт'}</Text>
                {!busy ? <Text style={styles.primaryArrow}>→</Text> : null}
              </LinearGradient>
            </Pressable>

            <View style={styles.privacyCard}>
              <View style={styles.privacyIcon}>
                <Image source={require('../../assets/generated/feature-family.png')} style={styles.privacyImage} resizeMode="contain" />
              </View>
              <View style={styles.privacyTextWrap}>
                <Text style={styles.privacyTitle}>Приватное пространство</Text>
                <Text style={styles.privacyCopy}>Без геолокации, контроля «когда был онлайн» и скрытого наблюдения. Только то, чем вы сами решили поделиться.</Text>
              </View>
            </View>
          </View>

          <View style={styles.footerRow}>
            <Image source={require('../../assets/generated/feature-path.png')} style={styles.footerImage} resizeMode="contain" />
            <Text style={styles.footer}>Одна команда. Где бы мы ни были.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, padding: 18, gap: 18, justifyContent: 'center' },
  hero: { minHeight: 420, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.night },
  heroBackground: { flex: 1, minHeight: 420 },
  heroImage: { width: '100%', height: '100%', borderRadius: radius.xl },
  heroOverlay: { flex: 1, minHeight: 420, padding: 21, justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandMark: { width: 58, height: 58, borderRadius: 19, backgroundColor: 'rgba(255,248,233,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandImage: { width: 54, height: 54 },
  brandCopy: { flex: 1 },
  brand: { color: colors.white, fontSize: 25, fontWeight: '900', letterSpacing: -0.6 },
  amp: { color: colors.sun },
  kicker: { color: '#D8E8E9', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 2 },
  heroCopyWrap: { maxWidth: '94%' },
  teamPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,248,233,0.91)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6, marginBottom: 11 },
  teamPillImage: { width: 27, height: 27 },
  teamPillText: { color: colors.navyDeep, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 31, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9, maxWidth: '88%' },
  heroCopy: { color: '#E2ECEC', fontSize: 12, lineHeight: 18, maxWidth: '94%', marginTop: 9, fontWeight: '700' },
  formCard: { backgroundColor: colors.paper, borderRadius: radius.xl, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.lineWarm },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.sandWarm, borderRadius: radius.md, padding: 4 },
  modeButton: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  modeButtonActive: { backgroundColor: colors.navyDeep },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: colors.white },
  formHeading: { marginBottom: 2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF0CF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headingIconImage: { width: 47, height: 47 },
  headingCopy: { flex: 1 },
  title: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', letterSpacing: -0.35 },
  description: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 11, fontWeight: '900', paddingLeft: 2 },
  input: { height: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 15, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  primary: { borderRadius: radius.md, overflow: 'hidden', marginTop: 2 },
  primaryGradient: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  disabled: { opacity: 0.55 },
  primaryText: { color: colors.navyDeep, fontWeight: '900', fontSize: 14 },
  primaryArrow: { color: colors.navyDeep, fontWeight: '900', fontSize: 20, marginTop: -2 },
  privacyCard: { flexDirection: 'row', gap: 11, backgroundColor: '#EEF5F2', borderRadius: radius.md, padding: 12, alignItems: 'center' },
  privacyIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  privacyImage: { width: 42, height: 42 },
  privacyTextWrap: { flex: 1 },
  privacyTitle: { color: colors.text, fontSize: 11, fontWeight: '900' },
  privacyCopy: { color: colors.muted, fontSize: 9.5, lineHeight: 14, marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingBottom: 4 },
  footerImage: { width: 30, height: 30 },
  footer: { color: colors.muted, fontSize: 11, fontWeight: '800' },
});
