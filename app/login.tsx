import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { login, loginWithGoogle } = useApp();
  const userRole = (role as 'customer' | 'restaurant') || 'customer';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email'); return; }
    if (!password.trim()) { setError('Please enter your password'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email'); return; }

    setLoading(true);
    setTimeout(() => {
      const success = login(email, password, userRole);
      setLoading(false);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 600);
  };

  const handleGoogleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loginWithGoogle(userRole);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.roleBadge, { backgroundColor: userRole === 'customer' ? theme.primaryFaint : '#EDE9FE' }]}>
              <MaterialIcons
                name={userRole === 'customer' ? 'person' : 'storefront'}
                size={16}
                color={userRole === 'customer' ? theme.primary : '#7C3AED'}
              />
              <Text style={[styles.roleText, { color: userRole === 'customer' ? theme.primary : '#7C3AED' }]}>
                {userRole === 'customer' ? 'Customer' : 'Restaurant'}
              </Text>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your SwiftChop account</Text>
          </View>

          {/* Google */}
          <PrimaryButton
            label="Continue with Google"
            onPress={handleGoogleLogin}
            variant="google"
            icon={<Ionicons name="logo-google" size={20} color="#EA4335" />}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={theme.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable style={{ alignSelf: 'flex-end', marginBottom: 24 }}>
            <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>Forgot password?</Text>
          </Pressable>

          {/* Login button */}
          <PrimaryButton label="Sign In" onPress={handleLogin} loading={loading} variant="dark" />

          {/* Sign up link */}
          <Pressable
            onPress={() => router.push({ pathname: '/signup', params: { role: userRole } })}
            style={{ marginTop: 20, alignSelf: 'center' }}
          >
            <Text style={styles.switchText}>
              Don't have an account? <Text style={{ color: theme.primary, fontWeight: '600' }}>Sign up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scroll: { paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  header: { marginTop: 28, marginBottom: 32 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, gap: 6 },
  roleText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: theme.textSecondary },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
  dividerText: { fontSize: 13, color: theme.textMuted },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.errorLight, padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { fontSize: 13, color: theme.error, flex: 1 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: theme.backgroundSecondary },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  switchText: { fontSize: 14, color: theme.textSecondary },
});
