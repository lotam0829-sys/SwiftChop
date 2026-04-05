import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { theme } from '../constants/theme';
import { config, calculateDeliveryFee, deliveryPricing } from '../constants/config';
import { useApp } from '../contexts/AppContext';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, cartTotal, placeOrder, userLocation, userProfile, restaurants } = useApp();

  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [estimatedKm, setEstimatedKm] = useState<number | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);

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

  const deliveryFee = calculateDeliveryFee(estimatedKm);
  const serviceFee = config.serviceFee;
  const total = cartTotal + deliveryFee + serviceFee;

  const handlePlaceOrder = async () => {
    if (!address.trim()) return;
    setLoading(true);
    const order = await placeOrder(address, note, 'card', deliveryFee);
    setLoading(false);
    if (order) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/order-tracking', params: { orderId: order.id } });
    }
  };

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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="payment" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>
            <View style={[styles.paymentOption, styles.paymentOptionActive]}>
              <View style={[styles.paymentIcon, { backgroundColor: theme.primaryFaint }]}>
                <MaterialIcons name="credit-card" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.paymentLabel, { color: theme.textPrimary }]}>Debit Card</Text>
                <Text style={styles.paymentSub}>Secure card payment</Text>
              </View>
              <View style={[styles.radio, styles.radioActive]}>
                <View style={styles.radioInner} />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="edit-note" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Delivery Note (optional)</Text>
            </View>
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote} placeholder="e.g. Ring the doorbell, leave at gate..." placeholderTextColor={theme.textMuted} multiline />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="receipt" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>
            {cart.map((ci) => (
              <View key={ci.menuItem.id} style={styles.summaryItem}>
                <Text style={styles.summaryItemQty}>{ci.quantity}x</Text>
                <Text style={styles.summaryItemName} numberOfLines={1}>{ci.menuItem.name}</Text>
                <Text style={styles.summaryItemPrice}>{config.currency}{(ci.menuItem.price * ci.quantity).toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>{config.currency}{cartTotal.toLocaleString()}</Text></View>
            <View style={styles.summaryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.summaryLabel}>Delivery fee</Text>
                <Text style={styles.summaryHint}>(est. ~{estimatedKm || deliveryPricing.defaultEstimateKm}km)</Text>
              </View>
              <Text style={styles.summaryValue}>{config.currency}{deliveryFee.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Service fee</Text><Text style={styles.summaryValue}>{config.currency}{serviceFee.toLocaleString()}</Text></View>
          </View>

          <View style={styles.feeNote}>
            <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
            <Text style={styles.feeNoteText}>
              Delivery fee is estimated based on distance. Final fee may adjust slightly after the rider is assigned via Shipday.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{config.currency}{total.toLocaleString()}</Text>
          </View>
          <PrimaryButton label={loading ? 'Placing Order...' : `Place Order \u00B7 ${config.currency}${total.toLocaleString()}`} onPress={handlePlaceOrder} loading={loading} variant="dark" />
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
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  loadingHint: { fontSize: 12, color: theme.textMuted, marginLeft: 'auto' },
  addressInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: theme.textPrimary, minHeight: 52, borderWidth: 1, borderColor: theme.border },
  locationDetected: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationDetectedText: { fontSize: 12, color: theme.success, fontWeight: '500' },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, marginBottom: 10 },
  paymentOptionActive: { borderColor: theme.primary, backgroundColor: theme.primaryFaint },
  paymentIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  paymentLabel: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  paymentSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: theme.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary },
  noteInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: theme.textPrimary, minHeight: 48, borderWidth: 1, borderColor: theme.border },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  summaryItemQty: { fontSize: 14, fontWeight: '600', color: theme.primary, width: 30 },
  summaryItemName: { flex: 1, fontSize: 14, color: theme.textPrimary },
  summaryItemPrice: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
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
});
