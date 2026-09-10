import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { colors, radius, shadows } from '../../theme';

type TabGlyphProps = {
  symbol: string;
  focused: boolean;
  accent?: string;
  prominent?: boolean;
};

const TabGlyph = ({ symbol, focused, accent = colors.navy, prominent = false }: TabGlyphProps) => (
  <View
    style={[
      styles.glyph,
      prominent && styles.glyphProminent,
      focused && { backgroundColor: accent, borderColor: accent },
      focused && styles.glyphFocused,
    ]}
  >
    <Text style={[styles.glyphText, prominent && styles.glyphTextProminent, focused && styles.glyphTextFocused]}>{symbol}</Text>
  </View>
);

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth();
  const { family, loading: familyLoading } = useFamily();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  if (authLoading || (session && familyLoading)) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  if (isSupabaseConfigured && !session) return <Redirect href="/sign-in" />;
  if (isSupabaseConfigured && session && !family) return <Redirect href="/team-setup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navyDeep,
        tabBarInactiveTintColor: colors.mutedSoft,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          shadows.soft,
          {
            height: 70 + bottomInset,
            paddingBottom: bottomInset,
          },
        ],
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="⌂" focused={focused} accent={colors.navy} />,
        }}
      />
      <Tabs.Screen
        name="development"
        options={{
          title: 'Развитие',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="◇" focused={focused} accent={colors.purple} />,
        }}
      />
      <Tabs.Screen
        name="together"
        options={{
          title: 'Вместе',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="✦" focused={focused} accent={colors.orange} prominent />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'История',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="≋" focused={focused} accent={colors.blue} />,
        }}
      />
      <Tabs.Screen
        name="us"
        options={{
          title: 'Мы',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="●" focused={focused} accent={colors.green} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  tabBar: {
    paddingTop: 8,
    backgroundColor: colors.paper,
    borderTopWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'visible',
  },
  tabBarItem: { paddingTop: 1 },
  tabLabel: { fontSize: 9, fontWeight: '900', marginTop: 1 },
  glyph: {
    width: 39,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sand,
  },
  glyphProminent: { width: 47, height: 38, marginTop: -5 },
  glyphFocused: { transform: [{ translateY: -2 }] },
  glyphText: { color: colors.muted, fontSize: 17, fontWeight: '900' },
  glyphTextProminent: { fontSize: 20 },
  glyphTextFocused: { color: colors.white },
});
