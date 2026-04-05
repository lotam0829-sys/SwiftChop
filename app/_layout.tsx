import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '../contexts/AppContext';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../constants/theme';

function RootNavigator() {
  const { isLoading, isAuthenticated, user } = useApp();
  const segments = useSegments();
  const router = useRouter();

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
      if (user?.role === 'customer') {
        router.replace('/(tabs)');
      } else if (user?.role === 'restaurant') {
        router.replace(user.isApproved ? '/(restaurant)' : '/pending-approval');
      }
      return;
    }

    if (isAuthenticated && isPending && user?.role === 'restaurant' && user.isApproved) {
      router.replace('/(restaurant)');
    }
  }, [isLoading, isAuthenticated, user?.isApproved, segments]);

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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
