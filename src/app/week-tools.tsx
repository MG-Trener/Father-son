import { ToolHub, type HubTool } from '../components/ToolHub';

const tools: HubTool[] = [
  {
    icon: '◎', eyebrow: 'ОРИЕНТИР', title: 'Фокус недели',
    text: 'Один личный фокус и один общий. Без процентов, серий и статуса «провалено».',
    route: '/weekly-focus', base: '#DCEFFF', ink: '#2E6286', wide: true,
  },
  {
    icon: '▤', eyebrow: 'ОГЛЯНУТЬСЯ', title: 'Итог недели',
    text: 'Что осталось от недели: настроение, ритуалы, признания и сохранённые моменты.',
    route: '/week-review', base: '#E5F0F2', ink: '#2D6D73',
  },
  {
    icon: '📖', eyebrow: 'ПАМЯТЬ', title: 'Книга года',
    text: 'Посмотреть, как отдельные недели складываются в большую историю взросления.',
    route: '/(tabs)/yearbook', base: '#FFF0CF', ink: '#956719',
  },
  {
    icon: '✦', eyebrow: 'ХРОНОЛОГИЯ', title: 'История пути',
    text: 'Все сохранённые события по времени — без оценок и сравнений.',
    route: '/(tabs)/history', base: '#EDE8F7', ink: '#66579C', wide: true,
  },
];

export default function WeekToolsScreen() {
  return <ToolHub kicker="РАЗВИТИЕ" title="Эта неделя" subtitle="Не план на идеальную жизнь, а несколько спокойных инструментов, которые помогают замечать движение и возвращаться к важному." emblem="◎" tools={tools} />;
}
