import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Dimensions, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../constants/theme';
import { useAuth, useAlert } from '@/template';
import { useApp } from '../contexts/AppContext';
import { updateUserProfile, createRestaurantForOwner } from '../services/supabaseData';
import { getSupabaseClient } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

const customerSlides = [
  {
    image: require('@/assets/images/onboarding-customer-1.jpg'),
    title: 'Discover with AI',
    subtitle: 'SwiftChop learns what you crave and recommends meals tailored just for you. No more endless scrolling \u2014 the right food, at the right time.',
    icon: 'auto-awesome',
  },
  {
    image: require('@/assets/images/onboarding-customer-2.jpg'),
    title: 'Lightning Fast Delivery',
    subtitle: 'Hot food, delivered fast. Our optimized delivery network finds the quickest route to your door \u2014 with prices that keep your wallet happy.',
    icon: 'delivery-dining',
  },
  {
    image: require('@/assets/images/onboarding-customer-3.jpg'),
    title: 'Order in Seconds',
    subtitle: 'Browse menus, tap to order, track in real-time. Satisfy your cravings in just a few taps. Welcome to SwiftChop.',
    icon: 'touch-app',
  },
];

const restaurantSlides = [
  {
    image: require('@/assets/images/onboarding-restaurant-1.jpg'),
    title: 'Reach More Customers',
    subtitle: 'Get discovered by hungry customers around you. Our AI connects your food to the right people at the right time.',
    icon: 'campaign',
  },
  {
    image: require('@/assets/images/onboarding-restaurant-2.jpg'),
    title: 'More Orders, Less Stress',
    subtitle: 'We handle the demand flow and delivery coordination so you can focus on cooking. Orders come in, we help move them out.',
    icon: 'receipt-long',
  },
  {
    image: require('@/assets/images/onboarding-restaurant-3.jpg'),
    title: 'Grow Your Business',
    subtitle: 'Boost your revenue with smarter visibility, fast delivery, and a system designed to help you scale effortlessly.',
    icon: 'trending-up',
  },
];

type OnboardingPhase = 'slides' | 'location' | 'fees_acknowledgment' | 'card' | 'restaurant_details' | 'bank_details' | 'commission_agreement' | 'certificate';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshProfile } = useApp();

  const userRole = (role as 'customer' | 'restaurant') || 'customer';
  const slides = userRole === 'restaurant' ? restaurantSlides : customerSlides;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<OnboardingPhase>('slides');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Location state
  const [locationGranted, setLocationGranted] = useState(false);

  // Customer card state (placeholder for Stripe)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [cardName, setCardName] = useState('');

  // Restaurant form state
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantCuisine, setRestaurantCuisine] = useState('');
  const [restaurantDescription, setRestaurantDescription] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [minOrder, setMinOrder] = useState('2000');
  const [deliveryTime, setDeliveryTime] = useState('25-35 min');

  // Bank details state
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // Commission agreement
  const [commissionAgreed, setCommissionAgreed] = useState(false);

  // Certificate state
  const [certificateFile, setCertificateFile] = useState<{ name: string; uri: string; size?: number } | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [dimensions, setDimensions] = useState({ width: 375, height: 667 });
  useEffect(() => {
    const update = () => setDimensions(Dimensions.get('window'));
    update();
    const sub = Dimensions.addEventListener('change', update);
    return () => sub?.remove();
  }, []);

  const screenWidth = Math.max(1, dimensions.width);
  const screenHeight = Math.max(1, dimensions.height);

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      setPhase('location');
    }
  }, [currentIndex, slides.length]);

  const handleSkip = useCallback(() => {
    setPhase('location');
  }, []);

  const handleRequestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (user?.id) {
          await updateUserProfile(user.id, {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          } as any);
        }
      }
    } catch (err) {
      console.log('Location error:', err);
    }
    // Route to fees acknowledgment for both roles
    if (userRole === 'customer') {
      setPhase('fees_acknowledgment');
    } else {
      setPhase('restaurant_details');
    }
  };

  const handleSkipLocation = () => {
    if (userRole === 'customer') {
      setPhase('fees_acknowledgment');
    } else {
      setPhase('restaurant_details');
    }
  };

  // Customer: fees acknowledgment -> card
  const handleFeesAcknowledged = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('card');
  };

  // Customer: card step (placeholder)
  const handleCardComplete = async () => {
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 16) {
      showAlert('Required', 'Please enter a valid 16-digit card number');
      return;
    }
    if (!cardExpiry.trim() || cardExpiry.length < 5) {
      showAlert('Required', 'Please enter a valid expiry (MM/YY)');
      return;
    }
    if (!cardCVV.trim() || cardCVV.length < 3) {
      showAlert('Required', 'Please enter your CVV');
      return;
    }
    if (!cardName.trim()) {
      showAlert('Required', 'Please enter the cardholder name');
      return;
    }

    if (!user?.id) return;
    setLoading(true);
    try {
      await updateUserProfile(user.id, { role: 'customer', is_approved: true } as any);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Customer onboarding error:', err);
      showAlert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Restaurant: details step -> bank details
  const handleRestaurantDetailsNext = () => {
    if (!restaurantName.trim()) { showAlert('Required', 'Please enter your restaurant name'); return; }
    if (!restaurantAddress.trim()) { showAlert('Required', 'Please enter your restaurant address'); return; }
    if (!restaurantCuisine.trim()) { showAlert('Required', 'Please enter your cuisine type'); return; }
    if (!restaurantPhone.trim()) { showAlert('Required', 'Please enter a contact phone number'); return; }
    setPhase('bank_details');
  };

  // Restaurant: bank details -> commission agreement
  const handleBankDetailsNext = () => {
    if (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 10) {
      showAlert('Required', 'Please enter a valid 10-digit bank account number');
      return;
    }
    if (!bankName.trim()) {
      showAlert('Required', 'Please enter your bank name');
      return;
    }
    if (!bankAccountName.trim()) {
      showAlert('Required', 'Please enter the name on your bank account');
      return;
    }
    setPhase('commission_agreement');
  };

  // Restaurant: commission agreement -> certificate
  const handleCommissionAgreed = () => {
    if (!commissionAgreed) {
      showAlert('Required', 'Please acknowledge the commission and fee structure to continue.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('certificate');
  };

  // Pick certificate PDF
  const handlePickCertificate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setCertificateFile({ name: file.name, uri: file.uri, size: file.size });
      }
    } catch (err) {
      console.error('Document picker error:', err);
      showAlert('Error', 'Failed to pick document');
    }
  };

  // Upload certificate and complete restaurant onboarding
  const handleRestaurantComplete = async () => {
    if (!certificateFile) {
      showAlert('Required', 'Please upload your Business Registration Certificate (CAC) before continuing.');
      return;
    }
    if (!user?.id) return;

    setLoading(true);
    try {
      let certificateUrl: string | null = null;
      setUploadingCert(true);

      const supabase = getSupabaseClient();
      const fileExt = 'pdf';
      const filePath = `${user.id}/business-certificate.${fileExt}`;

      const response = await fetch(certificateFile.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filePath, arrayBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        showAlert('Upload Failed', 'Could not upload certificate. Please try again.');
        setLoading(false);
        setUploadingCert(false);
        return;
      }

      certificateUrl = filePath;
      setUploadingCert(false);

      await updateUserProfile(user.id, {
        role: 'restaurant',
        restaurant_name: restaurantName.trim(),
        restaurant_address: restaurantAddress.trim(),
        restaurant_cuisine: restaurantCuisine.trim(),
        restaurant_description: restaurantDescription.trim() || `Welcome to ${restaurantName.trim()}`,
        phone: restaurantPhone.trim(),
        restaurant_min_order: parseInt(minOrder) || 2000,
        restaurant_delivery_time: deliveryTime.trim() || '25-35 min',
        is_approved: false,
        business_certificate_url: certificateUrl,
        bank_name: bankName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_account_name: bankAccountName.trim(),
      } as any);

      await createRestaurantForOwner(user.id, restaurantName.trim());
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/pending-approval');
    } catch (err) {
      console.error('Restaurant setup error:', err);
      showAlert('Error', 'Failed to set up restaurant. Please try again.');
    } finally {
      setLoading(false);
      setUploadingCert(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const isLastSlide = currentIndex === slides.length - 1;

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  // ====== LOCATION PERMISSION SCREEN ======
  if (phase === 'location') {
    return (
      <View style={[styles.container, { backgroundColor: '#0D0D0D' }]}>
        <View style={[styles.centeredContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.locationIconWrap}>
            <MaterialIcons name="my-location" size={48} color={theme.primary} />
          </View>
          <Text style={styles.phaseTitle}>Enable Location</Text>
          <Text style={styles.phaseSubtitle}>
            Allow SwiftChop to use your location so we can show restaurants near you and calculate accurate delivery fees.
          </Text>
          <View style={styles.locationBenefits}>
            {[
              { icon: 'near-me', text: 'Find restaurants close to you' },
              { icon: 'speed', text: 'Faster, more accurate deliveries' },
              { icon: 'savings', text: 'Fair delivery fees based on distance' },
            ].map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <MaterialIcons name={b.icon as any} size={20} color={theme.primary} />
                </View>
                <Text style={styles.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <PrimaryButton label="Allow Location Access" onPress={handleRequestLocation} variant="primary" icon={<MaterialIcons name="location-on" size={20} color="#FFF" />} />
          <Pressable onPress={handleSkipLocation} style={{ marginTop: 16, alignSelf: 'center' }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500' }}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ====== CUSTOMER: FEES ACKNOWLEDGMENT ======
  if (phase === 'fees_acknowledgment') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setPhase('location')} style={styles.formBackBtn}>
            <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
          </Pressable>

          <View style={styles.formHeader}>
            <View style={[styles.formIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <MaterialIcons name="info" size={32} color="#D97706" />
            </View>
            <Text style={styles.formTitle}>How Fees Work</Text>
            <Text style={styles.formSubtitle}>Before you start ordering, here is how our pricing works so there are no surprises.</Text>
          </View>

          <View style={styles.feeCard}>
            <View style={styles.feeCardIcon}>
              <MaterialIcons name="receipt-long" size={28} color={theme.primary} />
            </View>
            <Text style={styles.feeCardTitle}>Service Fee</Text>
            <Text style={styles.feeCardDesc}>
              A small service fee is added to each order to keep SwiftChop running, support customer service, and maintain platform quality. This fee is shown at checkout before you pay.
            </Text>
          </View>

          <View style={styles.feeCard}>
            <View style={[styles.feeCardIcon, { backgroundColor: '#DBEAFE' }]}>
              <MaterialIcons name="delivery-dining" size={28} color="#2563EB" />
            </View>
            <Text style={styles.feeCardTitle}>Delivery Fee</Text>
            <Text style={styles.feeCardDesc}>
              The delivery fee is calculated based on the distance between you and the restaurant. Closer restaurants mean lower delivery fees. The exact amount is shown at checkout.
            </Text>
          </View>

          <View style={styles.feeHighlight}>
            <MaterialIcons name="check-circle" size={20} color={theme.success} />
            <Text style={styles.feeHighlightText}>All fees are transparently displayed before you confirm any order. No hidden charges.</Text>
          </View>

          <View style={{ height: 24 }} />
          <PrimaryButton label="I Acknowledge" onPress={handleFeesAcknowledged} variant="dark" icon={<MaterialIcons name="thumb-up" size={20} color="#FFF" />} />
        </ScrollView>
      </View>
    );
  }

  // ====== CUSTOMER: ADD CARD SCREEN ======
  if (phase === 'card') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setPhase('fees_acknowledgment')} style={styles.formBackBtn}>
              <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>

            <View style={styles.formHeader}>
              <View style={[styles.formIconWrap, { backgroundColor: '#EBF5FF' }]}>
                <MaterialIcons name="credit-card" size={32} color="#2563EB" />
              </View>
              <Text style={styles.formTitle}>Add Payment Card</Text>
              <Text style={styles.formSubtitle}>Add a debit or credit card for fast, seamless checkout. Your card details are securely encrypted.</Text>
            </View>

            <View style={styles.cardPreview}>
              <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.cardTopRow}>
                  <MaterialIcons name="credit-card" size={28} color="rgba(255,255,255,0.8)" />
                  <MaterialIcons name="contactless" size={24} color="rgba(255,255,255,0.6)" />
                </View>
                <Text style={styles.cardPreviewNumber}>
                  {cardNumber || '\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022'}
                </Text>
                <View style={styles.cardBottomRow}>
                  <View>
                    <Text style={styles.cardSmallLabel}>CARDHOLDER</Text>
                    <Text style={styles.cardPreviewName}>{cardName || 'YOUR NAME'}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardSmallLabel}>EXPIRES</Text>
                    <Text style={styles.cardPreviewName}>{cardExpiry || 'MM/YY'}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Card Number</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="credit-card" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="1234 5678 9012 3456" placeholderTextColor={theme.textMuted} value={cardNumber} onChangeText={(t) => setCardNumber(formatCardNumber(t))} keyboardType="number-pad" maxLength={19} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Expiry Date</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="MM/YY" placeholderTextColor={theme.textMuted} value={cardExpiry} onChangeText={(t) => setCardExpiry(formatExpiry(t))} keyboardType="number-pad" maxLength={5} />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>CVV</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder={"\u2022\u2022\u2022"} placeholderTextColor={theme.textMuted} value={cardCVV} onChangeText={(t) => setCardCVV(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} secureTextEntry />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cardholder Name</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Name on card" placeholderTextColor={theme.textMuted} value={cardName} onChangeText={setCardName} autoCapitalize="characters" />
              </View>
            </View>

            <View style={styles.secureNote}>
              <MaterialIcons name="lock" size={16} color={theme.success} />
              <Text style={styles.secureNoteText}>Your card is secured with 256-bit encryption. Card will be charged only when you place an order.</Text>
            </View>

            <View style={{ height: 12 }} />
            <PrimaryButton label={loading ? 'Setting up...' : 'Complete Setup'} onPress={handleCardComplete} loading={loading} variant="dark" />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ====== RESTAURANT: DETAILS FORM ======
  if (phase === 'restaurant_details') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setPhase('location')} style={styles.formBackBtn}>
              <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>

            <View style={styles.formHeader}>
              <View style={styles.formIconWrap}>
                <MaterialIcons name="storefront" size={32} color={theme.primary} />
              </View>
              <Text style={styles.formTitle}>Restaurant Details</Text>
              <Text style={styles.formSubtitle}>Complete your profile to start receiving orders. All fields marked * are required.</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepPill, styles.stepPillActive]}><Text style={styles.stepPillText}>1. Details</Text></View>
              <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>2. Bank</Text></View>
              <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>3. Fees</Text></View>
              <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>4. CAC</Text></View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Restaurant Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="storefront" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="e.g. Mama Nkechi Kitchen" placeholderTextColor={theme.textMuted} value={restaurantName} onChangeText={setRestaurantName} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Restaurant Address *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="location-on" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="12 Awolowo Rd, Ikoyi, Lagos" placeholderTextColor={theme.textMuted} value={restaurantAddress} onChangeText={setRestaurantAddress} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cuisine Type *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="restaurant-menu" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="e.g. Traditional Nigerian, Fast Food" placeholderTextColor={theme.textMuted} value={restaurantCuisine} onChangeText={setRestaurantCuisine} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="phone" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="+234 801 234 5678" placeholderTextColor={theme.textMuted} value={restaurantPhone} onChangeText={setRestaurantPhone} keyboardType="phone-pad" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <View style={[styles.inputWrap, { height: 80, alignItems: 'flex-start', paddingVertical: 12 }]}>
                <MaterialIcons name="description" size={20} color={theme.textMuted} style={[styles.inputIcon, { marginTop: 2 }]} />
                <TextInput style={[styles.input, { textAlignVertical: 'top' }]} placeholder="Tell customers about your food..." placeholderTextColor={theme.textMuted} value={restaurantDescription} onChangeText={setRestaurantDescription} multiline />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Min. Order ({"\u20A6"})</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="2000" placeholderTextColor={theme.textMuted} value={minOrder} onChangeText={setMinOrder} keyboardType="number-pad" />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Delivery Time</Text>
                <View style={styles.inputWrap}>
                  <TextInput style={[styles.input, { textAlign: 'center' }]} placeholder="25-35 min" placeholderTextColor={theme.textMuted} value={deliveryTime} onChangeText={setDeliveryTime} />
                </View>
              </View>
            </View>

            <View style={{ height: 12 }} />
            <PrimaryButton label="Next: Bank Details" onPress={handleRestaurantDetailsNext} variant="dark" icon={<MaterialIcons name="arrow-forward" size={20} color="#FFF" />} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ====== RESTAURANT: BANK DETAILS ======
  if (phase === 'bank_details') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setPhase('restaurant_details')} style={styles.formBackBtn}>
              <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>

            <View style={styles.formHeader}>
              <View style={[styles.formIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <MaterialIcons name="account-balance" size={32} color={theme.success} />
              </View>
              <Text style={styles.formTitle}>Bank Details</Text>
              <Text style={styles.formSubtitle}>Add your bank account for receiving payments from orders. All fields are required.</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
                <MaterialIcons name="check" size={14} color={theme.success} />
                <Text style={[styles.stepPillText, { color: theme.success }]}>1. Details</Text>
              </View>
              <View style={[styles.stepPill, styles.stepPillActive]}><Text style={styles.stepPillText}>2. Bank</Text></View>
              <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>3. Fees</Text></View>
              <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>4. CAC</Text></View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bank Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="account-balance" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="e.g. GTBank, First Bank, Access Bank" placeholderTextColor={theme.textMuted} value={bankName} onChangeText={setBankName} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Number *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="pin" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="0123456789" placeholderTextColor={theme.textMuted} value={bankAccountNumber} onChangeText={(t) => setBankAccountNumber(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} />
              </View>
              <Text style={styles.inputHint}>Nigerian bank accounts are 10 digits</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="badge" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Name as it appears on your bank account" placeholderTextColor={theme.textMuted} value={bankAccountName} onChangeText={setBankAccountName} autoCapitalize="words" />
              </View>
            </View>

            <View style={styles.bankInfoCard}>
              <MaterialIcons name="info-outline" size={18} color={theme.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bankInfoTitle}>Why we need this</Text>
                <Text style={styles.bankInfoText}>Your earnings from customer orders will be settled to this account weekly. You can update it later in Settings.</Text>
              </View>
            </View>

            <View style={{ height: 12 }} />
            <PrimaryButton label="Next: Commission & Fees" onPress={handleBankDetailsNext} variant="dark" icon={<MaterialIcons name="arrow-forward" size={20} color="#FFF" />} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ====== RESTAURANT: COMMISSION & FEES AGREEMENT ======
  if (phase === 'commission_agreement') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => setPhase('bank_details')} style={styles.formBackBtn}>
            <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
          </Pressable>

          <View style={styles.formHeader}>
            <View style={[styles.formIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <MaterialIcons name="handshake" size={32} color="#D97706" />
            </View>
            <Text style={styles.formTitle}>Commission & Fees</Text>
            <Text style={styles.formSubtitle}>Please review how SwiftChop handles commissions and delivery fees before completing your registration.</Text>
          </View>

          <View style={styles.stepRow}>
            <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
              <MaterialIcons name="check" size={14} color={theme.success} />
              <Text style={[styles.stepPillText, { color: theme.success }]}>1. Details</Text>
            </View>
            <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
              <MaterialIcons name="check" size={14} color={theme.success} />
              <Text style={[styles.stepPillText, { color: theme.success }]}>2. Bank</Text>
            </View>
            <View style={[styles.stepPill, styles.stepPillActive]}><Text style={styles.stepPillText}>3. Fees</Text></View>
            <View style={styles.stepPill}><Text style={[styles.stepPillText, { color: theme.textMuted }]}>4. CAC</Text></View>
          </View>

          <View style={styles.feeCard}>
            <View style={styles.feeCardIcon}>
              <MaterialIcons name="percent" size={28} color={theme.primary} />
            </View>
            <Text style={styles.feeCardTitle}>Service Commission</Text>
            <Text style={styles.feeCardDesc}>
              SwiftChop takes a small percentage of each food item sold through the platform. This covers platform maintenance, customer acquisition, payment processing, and customer support. The exact commission rate will be visible on each order settlement.
            </Text>
          </View>

          <View style={styles.feeCard}>
            <View style={[styles.feeCardIcon, { backgroundColor: '#DBEAFE' }]}>
              <MaterialIcons name="delivery-dining" size={28} color="#2563EB" />
            </View>
            <Text style={styles.feeCardTitle}>Delivery Fee</Text>
            <Text style={styles.feeCardDesc}>
              Delivery fees are calculated dynamically based on the distance between your restaurant and the customer. This fee is paid by the customer, not deducted from your earnings. Shipday handles the delivery logistics and distance calculation.
            </Text>
          </View>

          <View style={styles.feeCard}>
            <View style={[styles.feeCardIcon, { backgroundColor: '#ECFDF5' }]}>
              <MaterialIcons name="account-balance-wallet" size={28} color={theme.success} />
            </View>
            <Text style={styles.feeCardTitle}>Your Earnings</Text>
            <Text style={styles.feeCardDesc}>
              After the service commission is deducted, your earnings are settled directly to your bank account on a weekly basis. You can track all transactions in your restaurant dashboard.
            </Text>
          </View>

          <Pressable
            onPress={() => { Haptics.selectionAsync(); setCommissionAgreed(!commissionAgreed); }}
            style={styles.agreementRow}
          >
            <View style={[styles.checkbox, commissionAgreed && styles.checkboxChecked]}>
              {commissionAgreed ? <MaterialIcons name="check" size={18} color="#FFF" /> : null}
            </View>
            <Text style={styles.agreementText}>
              I understand and agree to the commission structure and fee model described above.
            </Text>
          </Pressable>

          <View style={{ height: 16 }} />
          <PrimaryButton
            label="I Agree \u2014 Next: Upload Certificate"
            onPress={handleCommissionAgreed}
            variant="dark"
            icon={<MaterialIcons name="arrow-forward" size={20} color="#FFF" />}
          />
        </ScrollView>
      </View>
    );
  }

  // ====== RESTAURANT: CERTIFICATE UPLOAD ======
  if (phase === 'certificate') {
    return (
      <View style={[styles.container, { backgroundColor: '#FFF', paddingTop: insets.top }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => setPhase('commission_agreement')} style={styles.formBackBtn}>
              <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>

            <View style={styles.formHeader}>
              <View style={[styles.formIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="verified" size={32} color="#D97706" />
              </View>
              <Text style={styles.formTitle}>Business Certificate</Text>
              <Text style={styles.formSubtitle}>Upload your CAC Business Registration Certificate to verify your restaurant. This is required before your restaurant can go live.</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
                <MaterialIcons name="check" size={14} color={theme.success} />
                <Text style={[styles.stepPillText, { color: theme.success }]}>1. Details</Text>
              </View>
              <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
                <MaterialIcons name="check" size={14} color={theme.success} />
                <Text style={[styles.stepPillText, { color: theme.success }]}>2. Bank</Text>
              </View>
              <View style={[styles.stepPill, { backgroundColor: theme.successLight }]}>
                <MaterialIcons name="check" size={14} color={theme.success} />
                <Text style={[styles.stepPillText, { color: theme.success }]}>3. Fees</Text>
              </View>
              <View style={[styles.stepPill, styles.stepPillActive]}><Text style={styles.stepPillText}>4. CAC</Text></View>
            </View>

            <Pressable onPress={() => Linking.openURL('https://icrp.cac.gov.ng/assets/docs/crp-user-guide.pdf')} style={styles.cacGuideCard}>
              <View style={styles.cacGuideIcon}>
                <MaterialIcons name="menu-book" size={24} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cacGuideTitle}>CAC Registration Guide</Text>
                <Text style={styles.cacGuideSubtitle}>New to CAC? Read the official user guide to register your business.</Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color="#2563EB" />
            </Pressable>

            <Pressable onPress={handlePickCertificate} style={[styles.uploadArea, certificateFile ? styles.uploadAreaDone : null]}>
              {certificateFile ? (
                <View style={styles.uploadedFileRow}>
                  <View style={styles.pdfIcon}>
                    <MaterialIcons name="picture-as-pdf" size={28} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uploadedFileName} numberOfLines={1}>{certificateFile.name}</Text>
                    <Text style={styles.uploadedFileSize}>
                      {certificateFile.size ? `${(certificateFile.size / 1024).toFixed(0)} KB` : 'PDF Document'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setCertificateFile(null)} hitSlop={12}>
                    <MaterialIcons name="close" size={20} color={theme.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.uploadIconCircle}>
                    <MaterialIcons name="cloud-upload" size={32} color={theme.primary} />
                  </View>
                  <Text style={styles.uploadTitle}>Tap to upload certificate</Text>
                  <Text style={styles.uploadSubtitle}>PDF format only, max 10MB</Text>
                </>
              )}
            </Pressable>

            <View style={styles.certRequirements}>
              <Text style={styles.certReqTitle}>What we accept:</Text>
              {[
                'CAC Certificate of Registration',
                'Business Name Registration (BN Form)',
                'Certificate of Incorporation',
              ].map((req, i) => (
                <View key={i} style={styles.certReqRow}>
                  <MaterialIcons name="check-circle" size={16} color={theme.success} />
                  <Text style={styles.certReqText}>{req}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: 16 }} />
            <PrimaryButton
              label={loading ? (uploadingCert ? 'Uploading certificate...' : 'Setting up...') : 'Complete Setup'}
              onPress={handleRestaurantComplete}
              loading={loading}
              variant="dark"
            />

            <View style={styles.formNote}>
              <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
              <Text style={styles.formNoteText}>Your restaurant will be reviewed within 24 hours. You will be notified once approved.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ====== ONBOARDING SLIDES ======
  return (
    <View style={[styles.container, { backgroundColor: '#0D0D0D' }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => i.toString()}
        getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth, height: screenHeight }}>
            <Image source={item.image} style={{ width: screenWidth, height: screenHeight * 0.58 }} contentFit="cover" transition={300} />
            <LinearGradient colors={['transparent', 'rgba(13,13,13,0.8)', '#0D0D0D']} style={styles.imageGradient} locations={[0, 0.4, 1]} />
          </View>
        )}
      />

      <View style={[styles.overlay, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={[styles.skipRow, { paddingTop: insets.top + 8 }]}>
          <View />
          {!isLastSlide ? (
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : <View />}
        </View>

        <View style={styles.spacer} />

        <View style={styles.textContent}>
          <View style={styles.iconBadge}>
            <MaterialIcons name={slides[currentIndex].icon as any} size={22} color="#FFF" />
          </View>
          <Text style={styles.slideTitle}>{slides[currentIndex].title}</Text>
          <Text style={styles.slideSubtitle}>{slides[currentIndex].subtitle}</Text>
        </View>

        <View style={styles.dotsRow}>
          {slides.map((_, idx) => (
            <View key={idx} style={[styles.dot, idx === currentIndex ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={handleNext} style={({ pressed }) => [styles.mainBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} disabled={loading}>
            <Text style={styles.mainBtnText}>{isLastSlide ? 'Continue' : 'Next'}</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  skipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  skipBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  skipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  spacer: { flex: 1 },
  textContent: { paddingHorizontal: 28, marginBottom: 24 },
  iconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  slideTitle: { fontSize: 28, fontWeight: '800', color: '#FFF', marginBottom: 10, letterSpacing: -0.5 },
  slideSubtitle: { fontSize: 16, fontWeight: '400', color: 'rgba(255,255,255,0.75)', lineHeight: 24 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { width: 28, backgroundColor: theme.primary },
  actionRow: { paddingHorizontal: 28 },
  mainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, height: 56, borderRadius: 16 },
  mainBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  centeredContent: { flex: 1, paddingHorizontal: 28, alignItems: 'center' },
  locationIconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  phaseTitle: { fontSize: 28, fontWeight: '800', color: '#FFF', marginBottom: 12, textAlign: 'center' },
  phaseSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 24, textAlign: 'center', paddingHorizontal: 8 },
  locationBenefits: { marginTop: 32, width: '100%', gap: 16 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  benefitIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  benefitText: { fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  formScroll: { paddingHorizontal: 24 },
  formBackBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  formHeader: { marginTop: 20, marginBottom: 24, alignItems: 'center' },
  formIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  formTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' },
  formSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: theme.backgroundSecondary },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  inputHint: { fontSize: 12, color: theme.textMuted, marginTop: 4, paddingLeft: 4 },
  formNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20, paddingHorizontal: 4 },
  formNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  stepRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary },
  stepPillActive: { backgroundColor: theme.primaryFaint },
  stepPillText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  cardPreview: { marginBottom: 24 },
  cardGradient: { borderRadius: 16, padding: 24, height: 190, justifyContent: 'space-between' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPreviewNumber: { fontSize: 20, fontWeight: '600', color: '#FFF', letterSpacing: 2 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardSmallLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 },
  cardPreviewName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  secureNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  secureNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  bankInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, backgroundColor: theme.infoLight, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 8, marginTop: 4 },
  bankInfoTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  bankInfoText: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  // Fee cards
  feeCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  feeCardIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  feeCardTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  feeCardDesc: { fontSize: 14, color: theme.textSecondary, lineHeight: 21, textAlign: 'center' },
  feeHighlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 14, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  feeHighlightText: { flex: 1, fontSize: 14, color: '#065F46', fontWeight: '500', lineHeight: 20 },
  // Agreement
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border, marginTop: 8 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: theme.primary, borderColor: theme.primary },
  agreementText: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 21 },
  // Certificate
  cacGuideCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20 },
  cacGuideIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  cacGuideTitle: { fontSize: 15, fontWeight: '700', color: '#1D4ED8', marginBottom: 2 },
  cacGuideSubtitle: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  uploadArea: { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: theme.backgroundSecondary },
  uploadAreaDone: { borderColor: theme.success, borderStyle: 'solid', backgroundColor: '#F0FDF4', padding: 16 },
  uploadIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  uploadSubtitle: { fontSize: 13, color: theme.textMuted },
  uploadedFileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  pdfIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  uploadedFileName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  uploadedFileSize: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  certRequirements: { marginBottom: 8 },
  certReqTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 10 },
  certReqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  certReqText: { fontSize: 14, color: theme.textSecondary },
});
