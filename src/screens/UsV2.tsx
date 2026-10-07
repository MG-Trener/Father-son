import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { ActionRow, Button, Card, Heading, Page, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { checkForAppUpdate, installReleaseApk, type UpdateStatus } from '../lib/appUpdater';
import { supabase } from '../lib/supabase';
import { getApkInstallErrorCopy } from '../lib/updateInstallError';

type InviteResult = { family_id: string; invite_code: string; invite_expires_at: string };

export default function UsV2() {
  const { signOut } = useAuth();
  const { family, me, members } = useFamily();
  const parent = useMemo(() => members.find((member) => member.role === 'parent') ?? null, [members]);
  const child = useMemo(() => members.find((member) => member.role === 'child') ?? null, [members]);
  const parentName = parent?.display_name ?? 'Папа';
  const childName = child?.display_name ?? 'Сын';
  const teamName = family?.name ?? `${parentName} + ${childName}`;
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const createInvite = async () => {
    if (!supabase || !family || me?.role !== 'parent' || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('create_family_invite', { p_family_id: family.id, p_display_name_hint: childName });
      if (error) throw error;
      setInvite(data as unknown as InviteResult);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать приглашение.';
      Alert.alert('Не удалось создать код', message.includes('FAMILY_FULL') ? `${childName} уже подключён к этой команде.` : message);
    } finally {
      setBusy(false);
    }
  };

  const checkUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      setUpdateStatus(result);
      if (!result.available) Alert.alert('Всё актуально ✓', `Установлена версия ${result.currentVersion}.`);
    } catch {
      Alert.alert('Не удалось проверить', 'Проверь интернет и попробуй ещё раз.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!updateStatus?.release) {
      Alert.alert('APK ещё публикуется', 'Версия зарегистрирована, но файл обновления пока не опубликован.');
      return;
    }
    try {
      await installReleaseApk(updateStatus.release);
    } catch (caught) {
      const copy = getApkInstallErrorCopy(caught);
      Alert.alert(copy.title, copy.message);
    }
  };

  const exit = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  return <Page>
    <Heading title="Семья и настройки" subtitle="Два телефона — одно общее пространство." back familyLink={false} />
    <Card>
      <Text style={ui.sectionTitle}>{teamName}</Text>
      <Text style={ui.rowTitle}>Папа · {parentName}{me?.role === 'parent' ? ' (вы)' : ''}</Text><Text style={ui.body}>{parent ? 'Аккаунт подключён' : 'Ожидаем подключения'}</Text>
      <View style={ui.divider} />
      <Text style={ui.rowTitle}>Сын · {childName}{me?.role === 'child' ? ' (ты)' : ''}</Text><Text style={ui.body}>{child ? 'Аккаунт подключён' : 'Ещё не подключён'}</Text>
    </Card>
    {!child && me?.role === 'parent' ? <Card tone="warm">
      <Text style={ui.sectionTitle}>Подключить телефон сына</Text>
      <Text style={ui.body}>На своём телефоне сын создаёт отдельный аккаунт, выбирает «Я сын» и вводит этот код.</Text>
      {invite ? <><Text selectable style={ui.title}>{invite.invite_code}</Text><Text style={ui.caption}>Действует до {new Date(invite.invite_expires_at).toLocaleString('ru-RU')}</Text></> : null}
      <Button label={invite ? 'Создать новый код' : 'Получить код приглашения'} busy={busy} onPress={() => void createInvite()} />
    </Card> : null}
    <ActionRow title="Как пользоваться приложением" description="Четыре раздела и первые шаги" to="/onboarding" />
    <Card>
      <Text style={ui.sectionTitle}>Обновление приложения</Text>
      <Text style={ui.caption}>Установлена версия {Constants.expoConfig?.version ?? '—'}</Text>
      <Text style={ui.body}>{updateStatus?.available ? 'Доступна новая опубликованная версия.' : 'Проверка опубликованных версий приложения.'}</Text>
      <Button label="Проверить обновления" secondary busy={checkingUpdate} onPress={() => void checkUpdate()} />
      {updateStatus?.available ? <Button label="Скачать обновление" onPress={() => void installUpdate()} /> : null}
    </Card>
    <Text style={ui.body}>У каждого свой аккаунт. Общие записи и действия доступны участникам вашей семьи.</Text>
    <Button label="Выйти из аккаунта" secondary onPress={() => Alert.alert('Выйти из аккаунта?', 'Чтобы вернуться, понадобятся почта и пароль.', [{ text: 'Остаться', style: 'cancel' }, { text: 'Выйти', onPress: () => void exit() }])} />
  </Page>;
}
