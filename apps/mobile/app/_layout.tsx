import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuthStore } from '../stores/authStore';
import { BiometricLock } from '../components/BiometricLock';
import { useNotificationDeepLink } from '../hooks/useNotificationDeepLink';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadTokens } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadTokens();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const isPublicDeepLink = segments[0] === 'join-group' || segments[0] === 'invite';

    if (!isAuthenticated && !inAuth && !isPublicDeepLink) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) return <LoadingScreen />;

  return <>{children}</>;
}

function AppShell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useNotificationDeepLink();

  return (
    <BiometricLock isAuthenticated={isAuthenticated}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="group" />
        <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="select-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join-group" options={{ presentation: 'modal' }} />
        <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settle-up" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="notifications" />
              <Stack.Screen name="reports" />
              <Stack.Screen name="privacy-policy" />
      </Stack>
    </BiometricLock>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // On web, fonts may never report loaded — render anyway after error or on web platform.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ToastProvider>
                <AuthGate>
                  <AppShell />
                </AuthGate>
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
