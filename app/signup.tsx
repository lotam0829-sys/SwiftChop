import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAuth, useAlert } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';
import { updateUserProfile, createRestaurantForOwner } from '../services/supabaseData';
import { useApp } from '../contexts/AppContext';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { sendOTP, verifyOTPAndLogin, signInWithGoogle, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { refreshProfile } = useApp();
  const userRole = (role as 'customer' | 'restaurant') || 'customer';

  // Step management for restaurant onboarding
  const [step, setStep] = useState<'credentials' | 'restaurant_details' | 'otp'>('credentials');

  // Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');

  // Restaurant details
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantCuisine, setRestaurantCuisine] = useState('');
  const [restaurantDescription, setRestaurantDescription] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('1200');
  const [minOrder, setMinOrder] = useState('2000');
  const [deliveryTime, setDeliveryTime] = useState('25-35 min');

  const [settingUpProfile, setSettingUpProfile] = useState(false);

  const validateCredentials = (): boolean => {
    if (!email.trim() || !email.includes('@')) { showAlert('Error', 'Please enter a valid email'); return false; }
    if (password.length < 6) { showAlert('Error', 'Password must be at least 6 characters'); return false; }
    if (password !== confirmPassword) { showAlert('Error', 'Passwords do not match'); return false; }
    return true;
  };

  const validateRestaurantDetails = (): boolean => {
    if (!restaurantName.trim()) { showAlert('Error', 'Please enter your restaurant name'); return false; }
    if (!restaurantAddress.trim()) { showAlert('Error', 'Please enter your restaurant address'); return false; }
    if (!restaurantCuisine.trim()) { showAlert('Error', 'Please enter your cuisine type'); return false; }
    if (!restaurantPhone.trim()) { showAlert('Error', 'Please enter a contact phone number'); return false; }
    return true;
  };

  const handleNext = () => {
    if (!validateCredentials()) return;
    if (userRole === 'restaurant') {
      setStep('restaurant_details');
    } else {
      handleSendOTP();
    }
  };

  const handleRestaurantNext = () => {
    if (!validateRestaurantDetails()) return;
    handleSendOTP();
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
    if (error) {
      showAlert('Verification Failed', error);
      return;
    }

    if (!newUser?.id) {
      showAlert('Error', 'Account creation failed. Please try again.');
      return;
    }

    // CRITICAL: Set the correct role BEFORE the context reads the profile.
    // The trigger creates with 'pending_role', so we must update immediately.
    setSettingUpProfile(true);
    try {
      const profileUpdates: Record<string, any> = { role: userRole };

      if (userRole === 'restaurant') {
        profileUpdates.restaurant_name = restaurantName.trim();
        profileUpdates.restaurant_address = restaurantAddress.trim();
        profileUpdates.restaurant_cuisine = restaurantCuisine.trim();
        profileUpdates.restaurant_description = restaurantDescription.trim() || `Welcome to ${restaurantName.trim()}`;
        profileUpdates.phone = restaurantPhone.trim();
        profileUpdates.restaurant_delivery_fee = parseInt(deliveryFee) || 1200;
        profileUpdates.restaurant_min_order = parseInt(minOrder) || 2000;
        profileUpdates.restaurant_delivery_time = deliveryTime.trim() || '25-35 min';
        profileUpdates.is_approved = false;
      } else {
        profileUpdates.is_approved = true;
      }

      // Update user_profiles with the REAL role
      await updateUserProfile(newUser.id, profileUpdates);

      // Create restaurant listing for restaurant owners
      if (userRole === 'restaurant' && restaurantName.trim()) {
        await createRestaurantForOwner(newUser.id, restaurantName.trim());
      }

      // Force context to re-read the updated profile so routing works correctly
      await refreshProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // RootNavigator will now see the correct role and route accordingly
    } catch (err) {
      console.error('Profile setup error:', err);
      showAlert('Error', 'Failed to set up profile. Please contact support.');
    } finally {
      setSettingUpProfile(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle();
    if (error) {
      showAlert('Google Sign-In Failed', error);
    }
  };

  const isProcessing = operationLoading || settingUpProfile;

  const renderCredentialsStep = () => (
    <>
      {/* Google Sign-In */}
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
      <PrimaryButton
        label={userRole === 'restaurant' ? 'Next: Restaurant Details' : 'Send Verification Code'}
        onPress={handleNext}
        loading={isProcessing}
        variant="dark"
      />
    </>
  );

  const renderRestaurantDetailsStep = () => (
    <>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.stepDotCompleted]} />
        <View style={[styles.stepLine, styles.stepLineCompleted]} />
        <View style={[styles.stepDot, styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={styles.stepDot} />
      </View>
      <Text style={styles.stepLabel}>Step 2 of 3: Restaurant Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Restaurant Name *</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="storefront" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={styles.input} placeholder="e.g. Mama Nkechi's Kitchen" placeholderTextColor={theme.textMuted} value={restaurantName} onChangeText={setRestaurantName} />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Restaurant Address *</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="location-on" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={styles.input} placeholder="12 Awolowo Rd, Ikoyi, Lagos" placeholderTextColor={theme.textMuted} value={restaurantAddress} onChangeText={setRestaurantAddress} />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cuisine Type *</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="restaurant-menu" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={styles.input} placeholder="e.g. Traditional Nigerian, Grilled, Fast Food" placeholderTextColor={theme.textMuted} value={restaurantCuisine} onChangeText={setRestaurantCuisine} />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Phone Number *</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="phone" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={styles.input} placeholder="+234 801 234 5678" placeholderTextColor={theme.textMuted} value={restaurantPhone} onChangeText={setRestaurantPhone} keyboardType="phone-pad" />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Description (optional)</Text>
        <View style={[styles.inputWrap, { height: 80, alignItems: 'flex-start', paddingVertical: 12 }]}>
          <MaterialIcons name="description" size={20} color={theme.textMuted} style={{ marginRight: 10, marginTop: 2 }} />
          <TextInput style={[styles.input, { textAlignVertical: 'top' }]} placeholder="Tell customers about your restaurant..." placeholderTextColor={theme.textMuted} value={restaurantDescription} onChangeText={setRestaurantDescription} multiline />
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Delivery Fee (₦)</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="1200" placeholderTextColor={theme.textMuted} value={deliveryFee} onChangeText={setDeliveryFee} keyboardType="number-pad" />
          </View>
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Min Order (₦)</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="2000" placeholderTextColor={theme.textMuted} value={minOrder} onChangeText={setMinOrder} keyboardType="number-pad" />
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Delivery Time</Text>
        <View style={styles.inputWrap}>
          <MaterialIcons name="schedule" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
          <TextInput style={styles.input} placeholder="25-35 min" placeholderTextColor={theme.textMuted} value={deliveryTime} onChangeText={setDeliveryTime} />
        </View>
      </View>

      <View style={{ height: 8 }} />
      <PrimaryButton label="Send Verification Code" onPress={handleRestaurantNext} loading={isProcessing} variant="dark" />
      <Pressable onPress={() => setStep('credentials')} style={{ marginTop: 14, alignSelf: 'center' }}>
        <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '600' }}>Back to credentials</Text>
      </Pressable>
    </>
  );

  const renderOTPStep = () => (
    <>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, styles.stepDotCompleted]} />
        <View style={[styles.stepLine, styles.stepLineCompleted]} />
        {userRole === 'restaurant' ? (
          <>
            <View style={[styles.stepDot, styles.stepDotCompleted]} />
            <View style={[styles.stepLine, styles.stepLineCompleted]} />
          </>
        ) : null}
        <View style={[styles.stepDot, styles.stepDotActive]} />
      </View>
      <Text style={styles.stepLabel}>Final Step: Verify Email</Text>

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
        label={settingUpProfile ? 'Setting up your account...' : 'Verify & Create Account'}
        onPress={handleVerifyOTP}
        loading={isProcessing}
        variant="dark"
      />

      <Pressable onPress={() => { setStep(userRole === 'restaurant' ? 'restaurant_details' : 'credentials'); setOtp(''); }} style={{ marginTop: 16, alignSelf: 'center' }}>
        <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '600' }}>Go Back</Text>
      </Pressable>

      <Pressable onPress={handleSendOTP} style={{ marginTop: 8, alignSelf: 'center' }}>
        <Text style={{ fontSize: 14, color: theme.textSecondary }}>Resend Code</Text>
      </Pressable>
    </>
  );

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
            <Text style={styles.title}>
              {step === 'otp' ? 'Verify your email' : step === 'restaurant_details' ? 'Restaurant Details' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'otp'
                ? `Enter the 4-digit code sent to ${email}`
                : step === 'restaurant_details'
                  ? 'Complete your restaurant profile to get started'
                  : userRole === 'customer' ? 'Start ordering delicious meals' : 'Partner with SwiftChop to grow your business'}
            </Text>
          </View>

          {step === 'credentials' ? renderCredentialsStep() : null}
          {step === 'restaurant_details' ? renderRestaurantDetailsStep() : null}
          {step === 'otp' ? renderOTPStep() : null}

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
  twoCol: { flexDirection: 'row', gap: 12 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 0 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.border },
  stepDotActive: { backgroundColor: theme.primary, width: 14, height: 14, borderRadius: 7 },
  stepDotCompleted: { backgroundColor: theme.success },
  stepLine: { width: 32, height: 2, backgroundColor: theme.border },
  stepLineCompleted: { backgroundColor: theme.success },
  stepLabel: { fontSize: 13, fontWeight: '600', color: theme.textMuted, textAlign: 'center', marginBottom: 20 },
});
