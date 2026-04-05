import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertProvider, AuthProvider, useAuth } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../contexts/AppContext';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../constants/theme';

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { userProfile } = useApp();
  const segments = useSegments();
  const router = useRouter();

  const isAuthenticated = !!user;
  const isLoading = authLoading;

  useEffect(() => {
    if (isLoading) return;

    const first = segments[0] as string;
    const isAuthScreen = ['welcome', 'login', 'signup'].includes(first);
    const isPending = first === 'pending-approval';

    if (!isAuthenticated && !isAuthScreen) {
      router.replace('/welcome');
      return;
    }

    if (isAuthenticated && isAuthScreen) {
      if (userProfile?.role === 'restaurant') {
        router.replace(userProfile.is_approved ? '/(restaurant)' : '/pending-approval');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    if (isAuthenticated && isPending && userProfile?.role === 'restaurant' && userProfile.is_approved) {
      router.replace('/(restaurant)');
    }
  }, [isLoading, isAuthenticated, userProfile?.is_approved, userProfile?.role, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundDark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(restaurant)" />
        <Stack.Screen name="restaurant/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cart" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="order-tracking" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="restaurant-account" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: 'Account Settings', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-support" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: 'Help & Support', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <AppProvider>
            <RootNavigator />
          </AppProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
