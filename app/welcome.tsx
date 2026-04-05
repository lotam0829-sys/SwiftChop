import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleRole = (role: 'customer' | 'restaurant') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/login', params: { role } });
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/hero-jollof.jpg')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.35, 0.65]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <MaterialIcons name="bolt" size={22} color="#FFF" />
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Brand */}
        <Text style={styles.brand}>Swift<Text style={{ color: theme.primary }}>Chop</Text></Text>
        <Text style={styles.tagline}>Fast food delivery across Nigeria.{'\n'}From your favourite restaurants to your door.</Text>

        {/* Role buttons */}
        <View style={styles.buttons}>
          <PrimaryButton
            label="I'm hungry — Order food"
            onPress={() => handleRole('customer')}
            variant="primary"
            icon={<MaterialIcons name="restaurant" size={20} color="#FFF" />}
          />
          <PrimaryButton
            label="I'm a restaurant — Partner with us"
            onPress={() => handleRole('restaurant')}
            variant="outline"
            icon={<MaterialIcons name="storefront" size={20} color={theme.primary} />}
            style={{ borderColor: 'rgba(255,107,0,0.6)' }}
          />
        </View>

        <Pressable onPress={() => router.push({ pathname: '/login', params: { role: 'customer' } })}>
          <Text style={styles.loginLink}>Already have an account? <Text style={{ color: theme.primary, fontWeight: '600' }}>Log in</Text></Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'flex-end' },
  logoRow: { flexDirection: 'row' },
  logoBadge: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 42, fontWeight: '800', color: '#FFF', marginBottom: 8 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 24, marginBottom: 36 },
  buttons: { gap: 14, marginBottom: 20 },
  loginLink: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingVertical: 8 },
});
