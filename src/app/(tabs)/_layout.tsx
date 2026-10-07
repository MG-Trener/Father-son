import { Redirect, Tabs } from 'expo-router';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandAssets } from '../../brandAssets';
import { TeamLoadingScene } from '../../components/TeamLoadingScene';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { colors } from '../../theme';

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth();
  const { family, me, loading: familyLoading } = useFamily();
  const insets = useSafeAreaInsets();
  if (authLoading || (session && familyLoading)) return <TeamLoadingScene topInset={insets.top} bottomInset={insets.bottom} />;
  if (isSupabaseConfigured && !session) return <Redirect href="/sign-in" />;
  if (isSupabaseConfigured && session && !family) return <Redirect href="/team-setup" />;
  if (isSupabaseConfigured && session && me && !me.onboarding_completed_at) return <Redirect href="/onboarding" />;
  const items = [
    { name: 'index', title: 'Сегодня', image: brandAssets.navigation.home },
    { name: 'together', title: 'Вместе', image: brandAssets.navigation.together },
    { name: 'development', title: 'Развитие', image: brandAssets.navigation.growth },
    { name: 'yearbook', title: 'Память', image: brandAssets.navigation.book },
  ];
  return <Tabs tabBar={() => null} backBehavior="history" screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.navyDeep, tabBarInactiveTintColor: '#596C72', tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#DDE5DF', height: 68 + Math.max(insets.bottom, 8), paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 3 } }}>
    {items.map(item => <Tabs.Screen key={item.name} name={item.name} options={{ title: item.title, tabBarAccessibilityLabel: item.title, tabBarIcon: ({ focused }) => <View style={{ width: 54, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: focused ? '#E2EEE6' : 'transparent' }}><Image accessible={false} source={item.image} resizeMode="contain" style={{ width: 29, height: 29 }} /></View> }} />)}
    <Tabs.Screen name="us" options={{ href: null }} />
    <Tabs.Screen name="history" options={{ href: null }} />
  </Tabs>;
}
