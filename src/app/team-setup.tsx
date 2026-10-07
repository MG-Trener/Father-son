import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { Button, Card, Page, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';

export default function TeamSetupScreen() {
  const { signOut } = useAuth();
  const { family, refresh } = useFamily();
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (!supabase || busy) return;
    if (!name.trim() || !inviteCode.trim()) { Alert.alert('Заполните данные', 'Введите имя сына и код приглашения от папы.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('join_family_by_code', { p_invite_code: inviteCode.trim(), p_display_name: name.trim() });
      if (error) throw error;
      await refresh(); router.replace('/');
    } catch (error) {
      const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
      const explanation = message.includes('ALREADY_IN_FAMILY') ? 'Этот аккаунт уже подключён. Выйдите и войдите снова.'
        : message.includes('FAMILY_FULL') || message.includes('duplicate key') ? 'Сын уже подключён к этой семье.'
        : message.includes('INVITE') ? 'Проверьте код. Если срок истёк, попросите папу получить новый в настройках.'
        : 'Не удалось подключиться. Проверьте интернет и повторите попытку.';
      Alert.alert('Не получилось подключиться', explanation);
    } finally { setBusy(false); }
  };
  const exit = async () => { await signOut(); router.replace('/sign-in'); };
  if (family) return <Page><Text style={ui.title}>Вы уже подключены</Text><Button label="Открыть приложение" onPress={() => router.replace('/')} /></Page>;
  return <Page>
    <Text style={ui.brand}>Папа & Я</Text><Text style={ui.title}>Подключиться к папе</Text>
    <Text style={ui.body}>У папы уже есть семейная команда. Введите его код — приложение подключит этот аккаунт в роли сына.</Text>
    <Card>
      <Text style={ui.rowTitle}>Имя сына</Text><TextInput accessibilityLabel="Имя сына" style={ui.input} value={name} onChangeText={setName} placeholder="Как тебя зовут?" autoComplete="name" />
      <Text style={ui.rowTitle}>Код от папы</Text><TextInput accessibilityLabel="Код приглашения от папы" style={ui.input} value={inviteCode} onChangeText={setInviteCode} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect={false} maxLength={14} />
      <Text style={ui.body}>На телефоне папы: «Настройки» → «Получить код приглашения».</Text>
      <Button label="Подключиться как сын" busy={busy} onPress={() => void join()} />
    </Card>
    <Card tone="warm"><Text style={ui.rowTitle}>Это новый телефон папы?</Text><Text style={ui.body}>Роль папы уже занята владельцем. Войдите в существующий аккаунт папы и подтвердите новый вход через его почту.</Text><Button label="Войти в аккаунт папы" secondary onPress={() => void exit()} /></Card>
    <Button label="Войти в другой аккаунт" secondary onPress={() => void exit()} />
  </Page>;
}
