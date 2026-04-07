import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { theme } from '../constants/theme';
import { config, calculateDeliveryFee } from '../constants/config';
import { useApp } from '../contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { initializePaystackPayment } from '../services/supabaseData';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useRestaurantHours } from '../hooks/useRestaurantHours';

type OrderType = 'delivery' | 'pickup';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scheduledTime?: string }>();
  const { cart, cartTotal, placeOrder, userLocation, userProfile, restaurants } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [estimatedKm, setEstimatedKm] = useState<number | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Paystack WebView state
  const [paystackUrl, setPaystackUrl] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Restaurant hours enforcement
  const restaurantHoursData = restaurant ? (restaurant as any).operating_hours : null;
  const { isCurrentlyOpen, closingSoon, closingSoonLabel } = useRestaurantHours(restaurantHoursData);

  // Scheduled order info
  const scheduledTime = params.scheduledTime || null;

  // Pre-fill address from location
  useEffect(() => {
    if (userProfile?.address) {
      setAddress(userProfile.address);
      return;
    }
    if (!userLocation) return;
    let cancelled = false;
    const geocode = async () => {
      setLoadingAddress(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
        if (!cancelled && results.length > 0) {
          const r = results[0];
          const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch (err) {
        console.log('Geocode error:', err);
      } finally {
        if (!cancelled) setLoadingAddress(false);
      }
    };
    geocode();
    return () => { cancelled = true; };
  }, [userLocation, userProfile?.address]);

  // Estimate distance to restaurant for delivery fee
  useEffect(() => {
    if (!userLocation || cart.length === 0) return;
    const restaurantId = cart[0].restaurantId;
    const rest = restaurants.find(r => r.id === restaurantId);
    const rLat = (rest as any)?.latitude;
    const rLng = (rest as any)?.longitude;
    if (rLat && rLng) {
      const R = 6371;
      const dLat = (rLat - userLocation.latitude) * Math.PI / 180;
      const dLon = (rLng - userLocation.longitude) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(rLat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      setEstimatedKm(parseFloat((R * c).toFixed(1)));
    } else {
      setEstimatedKm(null);
    }
  }, [userLocation, cart, restaurants]);

  const deliveryFee = orderType === 'pickup' ? 0 : calculateDeliveryFee(estimatedKm);
  const serviceFee = config.serviceFee;
  const total = cartTotal + deliveryFee + serviceFee;

  // Get restaurant info for pickup address and subaccount
  const restaurant = cart.length > 0 ? restaurants.find(r => r.id === cart[0].restaurantId) : null;
  const subaccountCode = (restaurant as any)?.paystack_subaccount_code || null;

  const handlePlaceOrder = async () => {
    // Enforce restaurant operating hours
    if (!isCurrentlyOpen) {
      showAlert('Restaurant Closed', `${restaurant?.name || 'This restaurant'} is currently closed. Please try again during their opening hours or schedule an order from the restaurant page.`);
      return;
    }
    if (orderType === 'delivery' && !address.trim()) {
      showAlert('Address Required', 'Please enter a delivery address before placing your order.');
      return;
    }
    setLoading(true);

    const finalAddress = orderType === 'pickup'
      ? `PICKUP: ${restaurant?.address || cart[0]?.restaurantName}`
      : address;
    const finalNote = scheduledTime
      ? `[Scheduled: ${scheduledTime}] ${note}`.trim()
      : note;

    // Create the order first
    const order = await placeOrder(finalAddress, finalNote, 'paystack', deliveryFee);
    if (!order) {
      setLoading(false);
      return;
    }

    // Initialize Paystack payment
    const customerEmail = user?.email || userProfile?.email || '';
    const { data: paystackData, error: paystackError } = await initializePaystackPayment(
      customerEmail,
      total,
      order.id,
      subaccountCode,
      {
        customer_name: userProfile?.username || 'Customer',
        restaurant_name: restaurant?.name || cart[0]?.restaurantName,
        order_type: orderType,
      }
    );

    if (paystackError || !paystackData) {
      setLoading(false);
      showAlert('Payment Error', paystackError || 'Could not initialize payment. Your order has been created.');
      // Still route to tracking since order was created
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/order-tracking', params: { orderId: order.id } });
      return;
    }

    // Show Paystack WebView
    setPendingOrderId(order.id);
    setPaystackUrl(paystackData.authorization_url);
    setLoading(false);
  };

  const handlePaystackWebViewChange = (navState: any) => {
    const url = navState.url || '';
    // Detect callback URL (payment completed)
    if (url.includes('swiftchop.app/payment/callback') || url.includes('paystack.co/close')) {
      setPaystackUrl(null);
      if (pendingOrderId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/order-tracking', params: { orderId: pendingOrderId } });
      }
    }
    // Detect payment cancellation
    if (url.includes('paystack.co/close') || url.includes('cancel')) {
      setPaystackUrl(null);
      if (pendingOrderId) {
        showAlert('Payment Cancelled', 'Your order has been created. You can retry payment from your orders page.');
        router.replace({ pathname: '/order-tracking', params: { orderId: pendingOrderId } });
      }
    }
  };

  // Paystack WebView Modal
  if (paystackUrl) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => {
            setPaystackUrl(null);
            if (pendingOrderId) {
              router.replace({ pathname: '/order-tracking', params: { orderId: pendingOrderId } });
            }
          }} style={styles.backBtn}>
            <MaterialIcons name="close" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <View style={styles.paystackBadge}>
            <MaterialIcons name="lock" size={14} color={theme.success} />
            <Text style={styles.paystackBadgeText}>Secured by Paystack</Text>
          </View>
        </View>
        <WebView
          source={{ uri: paystackUrl }}
          onNavigationStateChange={handlePaystackWebViewChange}
          style={{ flex: 1 }}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
          {/* Scheduled order banner */}
          {scheduledTime ? (
            <View style={styles.scheduledBanner}>
              <MaterialIcons name="schedule" size={20} color="#2563EB" />
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduledBannerTitle}>Scheduled Order</Text>
                <Text style={styles.scheduledBannerText}>This order is scheduled for {scheduledTime}</Text>
              </View>
            </View>
          ) : null}

          {/* Order Type Toggle */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="local-shipping" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Order Type</Text>
            </View>
            <View style={styles.orderTypeToggle}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setOrderType('delivery'); }}
                style={[styles.orderTypeBtn, orderType === 'delivery' && styles.orderTypeBtnActive]}
              >
                <MaterialIcons name="delivery-dining" size={22} color={orderType === 'delivery' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.orderTypeBtnText, orderType === 'delivery' && styles.orderTypeBtnTextActive]}>Delivery</Text>
                {orderType === 'delivery' && estimatedKm ? (
                  <Text style={styles.orderTypeHint}>~{estimatedKm}km</Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setOrderType('pickup'); }}
                style={[styles.orderTypeBtn, orderType === 'pickup' && styles.orderTypeBtnActive]}
              >
                <MaterialIcons name="storefront" size={22} color={orderType === 'pickup' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.orderTypeBtnText, orderType === 'pickup' && styles.orderTypeBtnTextActive]}>Pick Up</Text>
                <Text style={[styles.orderTypeHint, orderType === 'pickup' && { color: 'rgba(255,255,255,0.7)' }]}>No delivery fee</Text>
              </Pressable>
            </View>
          </View>

          {/* Delivery Address OR Pickup Info */}
          {orderType === 'delivery' ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="location-on" size={20} color={theme.primary} />
                <Text style={styles.sectionTitle}>Delivery Address</Text>
                {loadingAddress ? <Text style={styles.loadingHint}>Detecting...</Text> : null}
              </View>
              <TextInput style={styles.addressInput} value={address} onChangeText={setAddress} placeholder="Enter delivery address" placeholderTextColor={theme.textMuted} multiline />
              {userLocation ? (
                <View style={styles.locationDetected}>
                  <MaterialIcons name="my-location" size={14} color={theme.success} />
                  <Text style={styles.locationDetectedText}>Using your current location</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="storefront" size={20} color={theme.primary} />
                <Text style={styles.sectionTitle}>Pickup Location</Text>
              </View>
              <View style={styles.pickupCard}>
                <View style={styles.pickupIcon}>
                  <MaterialIcons name="store" size={24} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickupName}>{restaurant?.name || cart[0]?.restaurantName}</Text>
                  <Text style={styles.pickupAddress}>{restaurant?.address || 'Restaurant address'}</Text>
                </View>
              </View>
              <View style={styles.pickupInfoRow}>
                <MaterialIcons name="info-outline" size={15} color={theme.textMuted} />
                <Text style={styles.pickupInfoText}>Your order will be ready for collection at the restaurant. You will be notified when it is ready.</Text>
              </View>
            </View>
          )}

          {/* Payment Method */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="payment" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            <View style={[styles.paymentOption, styles.paymentOptionActive]}>
              <View style={[styles.paymentIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialIcons name="credit-card" size={22} color="#2E7D32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentLabel}>Pay with Card</Text>
                <Text style={styles.paymentSub}>Debit or credit card via Paystack</Text>
              </View>
              <View style={[styles.radio, styles.radioActive]}>
                <View style={styles.radioInner} />
              </View>
            </View>
            <View style={styles.paystackSecure}>
              <MaterialIcons name="lock" size={14} color={theme.success} />
              <Text style={styles.paystackSecureText}>Secured by Paystack. Your card details are never stored.</Text>
            </View>
          </View>

          {/* Delivery Note */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="edit-note" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>{orderType === 'pickup' ? 'Note (optional)' : 'Delivery Note (optional)'}</Text>
            </View>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={orderType === 'pickup' ? 'e.g. I will pick up at 2pm...' : 'e.g. Ring the doorbell, leave at gate...'}
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>

          {/* Order Summary — Full Breakdown */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="receipt" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>

            {/* Individual items */}
            <Text style={styles.breakdownSectionLabel}>Food Items</Text>
            {cart.map((ci) => (
              <View key={ci.menuItem.id} style={styles.summaryItem}>
                <Text style={styles.summaryItemQty}>{ci.quantity}x</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryItemName} numberOfLines={1}>{ci.menuItem.name}</Text>
                  <Text style={styles.breakdownUnitPrice}>{config.currency}{ci.menuItem.price.toLocaleString()} each</Text>
                </View>
                <Text style={styles.summaryItemPrice}>{config.currency}{(ci.menuItem.price * ci.quantity).toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.divider} />

            {/* Subtotal */}
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="restaurant-menu" size={14} color={theme.textMuted} />
                <Text style={styles.summaryLabel}>Food Subtotal</Text>
              </View>
              <Text style={styles.summaryValue}>{config.currency}{cartTotal.toLocaleString()}</Text>
            </View>

            {/* Delivery fee */}
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="delivery-dining" size={14} color={theme.textMuted} />
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                {orderType === 'delivery' && estimatedKm ? (
                  <Text style={styles.summaryHint}>(~{estimatedKm}km)</Text>
                ) : null}
              </View>
              <Text style={[styles.summaryValue, orderType === 'pickup' && { color: theme.success }]}>
                {orderType === 'pickup' ? 'FREE' : `${config.currency}${deliveryFee.toLocaleString()}`}
              </Text>
            </View>

            {/* Service/App fee */}
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="apps" size={14} color={theme.textMuted} />
                <Text style={styles.summaryLabel}>App Service Fee</Text>
              </View>
              <Text style={styles.summaryValue}>{config.currency}{serviceFee.toLocaleString()}</Text>
            </View>

            {/* Tax row — currently ₦0 */}
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="account-balance" size={14} color={theme.textMuted} />
                <Text style={styles.summaryLabel}>Tax</Text>
              </View>
              <Text style={[styles.summaryValue, { color: theme.success }]}>{config.currency}0</Text>
            </View>

            <View style={styles.divider} />

            {/* Total breakdown summary */}
            <View style={styles.breakdownTotalCard}>
              <View style={styles.breakdownTotalRow}>
                <Text style={styles.breakdownTotalLabel}>Food</Text>
                <Text style={styles.breakdownTotalVal}>{config.currency}{cartTotal.toLocaleString()}</Text>
              </View>
              {orderType === 'delivery' ? (
                <View style={styles.breakdownTotalRow}>
                  <Text style={styles.breakdownTotalLabel}>+ Delivery</Text>
                  <Text style={styles.breakdownTotalVal}>{config.currency}{deliveryFee.toLocaleString()}</Text>
                </View>
              ) : null}
              <View style={styles.breakdownTotalRow}>
                <Text style={styles.breakdownTotalLabel}>+ Service Fee</Text>
                <Text style={styles.breakdownTotalVal}>{config.currency}{serviceFee.toLocaleString()}</Text>
              </View>
              <View style={[styles.breakdownTotalRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, marginTop: 6 }]}>
                <Text style={styles.breakdownGrandLabel}>You Pay</Text>
                <Text style={styles.breakdownGrandVal}>{config.currency}{total.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Restaurant closed warning */}
          {!isCurrentlyOpen ? (
            <View style={styles.closedWarning}>
              <MaterialIcons name="block" size={18} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.closedWarningTitle}>Restaurant Closed</Text>
                <Text style={styles.closedWarningText}>This restaurant is currently closed. Go back to schedule an order or try again during opening hours.</Text>
              </View>
            </View>
          ) : closingSoon ? (
            <View style={styles.closingSoonWarning}>
              <MaterialIcons name="access-time" size={16} color="#D97706" />
              <Text style={styles.closingSoonWarningText}>{closingSoonLabel} — place your order soon!</Text>
            </View>
          ) : null}

          {orderType === 'delivery' ? (
            <View style={styles.feeNote}>
              <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
              <Text style={styles.feeNoteText}>
                Delivery fee is estimated based on distance. Final fee may adjust slightly after a rider is assigned.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              {orderType === 'pickup' ? (
                <Text style={styles.pickupSaving}>You save {config.currency}{calculateDeliveryFee(estimatedKm).toLocaleString()} on delivery</Text>
              ) : null}
            </View>
            <Text style={styles.totalValue}>{config.currency}{total.toLocaleString()}</Text>
          </View>
          <PrimaryButton
            label={loading ? 'Processing...' : `${orderType === 'pickup' ? 'Pay & Place Pickup Order' : 'Pay & Place Order'} \u00B7 ${config.currency}${total.toLocaleString()}`}
            onPress={handlePlaceOrder}
            loading={loading}
            variant="dark"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  paystackBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E8F5E9' },
  paystackBadgeText: { fontSize: 11, fontWeight: '600', color: '#2E7D32' },
  scheduledBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  scheduledBannerTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 2 },
  scheduledBannerText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  loadingHint: { fontSize: 12, color: theme.textMuted, marginLeft: 'auto' },
  orderTypeToggle: { flexDirection: 'row', gap: 10 },
  orderTypeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border },
  orderTypeBtnActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  orderTypeBtnText: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
  orderTypeBtnTextActive: { color: '#FFF' },
  orderTypeHint: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  addressInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: theme.textPrimary, minHeight: 52, borderWidth: 1, borderColor: theme.border },
  locationDetected: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationDetectedText: { fontSize: 12, color: theme.success, fontWeight: '500' },
  pickupCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted },
  pickupIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  pickupName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  pickupAddress: { fontSize: 13, color: theme.textSecondary, marginTop: 3 },
  pickupInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  pickupInfoText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  paymentOptionActive: { borderColor: '#2E7D32', backgroundColor: '#F0FDF4' },
  paymentIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paymentLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  paymentSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#2E7D32' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2E7D32' },
  paystackSecure: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  paystackSecureText: { fontSize: 12, color: theme.textMuted },
  noteInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: theme.textPrimary, minHeight: 48, borderWidth: 1, borderColor: theme.border },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  summaryItemQty: { fontSize: 14, fontWeight: '600', color: theme.primary, width: 30 },
  summaryItemName: { flex: 1, fontSize: 14, color: theme.textPrimary },
  summaryItemPrice: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  breakdownSectionLabel: { fontSize: 12, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  breakdownUnitPrice: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  breakdownTotalCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 14, marginTop: 4 },
  breakdownTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownTotalLabel: { fontSize: 13, color: theme.textSecondary },
  breakdownTotalVal: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  breakdownGrandLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  breakdownGrandVal: { fontSize: 18, fontWeight: '700', color: theme.primary },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: theme.textSecondary },
  summaryHint: { fontSize: 11, color: theme.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  feeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  feeNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  totalValue: { fontSize: 24, fontWeight: '700', color: theme.primary },
  pickupSaving: { fontSize: 11, color: theme.success, fontWeight: '500', marginTop: 2 },
  closedWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' },
  closedWarningTitle: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
  closedWarningText: { fontSize: 12, color: '#991B1B', lineHeight: 17 },
  closingSoonWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  closingSoonWarningText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
});
