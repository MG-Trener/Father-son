import { Image, ImageBackground, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { colors, radius, shadows } from '../theme';

export type HubTool = {
  icon?: string;
  image?: ImageSourcePropType;
  decor?: ImageSourcePropType;
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

        <View style={[styles.hero, shadows.lift]}>
          <ImageBackground
            source={require('../../assets/generated/family-hero.png')}
            resizeMode="cover"
            imageStyle={styles.heroImage}
            style={styles.heroBackground}
          >
            <LinearGradient
              colors={['rgba(5,27,38,0.22)', 'rgba(7,39,49,0.68)', 'rgba(5,25,34,0.96)']}
              locations={[0, 0.5, 1]}
              style={styles.heroOverlay}
            >
              <View style={styles.heroGlow} />
              <View style={styles.heroTop}>
                <View style={styles.heroKickerPill}><Text style={styles.heroKicker}>{kicker}</Text></View>
                <View style={styles.emblem}>
                  {emblemImage ? <Image source={emblemImage} style={styles.emblemImage} resizeMode="contain" /> : <Text style={styles.emblemText}>{emblem}</Text>}
                </View>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>{title}</Text>
                <Text style={styles.heroText}>{subtitle}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

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
              {tool.decor ? <Image pointerEvents="none" source={tool.decor} style={[styles.cardDecor, tool.wide && styles.cardDecorWide]} resizeMode="contain" /> : null}
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
  hero: { minHeight: 282, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.night },
  heroBackground: { flex: 1, minHeight: 282 },
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { flex: 1, minHeight: 282, padding: 19, justifyContent: 'space-between' },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,215,106,0.12)', right: -70, top: -78 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroKickerPill: { backgroundColor: 'rgba(6,31,41,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  heroKicker: { color: '#F4DFC1', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  emblem: { width: 62, height: 62, borderRadius: 20, backgroundColor: 'rgba(255,248,233,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  emblemImage: { width: 56, height: 56 },
  emblemText: { color: colors.navyDeep, fontSize: 24, fontWeight: '900' },
  heroCopy: { maxWidth: '88%' },
  heroTitle: { color: colors.white, fontSize: 29, lineHeight: 32, fontWeight: '900', letterSpacing: -0.8 },
  heroText: { color: '#E3ECEC', fontSize: 10.5, lineHeight: 16, marginTop: 8, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  sectionKicker: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: colors.navyDeep, fontSize: 20, fontWeight: '900', marginTop: 3, letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', minHeight: 210, borderRadius: radius.xl, borderWidth: 1, padding: 15, overflow: 'hidden' },
  cardWide: { width: '100%', minHeight: 178 },
  cardDecor: { position: 'absolute', width: 116, height: 116, right: -20, top: -14, opacity: 0.24 },
  cardDecorWide: { width: 154, height: 154, right: 2, top: -22, opacity: 0.28 },
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
