import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAuth, useAlert } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { sendOTP, verifyOTPAndLogin, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const userRole = (role as 'customer' | 'restaurant') || 'customer';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [restaurantName, setRestaurantName] = useState('');

  const handleSendOTP = async () => {
    if (!email.trim() || !email.includes('@')) { showAlert('Error', 'Please enter a valid email'); return; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return; }
    if (userRole === 'restaurant' && !restaurantName.trim()) { showAlert('Error', 'Please enter your restaurant name'); return; }

    const { error } = await sendOTP(email);
    if (error) {
      showAlert('Error', error);
    } else {
      setOtpSent(true);
      showAlert('Code Sent', 'A verification code has been sent to your email');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) { showAlert('Error', 'Please enter the verification code'); return; }

    const metadata: Record<string, string> = { role: userRole };
    if (userRole === 'restaurant') metadata.restaurant_name = restaurantName;

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Verification Failed', error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Root navigator handles redirect based on role
    }
  };

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
                {userRole === 'customer' ? 'Customer' : 'Restaurant'}
              </Text>
            </View>
            <Text style={styles.title}>{otpSent ? 'Verify your email' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>
              {otpSent
                ? `Enter the 4-digit code sent to ${email}`
                : userRole === 'customer' ? 'Start ordering delicious meals' : 'Partner with SwiftChop to grow your business'}
            </Text>
          </View>

          {!otpSent ? (
            <>
              {/* Restaurant name */}
              {userRole === 'restaurant' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Restaurant name</Text>
                  <View style={styles.inputWrap}>
                    <MaterialIcons name="storefront" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                    <TextInput style={styles.input} placeholder="e.g. Mama's Kitchen" placeholderTextColor={theme.textMuted} value={restaurantName} onChangeText={setRestaurantName} />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email address</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="email" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={theme.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
              </View>

              {/* Password */}
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

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="lock" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Re-enter password" placeholderTextColor={theme.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
                </View>
              </View>

              <View style={{ height: 8 }} />
              <PrimaryButton label="Send Verification Code" onPress={handleSendOTP} loading={operationLoading} variant="dark" />
            </>
          ) : (
            <>
              {/* OTP Input */}
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
              <PrimaryButton label="Verify & Create Account" onPress={handleVerifyOTP} loading={operationLoading} variant="dark" />

              <Pressable onPress={() => { setOtpSent(false); setOtp(''); }} style={{ marginTop: 16, alignSelf: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '600' }}>Resend Code</Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={() => router.push({ pathname: '/login', params: { role: userRole } })} style={{ marginTop: 20, alignSelf: 'center' }}>
            <Text style={styles.switchText}>Already have an account? <Text style={{ color: theme.primary, fontWeight: '600' }}>Log in</Text></Text>
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
  header: { marginTop: 24, marginBottom: 28 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, gap: 6 },
  roleText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 15, color: theme.textSecondary, lineHeight: 22 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: theme.backgroundSecondary },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  switchText: { fontSize: 14, color: theme.textSecondary },
});
