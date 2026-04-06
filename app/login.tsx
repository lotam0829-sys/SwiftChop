import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { getImage } from '../constants/images';
import { useAuth, useAlert } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useApp } from '../contexts/AppContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { user, signInWithPassword, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { refreshProfile } = useApp();
  const userRole = (role as 'customer' | 'restaurant' | 'rider') || 'customer';
  const roleLabel = userRole === 'rider' ? 'Dispatch Rider' : userRole === 'restaurant' ? 'Restaurant' : 'Customer';
  const roleIcon = userRole === 'rider' ? 'delivery-dining' : userRole === 'restaurant' ? 'storefront' : 'person';
  const roleColor = userRole === 'rider' ? '#059669' : userRole === 'restaurant' ? '#7C3AED' : theme.primary;
  const roleBg = userRole === 'rider' ? '#ECFDF5' : userRole === 'restaurant' ? '#EDE9FE' : theme.primaryFaint;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const prevUserId = useRef<string | null>(null);

  // Detect Google Sign-In completion
  useEffect(() => {
    if (!googleAuthPending || !user?.id || user.id === prevUserId.current) return;

    const handlePostGoogleAuth = async () => {
      try {
        setSettingUp(true);
        const createdAt = user.created_at ? new Date(user.created_at) : null;
        const now = new Date();
        const isNewUser = createdAt && (now.getTime() - createdAt.getTime()) < 120000;

        if (isNewUser) {
          // New user → route to onboarding with chosen role
          router.replace({ pathname: '/onboarding', params: { role: userRole } });
        } else {
          // Existing user → refresh and let layout routing handle
          await refreshProfile();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        console.error('Post-Google auth error:', err);
      } finally {
        setGoogleAuthPending(false);
        setSettingUp(false);
      }
    };

    handlePostGoogleAuth();
  }, [user?.id, googleAuthPending]);

  useEffect(() => {
    prevUserId.current = user?.id || null;
  }, [user?.id]);

  const handleGoogleSignIn = async () => {
    setGoogleAuthPending(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleAuthPending(false);
      showAlert('Google Sign-In Failed', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) { showAlert('Error', 'Please enter your email'); return; }
    if (!password.trim()) { showAlert('Error', 'Please enter your password'); return; }
    if (!email.includes('@')) { showAlert('Error', 'Please enter a valid email'); return; }

    const { error } = await signInWithPassword(email, password);
    if (error) {
      showAlert('Login Failed', error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const isProcessing = operationLoading || settingUp;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>

          <View style={styles.header}>
            <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
              <MaterialIcons name={roleIcon as any} size={16} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
            <Image
              source={getImage('logo')}
              style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }}
              contentFit="cover"
            />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your SwiftChop account</Text>
          </View>

          <Pressable onPress={handleGoogleSignIn} style={styles.googleBtn} disabled={isProcessing}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign in with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email address</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Enter your password" placeholderTextColor={theme.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={{ height: 24 }} />
          <PrimaryButton label={settingUp ? 'Signing in...' : 'Sign In'} onPress={handleLogin} loading={isProcessing} variant="dark" />

          <Pressable onPress={() => router.push({ pathname: '/signup', params: { role: userRole } })} style={{ marginTop: 20, alignSelf: 'center' }}>
            <Text style={styles.switchText}>
              {"Don't have an account? "}<Text style={{ color: theme.primary, fontWeight: '600' }}>Sign up</Text>
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
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: theme.backgroundSecondary },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  switchText: { fontSize: 14, color: theme.textSecondary },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, backgroundColor: '#FFF', marginBottom: 4 },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
});
