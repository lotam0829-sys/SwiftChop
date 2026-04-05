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
    const isOnboarding = first === 'onboarding';
    const isPending = first === 'pending-approval';

    if (!isAuthenticated && !isAuthScreen) {
      router.replace('/welcome');
      return;
    }

    if (isAuthenticated && isOnboarding) {
      return;
    }

    if (isAuthenticated && isAuthScreen) {
      if (!userProfile) return;

      if (userProfile.role === 'restaurant') {
        router.replace(userProfile.is_approved ? '/(restaurant)' : '/pending-approval');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    if (isAuthenticated && isPending && userProfile?.role === 'restaurant' && userProfile.is_approved) {
      router.replace('/(restaurant)');
    }
  }, [isLoading, isAuthenticated, userProfile?.role, userProfile?.is_approved, segments]);

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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(restaurant)" />
        <Stack.Screen name="restaurant/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cart" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="order-tracking" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pending-approval" />
        <Stack.Screen name="restaurant-account" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-support" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-contact" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-help" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-terms" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-hours" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-delivery" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-photos" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-bank" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="restaurant-notifications" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#FFF', headerStyle: { backgroundColor: '#0D0D0D' } }} />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="delivery-addresses" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="payment-methods" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="notifications-settings" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="help-support" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="about" options={{ animation: 'slide_from_right', headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: theme.textPrimary, headerStyle: { backgroundColor: '#FFF' } }} />
        <Stack.Screen name="review" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
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
