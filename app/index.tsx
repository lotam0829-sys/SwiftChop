import { Redirect } from 'expo-router';
import { useAuth } from '@/template';
import { useApp } from '../contexts/AppContext';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../constants/theme';

export default function RootScreen() {
  const { user, loading } = useAuth();
  const { userProfile } = useApp();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundDark, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/welcome" />;
  }

  if (userProfile?.role === 'restaurant') {
    return <Redirect href={userProfile.is_approved ? '/(restaurant)' : '/pending-approval'} />;
  }

  return <Redirect href="/(tabs)" />;
}
