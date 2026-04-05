import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAuth, useAlert } from '@/template';
import { useApp } from '../contexts/AppContext';
import { updateUserProfile, createRestaurantForOwner } from '../services/supabaseData';
import PrimaryButton from '../components/ui/PrimaryButton';

const customerSlides = [
  {
    image: require('@/assets/images/onboarding-customer-1.jpg'),
    title: 'Discover with AI',
    subtitle: 'SwiftChop learns what you crave and recommends meals tailored just for you. No more endless scrolling — the right food, at the right time.',
    icon: 'auto-awesome',
  },
  {
    image: require('@/assets/images/onboarding-customer-2.jpg'),
    title: 'Lightning Fast Delivery',
    subtitle: 'Hot food, delivered fast. Our optimized delivery network finds the quickest route to your door — with prices that keep your wallet happy.',
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
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Restaurant form state
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantCuisine, setRestaurantCuisine] = useState('');
  const [restaurantDescription, setRestaurantDescription] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [minOrder, setMinOrder] = useState('2000');
  const [deliveryTime, setDeliveryTime] = useState('25-35 min');

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
      // Last slide
      if (userRole === 'customer') {
        handleCustomerComplete();
      } else {
        setShowForm(true);
      }
    }
  }, [currentIndex, slides.length, userRole]);

  const handleSkip = useCallback(() => {
    if (userRole === 'customer') {
      handleCustomerComplete();
    } else {
      setShowForm(true);
    }
  }, [userRole]);

  const handleCustomerComplete = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await updateUserProfile(user.id, { role: 'customer', is_approved: true });
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Customer onboarding error:', err);
      showAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurantSubmit = async () => {
    if (!user?.id) return;
    if (!restaurantName.trim()) { showAlert('Required', 'Please enter your restaurant name'); return; }
    if (!restaurantAddress.trim()) { showAlert('Required', 'Please enter your restaurant address'); return; }
    if (!restaurantCuisine.trim()) { showAlert('Required', 'Please enter your cuisine type'); return; }
    if (!restaurantPhone.trim()) { showAlert('Required', 'Please enter a contact phone number'); return; }

    setLoading(true);
    try {
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
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLastSlide = currentIndex === slides.length - 1;

  // Restaurant Setup Form
  if (showForm) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.formScroll, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setShowForm(false)} style={styles.formBackBtn}>
              <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
            </Pressable>

            <View style={styles.formHeader}>
              <View style={styles.formIconWrap}>
                <MaterialIcons name="storefront" size={32} color={theme.primary} />
              </View>
              <Text style={styles.formTitle}>Set Up Your Restaurant</Text>
              <Text style={styles.formSubtitle}>Complete your profile to start receiving orders. You will be reviewed and approved shortly.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Restaurant Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="storefront" size={20} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="e.g. Mama Nkechi's Kitchen" placeholderTextColor={theme.textMuted} value={restaurantName} onChangeText={setRestaurantName} />
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

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Min. Order (₦)</Text>
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
            <PrimaryButton label={loading ? 'Setting up...' : 'Complete Setup'} onPress={handleRestaurantSubmit} loading={loading} variant="dark" />

            <View style={styles.formNote}>
              <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
              <Text style={styles.formNoteText}>Your restaurant will be reviewed within 24 hours. You will be notified once approved.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Onboarding Slides
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
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth, height: screenHeight }}>
            <Image
              source={item.image}
              style={{ width: screenWidth, height: screenHeight * 0.58 }}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={['transparent', 'rgba(13,13,13,0.8)', '#0D0D0D']}
              style={styles.imageGradient}
              locations={[0, 0.4, 1]}
            />
          </View>
        )}
      />

      {/* Content overlay */}
      <View style={[styles.overlay, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        {/* Skip button */}
        <View style={[styles.skipRow, { paddingTop: insets.top + 8 }]}>
          <View />
          {!isLastSlide ? (
            <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : <View />}
        </View>

        <View style={styles.spacer} />

        {/* Text content */}
        <View style={styles.textContent}>
          <View style={styles.iconBadge}>
            <MaterialIcons name={slides[currentIndex].icon as any} size={22} color="#FFF" />
          </View>
          <Text style={styles.slideTitle}>{slides[currentIndex].title}</Text>
          <Text style={styles.slideSubtitle}>{slides[currentIndex].subtitle}</Text>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === currentIndex ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.mainBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            disabled={loading}
          >
            <Text style={styles.mainBtnText}>
              {isLastSlide
                ? (userRole === 'customer' ? 'Get Started' : 'Set Up Your Restaurant')
                : 'Next'
              }
            </Text>
            <MaterialIcons
              name={isLastSlide ? (userRole === 'customer' ? 'celebration' : 'storefront') : 'arrow-forward'}
              size={20}
              color="#FFF"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  // Slide overlay
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  skipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  spacer: { flex: 1 },
  textContent: {
    paddingHorizontal: 28,
    marginBottom: 24,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 28,
    backgroundColor: theme.primary,
  },
  actionRow: {
    paddingHorizontal: 28,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    height: 56,
    borderRadius: 16,
  },
  mainBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },

  // Restaurant form
  formScroll: { paddingHorizontal: 24 },
  formBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  formHeader: { marginTop: 20, marginBottom: 28, alignItems: 'center' },
  formIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  formTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' },
  formSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: theme.backgroundSecondary,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  rowInputs: { flexDirection: 'row', gap: 12 },
  formNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  formNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
