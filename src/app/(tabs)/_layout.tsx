import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../theme';

const TabEmoji = ({ symbol, color }: { symbol: string; color: string }) => (
  <Text style={{ fontSize: 18, color }}>{symbol}</Text>
);

export default function TabsLayout() {
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
