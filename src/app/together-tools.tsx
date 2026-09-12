import { ToolHub, type HubTool } from '../components/ToolHub';

const tools: HubTool[] = [
  {
    image: require('../../assets/generated/utility-calendar.png'), eyebrow: 'ПРЯМО СЕЙЧАС', title: 'Сегодня',
    text: 'Фокусы, встреча, настроение, ритуалы и один следующий шаг без перегруза.',
    route: '/today', base: '#E5F0F2', ink: '#2D6D73', wide: true,
  },
  {
    image: require('../../assets/generated/feature-together.png'), eyebrow: 'РАЗГОВОР', title: 'Карточки',
    text: 'Один вопрос, чтобы узнать друг друга ещё немного лучше.',
    route: '/conversation-cards', base: '#EDE8F7', ink: '#66579C',
  },
  {
    image: require('../../assets/generated/utility-goal.png'), eyebrow: 'ТРАДИЦИИ', title: 'Ритуалы',
    text: 'То, что хочется повторять вместе — без серий и наказаний.',
    route: '/rituals', base: '#FFF0D2', ink: '#9B7027',
  },
  {
    image: require('../../assets/generated/utility-recognition.png'), eyebrow: 'ПОДДЕРЖКА', title: 'Я заметил',
    text: 'Сохранить конкретный поступок или качество, которое хочется отметить.',
    route: '/recognitions', base: '#F7E8EE', ink: '#9B5660',
  },
  {
    image: require('../../assets/generated/feature-family.png'), eyebrow: 'СИГНАЛ', title: 'Как мы?',
    text: 'Коротко показать своё состояние — можно вообще без текста.',
    route: '/mood-check-in', base: '#DDEDEF', ink: '#2D6D73',
  },
  {
    image: require('../../assets/generated/feature-path.png'), eyebrow: 'ПЛАНЫ', title: 'Наши встречи',
    text: 'Следующая встреча, идеи и то, что уже стало воспоминанием.',
    route: '/meeting-plan', base: '#DCEFFF', ink: '#2E6286', wide: true,
  },
];

export default function TogetherToolsScreen() {
  return (
    <ToolHub
      kicker="ВМЕСТЕ"
      title="Что хочется сделать вместе?"
      subtitle="Не обязательно использовать всё. Выберите только то, что сейчас действительно помогает быть ближе."
      emblemImage={require('../../assets/generated/feature-together.png')}
      tools={tools}
    />
  );
}
