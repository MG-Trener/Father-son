import { ToolHub, type HubTool } from '../components/ToolHub';
import { decorAssets } from '../lib/decorAssets';

const tools: HubTool[] = [
  {
    image: require('../../assets/generated/badge-team.png'), decor: decorAssets.heartRibbon, eyebrow: 'ЭТОТ МЕСЯЦ', title: 'Месяц вместе',
    text: 'Спокойный обзор встреч, голосов, признаний и шагов — без рейтингов и серий.',
    route: '/month-together', base: '#E6F0F2', ink: '#2D6D73', wide: true,
  },
  {
    image: require('../../assets/generated/badge-adventure.png'), decor: decorAssets.mountains, eyebrow: 'ПУТЬ 11 → 18', title: 'Карта взросления',
    text: 'Восемь глав пути Артура: ориентиры, общие моменты и большая история без дедлайнов.',
    route: '/path-map', base: '#E8F1F2', ink: '#2D6D73', wide: true,
  },
  {
    image: require('../../assets/generated/badge-planner.png'), decor: decorAssets.shootingStar, eyebrow: 'НЕ ПРОПУСТИТЬ', title: 'События',
    text: 'Важные действия второго участника остаются здесь, даже если push был пропущен.',
    route: '/notifications', base: '#F7E8EE', ink: '#9B5660', wide: true,
  },
  {
    image: require('../../assets/generated/utility-agreements.png'), decor: decorAssets.goldenSwoosh, eyebrow: 'МЕЖДУ НАМИ', title: 'Договорённости',
    text: 'Взаимные правила, которые действуют только после согласия обоих.',
    route: '/agreements', base: '#FFF0CF', ink: '#956719',
  },
  {
    image: require('../../assets/generated/feature-family.png'), decor: decorAssets.roadPlants, eyebrow: 'КАК УСТРОЕНО', title: 'Знакомство',
    text: 'Повторить короткий ролевой walkthrough по приложению.',
    route: '/onboarding', base: '#E6F0F2', ink: '#2D6D73',
  },
  {
    image: require('../../assets/generated/feature-book.png'), decor: decorAssets.moon, eyebrow: 'АРХИВ', title: 'История',
    text: 'Общая летопись ваших встреч, голосов, шагов и важных моментов.',
    route: '/(tabs)/history', base: '#EDE8F7', ink: '#66579C',
  },
  {
    image: require('../../assets/generated/feature-path.png'), decor: decorAssets.dottedPathStar, eyebrow: 'НА БУДУЩЕЕ', title: 'Письма',
    text: 'Послания друг другу и будущему себе, которые можно сохранить надолго.',
    route: '/letters', base: '#DCEFFF', ink: '#2E6286',
  },
  {
    image: require('../../assets/generated/utility-voice.png'), decor: decorAssets.birds, eyebrow: 'ЖИВОЙ ГОЛОС', title: 'Голосовой архив',
    text: 'Истории Михаила и Артура, которые останутся звучать спустя годы.',
    route: '/voice-stories', base: '#E5F0F2', ink: '#2D6D73', wide: true,
  },
];

export default function TeamToolsScreen() {
  return (
    <ToolHub
      kicker="НАША КОМАНДА"
      title="Всё, что касается нас"
      subtitle="Здесь собраны не ежедневные действия, а вещи про вашу команду, договорённости, историю и память."
      emblemImage={require('../../assets/generated/badge-team.png')}
      tools={tools}
    />
  );
}
