import { ToolHub, type HubTool } from '../components/ToolHub';

const tools: HubTool[] = [
  {
    icon: '•', eyebrow: 'НЕ ПРОПУСТИТЬ', title: 'События',
    text: 'Важные действия второго участника остаются здесь, даже если push был пропущен.',
    route: '/notifications', base: '#F7E8EE', ink: '#9B5660', wide: true,
  },
  {
    icon: '🤝', eyebrow: 'МЕЖДУ НАМИ', title: 'Договорённости',
    text: 'Взаимные правила, которые действуют только после согласия обоих.',
    route: '/agreements', base: '#FFF0CF', ink: '#956719',
  },
  {
    icon: '?', eyebrow: 'КАК УСТРОЕНО', title: 'Знакомство',
    text: 'Повторить короткий ролевой walkthrough по приложению.',
    route: '/onboarding', base: '#E6F0F2', ink: '#2D6D73',
  },
  {
    icon: '📖', eyebrow: 'АРХИВ', title: 'История',
    text: 'Общая летопись ваших встреч, голосов, шагов и важных моментов.',
    route: '/(tabs)/history', base: '#EDE8F7', ink: '#66579C',
  },
  {
    icon: '✉', eyebrow: 'НА БУДУЩЕЕ', title: 'Письма',
    text: 'Послания друг другу и будущему себе, которые можно открыть позже.',
    route: '/letters', base: '#DCEFFF', ink: '#2E6286',
  },
];

export default function TeamToolsScreen() {
  return <ToolHub kicker="НАША КОМАНДА" title="Всё, что касается нас" subtitle="Здесь собраны не ежедневные действия, а вещи про вашу команду, договорённости, историю и память." emblem="🏔️" tools={tools} />;
}
