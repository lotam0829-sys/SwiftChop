import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

const steps = [
  { key: 'pending', icon: 'hourglass-top', label: 'Order Placed', sub: 'Waiting for restaurant to accept' },
  { key: 'confirmed', icon: 'check-circle', label: 'Confirmed', sub: 'Restaurant accepted your order' },
  { key: 'preparing', icon: 'restaurant', label: 'Preparing', sub: 'Chef is making your food' },
  { key: 'on_the_way', icon: 'delivery-dining', label: 'On the Way', sub: 'Rider is heading to you' },
  { key: 'delivered', icon: 'done-all', label: 'Delivered', sub: 'Enjoy your meal!' },
];

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { customerOrders, refreshOrder, reorder } = useApp();

  const order = customerOrders.find(o => o.id === orderId) || customerOrders[0];
  const [currentStep, setCurrentStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusIndex = steps.findIndex(s => s.key === order?.status);

  useEffect(() => {
    let step = 0;
    const target = statusIndex >= 0 ? statusIndex : 0;
    const interval = setInterval(() => {
      if (step <= target) {
        setCurrentStep(step);
        step++;
      } else {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [statusIndex]);

  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;

    pollingRef.current = setInterval(() => {
      if (orderId) {
        refreshOrder(orderId);
      }
    }, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [order?.status, orderId]);

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, [currentStep]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  const handleOpenTracking = useCallback(async () => {
    const url = order?.shipday_tracking_url;
    if (!url) return;
    try {
      const isValid = url.startsWith('http://') || url.startsWith('https://');
      if (!isValid) return;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (err) {
      console.error('Failed to open tracking URL:', err);
    }
  }, [order?.shipday_tracking_url]);

  if (!order) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Order not found</Text></View>;
  }

  const hasValidTrackingUrl = order.shipday_tracking_url
    && (order.shipday_tracking_url.startsWith('http://') || order.shipday_tracking_url.startsWith('https://'))
    && !order.shipday_tracking_url.includes('undefined')
    && !order.shipday_tracking_url.includes('null');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.backBtn}>
          <MaterialIcons name="close" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successBanner}>
          <View style={[styles.successIcon, { backgroundColor: order.status === 'pending' ? theme.warning : theme.success }]}>
            <MaterialIcons name={order.status === 'pending' ? 'hourglass-top' : 'check'} size={28} color="#FFF" />
          </View>
          <Text style={styles.successTitle}>
            {order.status === 'pending' ? 'Order Placed!' : order.status === 'delivered' ? 'Order Delivered!' : 'Order in Progress'}
          </Text>
          <Text style={styles.successSub}>
            {order.status === 'pending'
              ? 'Waiting for the restaurant to confirm'
              : `Estimated delivery: ${order.shipday_eta || order.estimated_delivery}`}
          </Text>
        </View>

        {/* Tracking notification */}
        <View style={styles.trackingNotice}>
          <MaterialIcons name="notifications-active" size={20} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.trackingNoticeTitle}>Live Tracking Available</Text>
            <Text style={styles.trackingNoticeText}>
              A tracking link will be sent to your phone number and email once a rider is assigned. You can also track your order live using the button below.
            </Text>
          </View>
        </View>

        {/* Shipday Live Tracking Link */}
        {hasValidTrackingUrl ? (
          <Pressable onPress={handleOpenTracking} style={styles.trackingLinkBtn}>
            <MaterialIcons name="map" size={20} color="#FFF" />
            <Text style={styles.trackingLinkText}>Track Live on Map</Text>
            <MaterialIcons name="open-in-new" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : (
          <View style={styles.trackingPending}>
            <MaterialIcons name="hourglass-top" size={18} color={theme.textMuted} />
            <Text style={styles.trackingPendingText}>Live tracking link will appear here once a rider is assigned to your order.</Text>
          </View>
        )}

        {/* Carrier info */}
        {order.shipday_carrier_name ? (
          <View style={styles.carrierCard}>
            <View style={styles.carrierAvatar}>
              <MaterialIcons name="person" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.carrierName}>{order.shipday_carrier_name}</Text>
              <Text style={styles.carrierLabel}>Your delivery rider</Text>
            </View>
            {order.shipday_carrier_phone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${order.shipday_carrier_phone}`)}
                style={styles.callBtn}
              >
                <MaterialIcons name="phone" size={20} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.timeline}>
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentStep;
            const isCurrent = idx === currentStep;
            const isCancelled = order.status === 'cancelled';
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <Animated.View style={[
                    styles.timelineDot,
                    isCompleted && !isCancelled && { backgroundColor: theme.primary },
                    isCancelled && { backgroundColor: theme.error },
                    isCurrent && !isCancelled ? pulseStyle : undefined,
                  ]}>
                    <MaterialIcons name={step.icon as any} size={20} color={isCompleted ? '#FFF' : theme.textMuted} />
                  </Animated.View>
                  {idx < steps.length - 1 ? <View style={[styles.timelineLine, isCompleted && !isCancelled && { backgroundColor: theme.primary }]} /> : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, isCompleted && { color: theme.textPrimary, fontWeight: '700' }]}>{step.label}</Text>
                  <Text style={styles.timelineSub}>{step.sub}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.infoTitle}>Order Details</Text>
          <View style={styles.infoRow}><MaterialIcons name="storefront" size={18} color={theme.textMuted} /><Text style={styles.infoText}>{order.restaurant_name}</Text></View>
          <View style={styles.infoRow}><MaterialIcons name="location-on" size={18} color={theme.textMuted} /><Text style={styles.infoText}>{order.delivery_address}</Text></View>
          <View style={styles.infoRow}><MaterialIcons name="receipt" size={18} color={theme.textMuted} /><Text style={styles.infoText}>{order.order_number}</Text></View>
          <View style={styles.infoRow}><MaterialIcons name="credit-card" size={18} color={theme.textMuted} /><Text style={styles.infoText}>Card Payment</Text></View>
          {order.delivery_address?.startsWith('PICKUP:') ? (
            <View style={styles.pickupBadgeRow}>
              <MaterialIcons name="storefront" size={16} color="#2563EB" />
              <Text style={styles.pickupBadgeText}>Pickup Order</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          {(order.order_items || []).map((item, idx) => (
            <Text key={idx} style={styles.itemText}>{item.quantity}x {item.name} — {"\u20A6"}{(item.price * item.quantity).toLocaleString()}</Text>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={styles.totalValue}>{"\u20A6"}{order.total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Reorder + Review for delivered orders */}
        {order.status === 'delivered' ? (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const success = await reorder(order);
                if (success) router.push('/cart');
              }}
              style={styles.reorderPromptBtn}
            >
              <MaterialIcons name="replay" size={20} color="#FFF" />
              <Text style={styles.reorderPromptText}>Reorder This Meal</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/review',
                  params: {
                    orderId: order.id,
                    restaurantId: order.restaurant_id,
                    restaurantName: order.restaurant_name,
                  },
                });
              }}
              style={styles.reviewPromptBtn}
            >
              <MaterialIcons name="star" size={20} color="#FCD34D" />
              <Text style={styles.reviewPromptText}>Rate & Review Your Order</Text>
              <MaterialIcons name="chevron-right" size={20} color={theme.primary} />
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  successBanner: { alignItems: 'center', paddingVertical: 24, backgroundColor: theme.primaryFaint, borderRadius: 20, marginBottom: 16 },
  successIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  successSub: { fontSize: 14, color: theme.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  trackingNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12 },
  trackingNoticeTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 4 },
  trackingNoticeText: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  trackingLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 14, marginBottom: 16 },
  trackingLinkText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  trackingPending: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  trackingPendingText: { flex: 1, fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  carrierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginBottom: 16 },
  carrierAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  carrierName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  carrierLabel: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  timeline: { marginBottom: 20 },
  timelineItem: { flexDirection: 'row', gap: 14 },
  timelineLeft: { alignItems: 'center', width: 44 },
  timelineDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, height: 28, backgroundColor: theme.border, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineLabel: { fontSize: 15, fontWeight: '500', color: theme.textMuted },
  timelineSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  orderInfo: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 18, marginBottom: 20 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  itemText: { fontSize: 14, color: theme.textSecondary, marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.primary },
  pickupBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF' },
  pickupBadgeText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  reorderPromptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.primary },
  reorderPromptText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  reviewPromptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted, marginBottom: 12 },
  reviewPromptText: { fontSize: 15, fontWeight: '700', color: theme.primary },
  homeBtn: { backgroundColor: theme.backgroundDark, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
