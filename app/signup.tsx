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
import { updateUserProfile, createRestaurantForOwner } from '../services/supabaseData';
import { useApp } from '../contexts/AppContext';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { user, sendOTP, verifyOTPAndLogin, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { refreshProfile } = useApp();
  const userRole = (role as 'customer' | 'restaurant') || 'customer';

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [settingUpProfile, setSettingUpProfile] = useState(false);
  const [googleAuthPending, setGoogleAuthPending] = useState(false);
  const prevUserId = useRef<string | null>(null);

  // Detect Google Sign-In completion → route to onboarding
  useEffect(() => {
    if (!googleAuthPending || !user?.id || user.id === prevUserId.current) return;

    const handlePostGoogleAuth = async () => {
      try {
        setSettingUpProfile(true);
        // Always route to onboarding for Google signup
        router.replace({ pathname: '/onboarding', params: { role: userRole } });
      } catch (err) {
        console.error('Post-Google signup error:', err);
        showAlert('Error', 'Failed to set up your profile.');
      } finally {
        setSettingUpProfile(false);
        setGoogleAuthPending(false);
      }
    };

    handlePostGoogleAuth();
  }, [user?.id, googleAuthPending]);

  useEffect(() => {
    prevUserId.current = user?.id || null;
  }, [user?.id]);

  const validateCredentials = (): boolean => {
    if (!email.trim() || !email.includes('@')) { showAlert('Error', 'Please enter a valid email'); return false; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return false; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return false; }
    return true;
  };

  const handleSendOTP = async () => {
    if (!validateCredentials()) return;
    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
    } else {
      setStep('otp');
      showAlert('Code Sent', 'A verification code has been sent to your email');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) { showAlert('Error', 'Please enter the verification code'); return; }

    const { error, user: newUser } = await verifyOTPAndLogin(email, otp, { password });
    if (error) { showAlert('Verification Failed', error); return; }
    if (!newUser?.id) { showAlert('Error', 'Account creation failed.'); return; }

    // Set role IMMEDIATELY, then route to onboarding for full setup
    setSettingUpProfile(true);
    try {
      await updateUserProfile(newUser.id, {
        role: userRole,
        is_approved: userRole === 'customer',
      } as any);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Route to onboarding for both roles
      router.replace({ pathname: '/onboarding', params: { role: userRole } });
    } catch (err) {
      console.error('Profile setup error:', err);
      showAlert('Error', 'Failed to set up profile.');
    } finally {
      setSettingUpProfile(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleAuthPending(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleAuthPending(false);
      showAlert('Google Sign-In Failed', error);
    }
  };

  const isProcessing = operationLoading || settingUpProfile;

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
            <View style={[styles.roleBadge, { backgroundColor: userRole === 'customer' ? theme.primaryFaint : '#EDE9FE' }]}>
              <MaterialIcons
                name={userRole === 'customer' ? 'person' : 'storefront'}
                size={16}
                color={userRole === 'customer' ? theme.primary : '#7C3AED'}
              />
              <Text style={[styles.roleText, { color: userRole === 'customer' ? theme.primary : '#7C3AED' }]}>
                {userRole === 'customer' ? 'Customer' : 'Restaurant Partner'}
              </Text>
            </View>
            <Image
              source={getImage('logo')}
              style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }}
              contentFit="cover"
            />
            <Text style={styles.title}>{step === 'otp' ? 'Verify your email' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>
              {step === 'otp'
                ? `Enter the 4-digit code sent to ${email}`
                : userRole === 'customer' ? 'Start ordering delicious meals' : 'Partner with SwiftChop to grow your business'}
            </Text>
          </View>

          {step === 'credentials' ? (
            <>
              <Pressable onPress={handleGoogleSignIn} style={styles.googleBtn} disabled={isProcessing}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with email</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email address</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="email" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor={theme.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <Pressable onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Re-enter password" placeholderTextColor={theme.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
                </View>
              </View>

              <View style={{ height: 8 }} />
              <PrimaryButton label="Send Verification Code" onPress={handleSendOTP} loading={isProcessing} variant="dark" />
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="pin" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { letterSpacing: 8, fontSize: 22, fontWeight: '700', textAlign: 'center' }]}
                    placeholder="0000"
                    placeholderTextColor={theme.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                  />
                </View>
              </View>

              <View style={{ height: 8 }} />
              <PrimaryButton
                label={settingUpProfile ? 'Setting up...' : 'Verify & Create Account'}
                onPress={handleVerifyOTP}
                loading={isProcessing}
                variant="dark"
              />

              <Pressable onPress={() => { setStep('credentials'); setOtp(''); }} style={{ marginTop: 16, alignSelf: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '600' }}>Go Back</Text>
              </Pressable>

              <Pressable onPress={handleSendOTP} style={{ marginTop: 8, alignSelf: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Resend Code</Text>
              </Pressable>
            </>
          )}

          {step === 'credentials' ? (
            <Pressable onPress={() => router.push({ pathname: '/login', params: { role: userRole } })} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={styles.switchText}>Already have an account? <Text style={{ color: theme.primary, fontWeight: '600' }}>Log in</Text></Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scroll: { paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  header: { marginTop: 24, marginBottom: 24 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, gap: 6 },
  roleText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: theme.textSecondary, lineHeight: 22 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
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
