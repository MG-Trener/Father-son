import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StoryHero } from './StoryHero';
import { router, type Href } from 'expo-router';
import { colors, radius, shadows } from '../theme';

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

export function ToolHub({ kicker, title, subtitle, emblem, emblemImage, tools }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.topKicker}>{kicker}</Text>
            <Text style={styles.topTitle}>{title}</Text>
          </View>
        </View>

        <StoryHero kicker={kicker} title={title} subtitle={subtitle} emblem={emblem} emblemImage={emblemImage} variant="team" />

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionKicker}>МОЖНО ВЫБРАТЬ ОДНО</Text>
            <Text style={styles.sectionTitle}>Что сейчас важнее всего?</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {tools.map((tool) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${tool.title}. ${tool.text}`}
              key={tool.title}
              onPress={() => router.push(tool.route)}
              style={[styles.card, tool.wide && styles.cardWide, { backgroundColor: tool.base, borderColor: `${tool.ink}22` }, shadows.soft]}
            >
              <View style={[styles.icon, { backgroundColor: tool.image ? 'rgba(255,255,255,0.66)' : tool.ink }]}>
                {tool.image ? <Image source={tool.image} style={styles.iconImage} resizeMode="contain" /> : <Text style={styles.iconText}>{tool.icon}</Text>}
              </View>
              <Text style={[styles.eyebrow, { color: tool.ink }]}>{tool.eyebrow}</Text>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardText}>{tool.text}</Text>
              <View style={styles.openRow}>
                <Text style={[styles.open, { color: tool.ink }]}>Открыть</Text>
                <Text style={[styles.openArrow, { color: tool.ink }]}>→</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F1E8' },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  topCopy: { flex: 1 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', minHeight: 210, borderRadius: radius.xl, borderWidth: 1, padding: 15 },
  cardWide: { width: '100%', minHeight: 178 },
  icon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.58)' },
  iconImage: { width: 54, height: 54 },
  iconText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  eyebrow: { fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 13 },
  cardTitle: { color: colors.navyDeep, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  cardText: { color: colors.muted, fontSize: 8.5, lineHeight: 13, marginTop: 5 },
  openRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  open: { fontSize: 9, fontWeight: '900' },
  openArrow: { fontSize: 17, fontWeight: '900' },
});
