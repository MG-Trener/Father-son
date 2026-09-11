import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { colors, gradients, radius, shadows } from '../theme';

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
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View><Text style={styles.topKicker}>{kicker}</Text><Text style={styles.topTitle}>{title}</Text></View>
        </View>

        <LinearGradient colors={gradients.team} style={[styles.hero, shadows.lift]}>
          <View style={styles.heroGlow} />
          <View style={styles.emblem}>
            {emblemImage ? <Image source={emblemImage} style={styles.emblemImage} resizeMode="contain" /> : <Text style={styles.emblemText}>{emblem}</Text>}
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroText}>{subtitle}</Text>
        </LinearGradient>

        <View style={styles.grid}>
          {tools.map((tool) => (
            <Pressable
              key={tool.title}
              onPress={() => router.push(tool.route)}
              style={[styles.card, tool.wide && styles.cardWide, { backgroundColor: tool.base, borderColor: `${tool.ink}22` }, shadows.soft]}
            >
              <View style={[styles.icon, { backgroundColor: tool.image ? 'rgba(255,255,255,0.60)' : tool.ink }]}> 
                {tool.image ? <Image source={tool.image} style={styles.iconImage} resizeMode="contain" /> : <Text style={styles.iconText}>{tool.icon}</Text>}
              </View>
              <Text style={[styles.eyebrow, { color: tool.ink }]}>{tool.eyebrow}</Text>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardText}>{tool.text}</Text>
              <Text style={[styles.open, { color: tool.ink }]}>Открыть →</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: 16, paddingBottom: 36, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.navyDeep, fontSize: 31, lineHeight: 33, marginTop: -3 },
  topKicker: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 1 },
  hero: { minHeight: 245, borderRadius: radius.xl, padding: 21, overflow: 'hidden', justifyContent: 'flex-end' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.10)', right: -65, top: -75 },
  emblem: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden' },
  emblemImage: { width: 58, height: 58 },
  emblemText: { color: colors.sun, fontSize: 24, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 28, lineHeight: 32, fontWeight: '900' },
  heroText: { color: '#D8E6E7', fontSize: 10.5, lineHeight: 16, marginTop: 7, maxWidth: '93%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', minHeight: 205, borderRadius: radius.xl, borderWidth: 1, padding: 15 },
  cardWide: { width: '100%', minHeight: 175 },
  icon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconImage: { width: 51, height: 51 },
  iconText: { color: colors.white, fontSize: 17, fontWeight: '900' },
  eyebrow: { fontSize: 7, fontWeight: '900', letterSpacing: 0.9, marginTop: 13 },
  cardTitle: { color: colors.navyDeep, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 4 },
  cardText: { color: colors.muted, fontSize: 8.5, lineHeight: 13, marginTop: 5 },
  open: { fontSize: 9, fontWeight: '900', marginTop: 'auto' },
});
