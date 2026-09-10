import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows } from '../theme';

type Props = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  accent?: string;
}>;

export function AppCard({ title, subtitle, right, accent, children }: Props) {
  return (
    <View style={[styles.card, shadows.soft]}>
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
    </View>
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
