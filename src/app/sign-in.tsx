import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radius } from '../theme';
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
        router.replace('/(tabs)');
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
        router.replace('/(tabs)');
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.brand}>Папа & Я</Text>
          <Text style={styles.tagline}>Михаил + Артур</Text>
          <Text style={styles.slogan}>Одна команда. Где бы мы ни были.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{mode === 'signin' ? 'Войти' : 'Создать аккаунт'}</Text>
          <Text style={styles.description}>
            {mode === 'signin'
              ? 'Вход в ваше приватное семейное пространство.'
              : 'Сначала создаём отдельные аккаунты, затем связываем их в одну команду.'}
          </Text>

          {mode === 'signup' ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Имя"
              placeholderTextColor={colors.muted}
              style={styles.input}
              autoCapitalize="words"
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль"
            placeholderTextColor={colors.muted}
            style={styles.input}
            secureTextEntry
          />

          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Подключаем…' : mode === 'signin' ? 'Войти' : 'Продолжить'}</Text>
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={styles.switchText}>
              {mode === 'signin' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>Без геолокации и контроля «когда был онлайн». Только то, чем вы сами хотите делиться.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  keyboard: { flex: 1, justifyContent: 'center', padding: 22, gap: 22 },
  hero: { alignItems: 'center' },
  brand: { color: colors.navyDeep, fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.green, fontSize: 16, fontWeight: '900', marginTop: 7 },
  slogan: { color: colors.muted, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 23, fontWeight: '900' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 3 },
  input: { height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: colors.white, color: colors.text, fontSize: 15 },
  primary: { height: 50, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  disabled: { opacity: 0.55 },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  switchText: { color: colors.blue, fontWeight: '800', textAlign: 'center', paddingVertical: 8 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10 },
});
