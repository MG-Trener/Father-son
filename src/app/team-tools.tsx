import { ToolHub, type HubTool } from '../components/ToolHub';

const tools: HubTool[] = [
  {
    image: require('../../assets/generated/feature-family.png'), eyebrow: 'ЭТОТ МЕСЯЦ', title: 'Месяц вместе',
    text: 'Спокойный обзор встреч, голосов, признаний и шагов — без рейтингов и серий.',
    route: '/month-together', base: '#E6F0F2', ink: '#2D6D73', wide: true,
  },
  {
    image: require('../../assets/generated/utility-calendar.png'), eyebrow: 'НЕ ПРОПУСТИТЬ', title: 'События',
    text: 'Важные действия второго участника остаются здесь, даже если push был пропущен.',
    route: '/notifications', base: '#F7E8EE', ink: '#9B5660', wide: true,
  },
  {
    image: require('../../assets/generated/utility-agreements.png'), eyebrow: 'МЕЖДУ НАМИ', title: 'Договорённости',
    text: 'Взаимные правила, которые действуют только после согласия обоих.',
    route: '/agreements', base: '#FFF0CF', ink: '#956719',
  },
  {
    image: require('../../assets/generated/feature-family.png'), eyebrow: 'КАК УСТРОЕНО', title: 'Знакомство',
    text: 'Повторить короткий ролевой walkthrough по приложению.',
    route: '/onboarding', base: '#E6F0F2', ink: '#2D6D73',
  },
  {
    image: require('../../assets/generated/feature-book.png'), eyebrow: 'АРХИВ', title: 'История',
    text: 'Общая летопись ваших встреч, голосов, шагов и важных моментов.',
    route: '/(tabs)/history', base: '#EDE8F7', ink: '#66579C',
  },
  {
    image: require('../../assets/generated/feature-path.png'), eyebrow: 'НА БУДУЩЕЕ', title: 'Письма и голос',
    text: 'Послания друг другу и будущему себе, которые можно сохранить надолго.',
    route: '/letters', base: '#DCEFFF', ink: '#2E6286',
  },
];

export default function TeamToolsScreen() {
  return (
    <ToolHub
      kicker="НАША КОМАНДА"
      title="Всё, что касается нас"
      subtitle="Здесь собраны не ежедневные действия, а вещи про вашу команду, договорённости, историю и память."
      emblemImage={require('../../assets/generated/feature-family.png')}
      tools={tools}
    />
  );
}
