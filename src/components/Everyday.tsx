import { AppScrollView as ScrollView } from './AppScrollView';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Image, type ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { colors } from '../theme';

export function Page({ children, refreshing = false, onRefresh }: PropsWithChildren<{ refreshing?: boolean; onRefresh?: () => void }>) {
  const insets = useSafeAreaInsets();
  return <SafeAreaView style={ui.safe} edges={['top', 'left', 'right']}><ScrollView contentContainerStyle={[ui.content, { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} /> : undefined}>{children}</ScrollView></SafeAreaView>;
}

export function Heading({ title, subtitle, back = false, familyLink = false }: { title: string; subtitle?: string; back?: boolean; familyLink?: boolean }) {
  return <View style={ui.heading}>
    <View style={ui.between}>{back ? <Pressable accessibilityRole="button" accessibilityLabel="Назад" style={ui.smallButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><Text style={ui.link}>‹ Назад</Text></Pressable> : <Text style={ui.brand}>Папа & Я</Text>}
      {familyLink ? <Pressable accessibilityRole="button" accessibilityLabel="Настройки" style={ui.smallButton} onPress={() => router.navigate('/settings')}><Text style={ui.link}>Настройки</Text></Pressable> : null}
    </View>
    <Text accessibilityRole="header" style={ui.title}>{title}</Text>
    {subtitle ? <Text style={ui.body}>{subtitle}</Text> : null}
  </View>;
}

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={ui.section}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>{children}</View>;
}
export function Card({ children, tone = 'plain' }: PropsWithChildren<{ tone?: 'plain' | 'warm' | 'mint' }>) {
  return <View style={[ui.card, tone === 'warm' && ui.warm, tone === 'mint' && ui.mint]}>{children}</View>;
}
export function Button({ label, onPress, secondary = false, busy = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; busy?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondaryButton, (disabled || busy) && ui.disabled, pressed && ui.pressed]}>
    {busy ? <ActivityIndicator color={secondary ? colors.navy : colors.white} /> : <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{label}</Text>}
  </Pressable>;
}
export function ActionRow({ title, description, image, to, onPress }: { title: string; description?: string; image?: ImageSourcePropType; to?: Href; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={description ? `${title}. ${description}` : title} onPress={onPress ?? (() => { if (to) router.push(to); })} style={({ pressed }) => [ui.actionRow, pressed && ui.pressed]}>
    {image ? <View style={ui.iconWrap}><Image accessible={false} source={image} resizeMode="contain" style={ui.icon} /></View> : null}
    <View style={ui.flex}><Text style={ui.rowTitle}>{title}</Text>{description ? <Text style={ui.description}>{description}</Text> : null}</View>
    <Text accessible={false} style={ui.chevron}>›</Text>
  </Pressable>;
}
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[ui.chip, selected && ui.chipSelected]}><Text style={[ui.chipText, selected && ui.chipTextSelected]}>{label}</Text></Pressable>;
}
export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <Card><Text accessibilityRole="alert" style={ui.body}>{message}</Text><Button label="Попробовать снова" secondary onPress={retry} /></Card>;
}

export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F3' },
  content: { padding: 20, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 680, alignSelf: 'center' },
  heading: { gap: 8 }, brand: { color: colors.teal, fontSize: 16, fontWeight: '700' },
  title: { color: colors.navyDeep, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.7 },
  section: { gap: 12 }, sectionTitle: { color: colors.navyDeep, fontSize: 20, lineHeight: 27, fontWeight: '700' },
  body: { color: '#52656C', fontSize: 16, lineHeight: 24 },
  caption: { color: '#52656C', fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 22, borderWidth: 1, borderColor: '#E0E7E1', backgroundColor: colors.white, padding: 18, gap: 14 },
  warm: { backgroundColor: '#FFF4DB', borderColor: '#F1DDB0' }, mint: { backgroundColor: '#E6F1EB', borderColor: '#CFDFD6' },
  rowTitle: { color: colors.navyDeep, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  description: { color: '#52656C', fontSize: 14, lineHeight: 21, marginTop: 3 },
  button: { minHeight: 52, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.navyDeep, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: '#E8EFEB' }, secondaryText: { color: colors.navyDeep },
  smallButton: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }, link: { color: colors.teal, fontSize: 15, fontWeight: '700' },
  actionRow: { minHeight: 80, borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E0E7E1' },
  iconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#F4F3EA', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 40, height: 40 }, chevron: { fontSize: 26, color: colors.teal },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 }, stack: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 46, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.white, borderWidth: 1, borderColor: '#D5DFD8', justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.navyDeep, borderColor: colors.navyDeep },
  chipText: { color: colors.navyDeep, fontSize: 15, fontWeight: '600' }, chipTextSelected: { color: colors.white },
  input: { minHeight: 54, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#CAD7CD', backgroundColor: colors.white, color: colors.text, fontSize: 17 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: '#E0E7E1' }, loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.5 }, pressed: { opacity: 0.75 },
});
