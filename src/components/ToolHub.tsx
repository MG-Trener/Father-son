import type { ImageSourcePropType } from 'react-native';
import type { Href } from 'expo-router';
import { Page, Heading, ActionRow, Section } from './Everyday';
export type HubTool = {
  icon?: string;
  image?: ImageSourcePropType;
  eyebrow: string;
  title: string;
  text: string;
  route: Href;
  base: string;
  ink: string;
  wide?: boolean;
};

type Props = {
  kicker: string;
  title: string;
  subtitle: string;
  emblem?: string;
  emblemImage?: ImageSourcePropType;
  tools: HubTool[];
};


export function ToolHub({ title, subtitle, tools }: Props) {
  return <Page><Heading title={title} subtitle={subtitle} back /><Section title="Выберите действие">{tools.map(tool => <ActionRow key={tool.title} title={tool.title} description={tool.text} image={tool.image} to={tool.route} />)}</Section></Page>;
}
