import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useFamily } from '../../context/FamilyContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { colors } from '../../theme';

const TabEmoji = ({ symbol, color }: { symbol: string; color: ColorValue }) => (
  <Text style={{ fontSize: 18, color }}>{symbol}</Text>
);

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  if (authLoading || (session && familyLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.navy} />
      </View>
    );
  }

  if (isSupabaseConfigured && !session) {
    return <Redirect href="/sign-in" />;
  }

  if (isSupabaseConfigured && session && !family) {
    return <Redirect href="/team-setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: colors.paper,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => <TabEmoji symbol="⌂" color={color} />,
        }}
      />
      <Tabs.Screen
        name="development"
        options={{
          title: 'Развитие',
          tabBarIcon: ({ color }) => <TabEmoji symbol="◈" color={color} />,
        }}
      />
      <Tabs.Screen
        name="together"
        options={{
          title: 'Вместе',
          tabBarIcon: ({ color }) => <TabEmoji symbol="✦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'История',
          tabBarIcon: ({ color }) => <TabEmoji symbol="▤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="us"
        options={{
          title: 'Мы',
          tabBarIcon: ({ color }) => <TabEmoji symbol="●" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
});
