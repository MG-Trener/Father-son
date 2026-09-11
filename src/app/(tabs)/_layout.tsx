import { useEffect, useRef } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TeamLoadingScene } from '../../components/TeamLoadingScene';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { colors, shadows } from '../../theme';

type TabGlyphProps = {
  symbol: string;
  focused: boolean;
  accent?: string;
  prominent?: boolean;
};

const TabGlyph = ({ symbol, focused, accent = colors.navy, prominent = false }: TabGlyphProps) => {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: focused ? 7 : 2,
    }).start();
  }, [focused, progress]);

  return (
    <Animated.View
      style={{
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, prominent ? -8 : -4] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, prominent ? 1.08 : 1.04] }) },
        ],
      }}
    >
      <View style={[
        styles.glyph,
        prominent && styles.glyphProminent,
        focused && { backgroundColor: accent, borderColor: accent },
      ]}>
        <Text style={[styles.glyphText, prominent && styles.glyphTextProminent, focused && styles.glyphTextFocused]}>{symbol}</Text>
      </View>
      {focused ? <View style={[styles.activeDot, { backgroundColor: accent }]} /> : null}
    </Animated.View>
  );
};

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth();
  const { family, me, loading: familyLoading } = useFamily();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const isChild = me?.role === 'child';

  if (authLoading || (session && familyLoading)) {
    return <TeamLoadingScene topInset={insets.top} bottomInset={insets.bottom} />;
  }

  if (isSupabaseConfigured && !session) return <Redirect href="/sign-in" />;
  if (isSupabaseConfigured && session && !family) return <Redirect href="/team-setup" />;
  if (isSupabaseConfigured && session && family && me && !me.onboarding_completed_at) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navyDeep,
        tabBarInactiveTintColor: '#89989A',
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          shadows.soft,
          {
            height: 72 + bottomInset,
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
          title: isChild ? 'Мой путь' : 'Развитие',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="↗" focused={focused} accent={isChild ? colors.orange : colors.green} />,
        }}
      />
      <Tabs.Screen
        name="together"
        options={{
          title: 'Вместе',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="♥" focused={focused} accent={colors.amber} prominent />,
        }}
      />
      <Tabs.Screen
        name="yearbook"
        options={{
          title: 'Книга',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="▤" focused={focused} accent={colors.blue} />,
        }}
      />
      <Tabs.Screen
        name="us"
        options={{
          title: isChild ? 'Команда' : 'Мы',
          tabBarIcon: ({ focused }) => <TabGlyph symbol="●" focused={focused} accent={colors.tealBright} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ href: null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 8,
    backgroundColor: '#FFFDF9',
    borderTopWidth: 1,
    borderTopColor: '#EEE7DB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'visible',
  },
  tabBarItem: { paddingTop: 1 },
  tabLabel: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  glyph: {
    width: 40,
    height: 35,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E3DA',
    backgroundColor: '#F6F1E8',
  },
  glyphProminent: {
    width: 52,
    height: 44,
    borderRadius: 17,
    marginTop: -5,
    backgroundColor: '#FFF0CB',
    borderColor: '#F3D89B',
  },
  glyphText: { color: '#728487', fontSize: 17, fontWeight: '900' },
  glyphTextProminent: { fontSize: 20, color: '#A7751E' },
  glyphTextFocused: { color: colors.white },
  activeDot: { width: 4, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 3 },
});
