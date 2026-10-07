import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Button, Card, Heading, Page, ui } from '../components/Everyday';
import { useFamily } from '../context/FamilyContext';
import { useFamilyPresentation } from '../hooks/useFamilyPresentation';
import { supabase } from '../lib/supabase';

export default function OnboardingScreen() {
  const { family, me, refresh } = useFamily();
  const { isChild } = useFamilyPresentation();
  const [busy, setBusy] = useState(false);
  const complete = async () => {
    const client = supabase;
    if (busy) return;
    if (!client) { router.replace('/(tabs)'); return; }
    if (!family || !me) { router.replace('/team-setup'); return; }
    setBusy(true);
    try {
      const { error } = await client
        .from('family_members')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('family_id', family.id)
        .eq('user_id', me.user_id);
      if (error) throw error;
      await refresh();
      router.replace('/(tabs)');
    } catch (caught) {
      Alert.alert('Не удалось завершить знакомство', caught instanceof Error ? caught.message : 'Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return <Page>
    <Heading title={isChild ? 'Твоё место рядом с папой' : 'Быть рядом с сыном'} subtitle="Общение и развитие — в удобном для вас ритме." back={Boolean(me?.onboarding_completed_at)} />
    {[
      ['Сегодня', 'С чего начать: поговорить или заняться тем, что интересно. Здесь же — настроение и ближайшая встреча.'],
      ['Вместе', 'Позвать на разговор, договориться о встрече, придумать общее дело и сказать спасибо.'],
      ['Развитие', 'Выбрать занятие, поставить посильную цель и заметить свой прогресс.'],
      ['Память', 'Сохранить текст, голосовую историю или письмо в будущее.'],
    ].map(([title, body]) => <Card key={title}><Text style={ui.sectionTitle}>{title}</Text><Text style={ui.body}>{body}</Text></Card>)}
    <Text style={ui.body}>Можно начать с одного действия и возвращаться, когда захочется. Кнопка «Настройки» открывает участников семьи, приглашение и обновления.</Text>
    <Button label="Начать со «Сегодня»" busy={busy} onPress={() => void complete()} />
  </Page>;
}
