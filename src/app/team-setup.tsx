import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Page, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { supabase } from '../lib/supabase';

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
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
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
        p_family_name: 'Папа и сын',
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

  if (createdInvite) return <Page><Text style={ui.brand}>Папа & Я</Text><Text style={ui.title}>Теперь подключим сына</Text><Card tone="warm"><Text style={ui.rowTitle}>Код приглашения</Text><Text selectable style={ui.title}>{createdInvite.invite_code}</Text><Text style={ui.body}>На своём телефоне сын создаёт отдельный аккаунт, выбирает «Я сын» и вводит этот код.</Text><Text style={ui.caption}>Действует до {new Date(createdInvite.invite_expires_at).toLocaleString('ru-RU')}</Text></Card><Button label="Перейти в приложение" onPress={() => router.replace('/(tabs)')} /></Page>;
  if (family) return <Page><Text style={ui.title}>Вы уже подключены</Text><Text style={ui.body}>{family.name}</Text><Button label="Открыть приложение" onPress={() => router.replace('/(tabs)')} /></Page>;
  return <Page>
    <Text style={ui.brand}>Папа & Я</Text><Text style={ui.title}>Подключим два телефона</Text><Text style={ui.body}>Папа создаёт семью. Сын подключается по приглашению.</Text>
    <View style={ui.wrap}><Chip label="Я папа" selected={mode === 'create'} onPress={() => setMode('create')} /><Chip label="Я сын" selected={mode === 'join'} onPress={() => setMode('join')} /></View>
    <Card>
      <Text style={ui.sectionTitle}>{mode === 'create' ? 'Создать семью' : 'Присоединиться к папе'}</Text>
      <Text style={ui.rowTitle}>{mode === 'create' ? 'Как вас зовут?' : 'Как тебя зовут?'}</Text>
      <TextInput accessibilityLabel="Имя" style={ui.input} value={mode === 'create' ? parentName : childName} onChangeText={mode === 'create' ? setParentName : setChildName} placeholder="Имя" autoComplete="name" />
      {mode === 'join' ? <><Text style={ui.rowTitle}>Код от папы</Text><TextInput accessibilityLabel="Код приглашения от папы" style={ui.input} value={inviteCode} onChangeText={setInviteCode} placeholder="12 символов" autoCapitalize="characters" autoCorrect={false} maxLength={12} /><Text style={ui.body}>Код можно найти на телефоне папы: «Настройки» → «Получить код приглашения».</Text></> : <Text style={ui.body}>После создания вы получите код для телефона сына.</Text>}
      <Button label={mode === 'create' ? 'Создать семью и получить код' : 'Подключиться к семье'} busy={busy} onPress={() => void (mode === 'create' ? createTeam() : joinTeam())} />
    </Card>
    <Button label="Войти в другой аккаунт" secondary onPress={() => void exit()} />
  </Page>;
}
