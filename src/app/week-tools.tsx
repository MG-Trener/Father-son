import { ToolHub, type HubTool } from '../components/ToolHub';
import { decorAssets } from '../lib/decorAssets';

const tools: HubTool[] = [
  {
    image: require('../../assets/generated/utility-goal.png'), decor: decorAssets.dottedPathStar, eyebrow: 'ОРИЕНТИР', title: 'Фокус недели',
    text: 'Один личный фокус и один общий. Без процентов, серий и статуса «провалено».',
    route: '/weekly-focus', base: '#DCEFFF', ink: '#2E6286', wide: true,
  },
  {
    image: require('../../assets/generated/badge-adventure.png'), decor: decorAssets.mountains, eyebrow: '11 → 18', title: 'Карта взросления',
    text: 'Восемь спокойных глав пути: ориентиры, общие моменты и большая история без дедлайнов.',
    route: '/path-map', base: '#E8F1F2', ink: '#2D6D73', wide: true,
  },
  {
    image: require('../../assets/generated/badge-planner.png'), decor: decorAssets.softWave, eyebrow: 'ОГЛЯНУТЬСЯ', title: 'Итог недели',
    text: 'Что осталось от недели: настроение, ритуалы, признания и сохранённые моменты.',
    route: '/week-review', base: '#E5F0F2', ink: '#2D6D73',
  },
  {
    image: require('../../assets/generated/badge-courage.png'), decor: decorAssets.shootingStar, eyebrow: '11 → 18', title: 'Гербы пути',
    text: 'Долгосрочные вехи без рейтинга, обнуления и гонки за сериями.',
    route: '/achievements', base: '#FFF1E8', ink: '#8D5246',
  },
  {
    image: require('../../assets/generated/feature-book.png'), decor: decorAssets.flowers, eyebrow: 'ПАМЯТЬ', title: 'Книга года',
    text: 'Посмотреть, как отдельные недели складываются в большую историю взросления.',
    route: '/(tabs)/yearbook', base: '#FFF0CF', ink: '#956719',
  },
  {
    image: require('../../assets/generated/badge-team.png'), decor: decorAssets.roadBushes, eyebrow: 'ХРОНОЛОГИЯ', title: 'История пути',
    text: 'Все сохранённые события по времени — без оценок и сравнений.',
    route: '/(tabs)/history', base: '#EDE8F7', ink: '#66579C', wide: true,
  },
];

export default function WeekToolsScreen() {
  return (
    <ToolHub
      kicker="РАЗВИТИЕ"
      title="Эта неделя"
      subtitle="Не план на идеальную жизнь, а несколько спокойных инструментов, которые помогают замечать движение и возвращаться к важному."
      emblemImage={require('../../assets/generated/badge-adventure.png')}
      tools={tools}
    />
  );
}
