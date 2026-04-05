import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { signup, loginWithGoogle } = useApp();
  const userRole = (role as 'customer' | 'restaurant') || 'customer';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = () => {
    setError('');
    if (!name.trim()) { setError('Please enter your full name'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email'); return; }
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (userRole === 'restaurant' && !restaurantName.trim()) { setError('Please enter your restaurant name'); return; }

    setLoading(true);
    setTimeout(() => {
      const success = signup({ name, email, phone, password, role: userRole, restaurantName: restaurantName || undefined });
      setLoading(false);
      if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 600);
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
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              {userRole === 'customer' ? 'Start ordering delicious meals' : 'Partner with SwiftChop to grow your business'}
            </Text>
          </View>

          <PrimaryButton
            label="Continue with Google"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); loginWithGoogle(userRole); }}
            variant="google"
            icon={<Ionicons name="logo-google" size={20} color="#EA4335" />}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={16} color={theme.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full name</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={styles.input} placeholder="e.g. Adaeze Okonkwo" placeholderTextColor={theme.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          </View>

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

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone number</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="phone" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
              <TextInput style={styles.input} placeholder="+234 800 000 0000" placeholderTextColor={theme.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
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

          <View style={{ height: 8 }} />
          <PrimaryButton label="Create Account" onPress={handleSignup} loading={loading} variant="dark" />

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
