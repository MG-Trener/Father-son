import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows } from '../theme';

type Props = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  accent?: string;
}>;

export function AppCard({ title, subtitle, right, accent, children }: Props) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [reveal]);

  return (
    <Animated.View
      style={[
        styles.card,
        shadows.soft,
        {
          opacity: reveal,
          transform: [{
            translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
          }],
        },
      ]}
    >
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {(title || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.lineWarm,
    gap: 12,
    overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.25 },
  subtitle: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18 },
});
