import type { ReactNode } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brandAssets } from '../brandAssets';
import { colors, radius, shadows } from '../theme';

type StoryHeroProps = {
  kicker: string;
  title: string;
  subtitle: string;
  emblem?: string;
  emblemImage?: ImageSourcePropType;
  variant?: 'adventure' | 'warm' | 'book' | 'team';
  footer?: ReactNode;
};

const overlays = {
  adventure: ['rgba(5,35,49,0.96)', 'rgba(8,49,62,0.75)', 'rgba(16,69,76,0.34)'],
  warm: ['rgba(45,37,31,0.90)', 'rgba(86,57,36,0.68)', 'rgba(13,49,58,0.40)'],
  book: ['rgba(22,37,62,0.94)', 'rgba(44,59,91,0.74)', 'rgba(22,73,82,0.37)'],
  team: ['rgba(5,33,45,0.94)', 'rgba(8,55,67,0.76)', 'rgba(28,92,93,0.38)'],
} as const;

const variantEmblems: Record<NonNullable<StoryHeroProps['variant']>, ImageSourcePropType> = {
  adventure: brandAssets.features.path,
  warm: brandAssets.features.together,
  book: brandAssets.navigation.book,
  team: brandAssets.features.family,
};

export function StoryHero({ kicker, title, subtitle, emblem, emblemImage, variant = 'adventure', footer }: StoryHeroProps) {
  const image = emblemImage ?? (emblem ? undefined : variantEmblems[variant]);

  return (
    <View style={[styles.shell, shadows.lift]}>
      <LinearGradient
        colors={overlays[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <View style={styles.sunHalo} />
        <View style={styles.topRow}>
          <Text style={styles.kicker}>{kicker}</Text>
          <View style={styles.emblem}>
            {image ? <Image accessible={false} source={image} style={styles.emblemImage} resizeMode="contain" /> : <Text style={styles.emblemText}>{emblem}</Text>}
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 286,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.night,
  },
  overlay: {
    flex: 1,
    minHeight: 286,
    padding: 20,
    justifyContent: 'space-between',
  },
  sunHalo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,220,128,0.12)',
    right: -58,
    top: -56,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { color: '#D7E5E5', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, flex: 1 },
  emblem: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emblemImage: { width: 49, height: 49 },
  emblemText: { color: colors.white, fontSize: 22, fontWeight: '900' },
  copy: { marginTop: 54, maxWidth: '84%' },
  title: { color: colors.white, fontSize: 31, lineHeight: 33, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#E5EEEE', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 8 },
  footer: {
    marginTop: 22,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
});
