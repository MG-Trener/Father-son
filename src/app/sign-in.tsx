import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Text, TextInput, View } from 'react-native';
import { brandAssets } from '../brandAssets';
import { Button, Card, Chip, Page, ui } from '../components/Everyday';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function SignInScreen() {
  const { session } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!supabase) {
      Alert.alert('Вход недоступен', 'В этой сборке не настроено подключение. Установите актуальную версию приложения.');
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
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() || undefined } },
      });
      if (error) throw error;

      if (!data.session) {
        Alert.alert('Почти готово', 'Проверьте почту и подтвердите регистрацию, затем войдите.');
        setMode('signin');
      }
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось выполнить вход.');
    } finally {
      setBusy(false);
    }
  };

  if (session) return <Redirect href="/" />;
  return <Page>
    <View style={ui.row}><Image source={brandAssets.app.icon} style={{ width: 52, height: 52, borderRadius: 14 }} /><View style={ui.flex}><Text style={ui.title}>Папа & Я</Text><Text style={ui.body}>Общаться. Пробовать. Расти вместе.</Text></View></View>
    <Image source={brandAssets.app.familyHero} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 22 }} resizeMode="cover" accessible={false} />
    <Card>
      <View style={ui.wrap}><Chip label="Войти" selected={mode === 'signin'} onPress={() => setMode('signin')} /><Chip label="Создать аккаунт" selected={mode === 'signup'} onPress={() => setMode('signup')} /></View>
      <Text style={ui.sectionTitle}>{mode === 'signin' ? 'С возвращением' : 'Давайте познакомимся'}</Text>
      {mode === 'signup' ? <><Text style={ui.rowTitle}>Ваше имя</Text><TextInput accessibilityLabel="Ваше имя" value={name} onChangeText={setName} placeholder="Как к вам обращаться" style={ui.input} autoComplete="name" /></> : null}
      <Text style={ui.rowTitle}>Электронная почта</Text>
      <TextInput accessibilityLabel="Электронная почта" value={email} onChangeText={setEmail} style={ui.input} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
      <Text style={ui.rowTitle}>Пароль</Text>
      <TextInput accessibilityLabel="Пароль" value={password} onChangeText={setPassword} style={ui.input} placeholder="Не меньше 6 символов" secureTextEntry autoCapitalize="none" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} onSubmitEditing={() => { if (!busy) void submit(); }} />
      <Button label={mode === 'signin' ? 'Войти' : 'Создать аккаунт'} busy={busy} onPress={() => void submit()} />
    </Card>
    <Text style={ui.body}>У папы и сына отдельные аккаунты. Сын создаёт аккаунт и подключается по коду папы. Папа входит в свой существующий аккаунт; новый вход подтверждается через его почту.</Text>
  </Page>;
}
