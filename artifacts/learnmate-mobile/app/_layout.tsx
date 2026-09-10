import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';
import { getApiBase } from '@/lib/api';

// Set API base URL at module level – runs before any component mounts.
// getApiBase() honours EXPO_PUBLIC_API_URL (EAS/production) first,
// then falls back to EXPO_PUBLIC_DOMAIN (Expo Go / Metro web dev).
setBaseUrl(getApiBase());

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthSetup({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Wire Clerk token into the shared API fetch client.
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Redirect to sign-in if unauthenticated.
  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === 'sign-in';
    if (!isSignedIn && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/');
    }
  }, [isSignedIn, isLoaded, segments, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen
        name="courses/[slug]"
        options={{ headerShown: true, headerTransparent: false, title: '' }}
      />
      <Stack.Screen
        name="lesson/[slug]/[index]"
        options={{ headerShown: true, headerTransparent: false, title: '' }}
      />
      <Stack.Screen
        name="notes/[id]"
        options={{ headerShown: true, headerTransparent: false, title: '' }}
      />
      <Stack.Screen
        name="notes/smart"
        options={{ headerShown: true, title: 'Smart Notes' }}
      />
      <Stack.Screen
        name="focus"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="premium"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen
        name="quiz"
        options={{ headerShown: true, title: 'Practice Quiz' }}
      />
      <Stack.Screen
        name="study-plans"
        options={{ headerShown: true, title: 'Study Plans' }}
      />
      <Stack.Screen
        name="language"
        options={{ headerShown: true, title: 'Language Practice' }}
      />
      <Stack.Screen
        name="exams"
        options={{ headerShown: true, title: 'Exams' }}
      />
      <Stack.Screen
        name="progress"
        options={{ headerShown: true, title: 'Your Progress' }}
      />
      <Stack.Screen
        name="flashcards/index"
        options={{ headerShown: true, title: 'Flashcards' }}
      />
      <Stack.Screen
        name="flashcards/[deckId]"
        options={{ headerShown: true, title: '' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AuthSetup>
                    <RootLayoutNav />
                  </AuthSetup>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
