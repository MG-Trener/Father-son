import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Text,
  TextInput
} from 'react-native';
import { brandAssets } from '../brandAssets';
import { ActionRow, Button, Card, Heading, Page, ui } from '../components/Everyday';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { createReflection } from '../data/reflectionRepository';
import { supabase } from '../lib/supabase';

const artwork = {
  book: brandAssets.navigation.book,
  together: brandAssets.navigation.together,
  voice: brandAssets.utility.voice,
  recognition: brandAssets.utility.recognition,
  goal: brandAssets.utility.goal,
} as const;

export default function ReflectionNewScreen() {
  const params = useLocalSearchParams<{ prompt?: string; mode?: string }>();
  const { session } = useAuth();
  const { family, me, members } = useFamily();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = typeof params.prompt === 'string' && params.prompt.trim()
    ? params.prompt.trim()
    : params.mode === 'story'
      ? 'Что сегодня хочется сохранить друг для друга?'
      : 'Что хочется сказать сейчас?';
  const displayPrompt = prompt.replace(/\s*·\s*Книга года\s+\d+\s*$/i, '').trim();
  const isStory = params.mode === 'story';

  const other = useMemo(
    () => members.find((member) => member.user_id !== me?.user_id) ?? null,
    [members, me],
  );

  const save = async () => {
    const client = supabase;
    if (!client || !family || !session || busy) return;
    const trimmed = body.trim();
    if (!trimmed) {
      Alert.alert('Пока пусто', 'Напиши хотя бы одну мысль, которую хочется сохранить.');
      return;
    }

    setBusy(true);
    try {
      await createReflection(client, {
        familyId: family.id,
        body: trimmed,
        prompt,
      });
      Alert.alert(
        isStory ? 'История сохранена' : 'Ответ сохранён',
        `${other?.display_name ?? 'Второй участник'} увидит это в вашей общей Истории.`,
      );
      router.back();
    } catch (caught) {
      Alert.alert('Не удалось сохранить', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return <Page>
    <Heading title={isStory ? 'Новое воспоминание' : 'Ответ друг другу'} subtitle={displayPrompt} back />
    <Card>
      <Text style={ui.rowTitle}>{isStory ? 'Что произошло?' : 'Что хочется сказать?'}</Text>
      <TextInput accessibilityLabel={isStory ? 'Текст воспоминания' : 'Текст ответа'} style={[ui.input, ui.textArea, { minHeight: 190 }]} value={body} onChangeText={setBody} placeholder="Можно написать всего несколько слов…" multiline maxLength={4000} />
      <Text style={ui.caption}>Запись будет доступна вам обоим. {body.length}/4000</Text>
      <Button label={isStory ? 'Сохранить воспоминание' : 'Сохранить ответ'} busy={busy} onPress={() => void save()} />
    </Card>
    <ActionRow title="Удобнее рассказать голосом?" description="Записать отдельную голосовую историю" image={artwork.voice} to={{ pathname: '/voice-story-new', params: { prompt } }} />
  </Page>;
}
