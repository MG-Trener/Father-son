import { Text } from 'react-native';
import { router } from 'expo-router';
import { brandAssets } from '../brandAssets';
import { ActionRow, Button, Card, Heading, Page, Section, ui } from '../components/Everyday';

export default function MemoryScreen() {
  return <Page>
    <Heading title="Память" subtitle="Истории, слова и моменты, к которым хочется возвращаться." />
    <Card tone="warm">
      <Text style={ui.sectionTitle}>Что хочется запомнить?</Text>
      <Text style={ui.body}>Смешной случай, хороший день или несколько важных слов друг другу.</Text>
      <Button label="Записать воспоминание" onPress={() => router.push({ pathname: '/reflection-new', params: { mode: 'story' } })} />
      <Button label="Рассказать голосом" secondary onPress={() => router.push('/voice-story-new')} />
    </Card>
    <Section title="Наша история">
      <ActionRow title="Текстовые воспоминания" description="Прочитать ваши истории и ответы целиком" image={brandAssets.actions.memories} to="/memories" />
      <ActionRow title="Важные события" description="По месяцам: встречи, занятия и достижения" image={brandAssets.actions.timeline} to="/(tabs)/history" />
      <ActionRow title="Голосовые истории" description="Послушать друг друга снова" image={brandAssets.utility.voice} to="/voice-stories" />
      <ActionRow title="Письма в будущее" description="Себе или друг другу — на выбранную дату" image={brandAssets.utility.letter} to="/letters" />
      <ActionRow title="Книга года" description="Собрать важные моменты взросления" image={brandAssets.actions.yearbook} to="/year-review" />
    </Section>
  </Page>;
}
