import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import AuthExpiredGate from '@/components/AuthExpiredGate';
import { emitAppRefresh } from '@/src/appRefresh';
import { LanguageProvider } from '@/src/i18n/context';
import { LogLevel, OneSignal, isOneSignalReady } from '@/src/onesignal';

const ONESIGNAL_APP_ID = '6668062b-2997-4d9c-98e8-47fea40b21b1';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOneSignalReady() || !OneSignal || !LogLevel) {
      console.warn('OneSignal: native module not ready');
      return;
    }

    OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(ONESIGNAL_APP_ID);

    // Android 13+ needs runtime notification permission for push subscription
    OneSignal.Notifications.requestPermission(true).then((accepted) => {
      console.log('OneSignal: permission accepted =', accepted);
    });

    const onClick = (event: unknown) => {
      console.log('OneSignal: notification clicked:', event);
      emitAppRefresh();
      // Bring user into the main app and force screens to reload data
      try {
        router.replace('/(tabs)' as any);
      } catch {
        // Router may not be ready on cold start; refresh listeners still run
      }
    };

    OneSignal.Notifications.addEventListener('click', onClick);

    if (__DEV__) {
      console.log('OneSignal: initialized on', Platform.OS);
    }

    return () => {
      OneSignal?.Notifications.removeEventListener('click', onClick);
    };
  }, [router]);

  return (
    <LanguageProvider>
      <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="otp" options={{ headerShown: false }} />
        <Stack.Screen name="pending-approval" options={{ headerShown: false }} />
        <Stack.Screen name="forgot" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
      </Stack>
      <AuthExpiredGate />
      <StatusBar style="auto" />
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
