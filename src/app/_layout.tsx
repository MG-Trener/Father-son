import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AppUpdateGate } from '../components/AppUpdateGate';
import { PushNotificationsBridge } from '../components/PushNotificationsBridge';
import { AuthProvider } from '../context/AuthContext';
import { FamilyProvider } from '../context/FamilyContext';
import { colors } from '../theme';

SplashScreen.setOptions({
  duration: 650,
  fade: true,
});

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <FamilyProvider>
          <PushNotificationsBridge />
          <AppUpdateGate />
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.sand },
            }}
          />
        </FamilyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
