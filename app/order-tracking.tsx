import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, withDelay, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

const deliverySteps = [
  { key: 'pending', icon: 'hourglass-top', label: 'Order Placed', sub: 'Waiting for restaurant to accept' },
  { key: 'confirmed', icon: 'check-circle', label: 'Confirmed', sub: 'Restaurant accepted your order' },
  { key: 'preparing', icon: 'restaurant', label: 'Preparing', sub: 'Chef is making your food' },
  { key: 'on_the_way', icon: 'delivery-dining', label: 'On the Way', sub: 'Rider is heading to you' },
  { key: 'delivered', icon: 'done-all', label: 'Delivered', sub: 'Enjoy your meal!' },
];

const pickupSteps = [
  { key: 'pending', icon: 'hourglass-top', label: 'Order Placed', sub: 'Waiting for restaurant to accept' },
  { key: 'confirmed', icon: 'check-circle', label: 'Confirmed', sub: 'Restaurant accepted your order' },
  { key: 'preparing', icon: 'restaurant', label: 'Preparing', sub: 'Restaurant is preparing your order' },
  { key: 'on_the_way', icon: 'storefront', label: 'Ready for Pickup', sub: 'Head to the restaurant to collect your order' },
  { key: 'delivered', icon: 'done-all', label: 'Collected', sub: 'Order Complete — Enjoy your meal!' },
];

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { customerOrders, refreshOrder, reorder } = useApp();

  const order = customerOrders.find(o => o.id === orderId) || customerOrders[0];
  const isPickup = order?.delivery_address?.startsWith('PICKUP:');
  const steps = isPickup ? pickupSteps : deliverySteps;

  const [currentStep, setCurrentStep] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fastPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tick every 30s to keep expected delivery time updated
  useEffect(() => {
    const ticker = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(ticker);
  }, []);

  // Compute dynamic expected delivery clock time
  const expectedDeliveryTime = useMemo(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return null;
    const now = new Date();
    let minutesToAdd = 45; // default
    if (order.shipday_eta) {
      const etaMatch = order.shipday_eta.match(/(\d+)/);
      if (etaMatch) minutesToAdd = parseInt(etaMatch[1], 10);
    } else if (order.estimated_delivery) {
      const match = order.estimated_delivery.match(/(\d+)/);
      if (match) minutesToAdd = parseInt(match[1], 10);
    }
    const expectedTime = new Date(now.getTime() + minutesToAdd * 60000);
    return expectedTime.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit', hour12: true });
  }, [order?.status, order?.shipday_eta, order?.estimated_delivery]);

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

  // Standard polling every 10s for order status updates
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

  // Fast polling (every 3s for first 30s) to catch tracking URL from Shipday dispatch
  // The Shipday dispatch is fire-and-forget, so the tracking URL may arrive shortly after order creation
  useEffect(() => {
    if (!order || isPickup || order.status === 'delivered' || order.status === 'cancelled') return;

    // If we already have a valid tracking URL, no need for fast polling
    if (hasValidUrl(order.shipday_tracking_url)) return;

    let elapsed = 0;
    const maxDuration = 30000; // 30 seconds of fast polling

    fastPollRef.current = setInterval(() => {
      elapsed += 3000;
      if (orderId) {
        refreshOrder(orderId);
      }
      if (elapsed >= maxDuration) {
        if (fastPollRef.current) clearInterval(fastPollRef.current);
      }
    }, 3000);

    return () => {
      if (fastPollRef.current) clearInterval(fastPollRef.current);
    };
  }, [order?.id, isPickup]);

  // Stop fast polling once tracking URL is available
  useEffect(() => {
    if (hasValidUrl(order?.shipday_tracking_url) && fastPollRef.current) {
      clearInterval(fastPollRef.current);
      fastPollRef.current = null;
    }
  }, [order?.shipday_tracking_url]);

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

  // === Searching for Dispatch Rider animation ===
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const ring1Opacity = useSharedValue(0.6);
  const ring2Opacity = useSharedValue(0.6);
  const ring3Opacity = useSharedValue(0.6);
  const dotPulse = useSharedValue(1);

  const isSearchingForRider = !isPickup && !order?.shipday_carrier_name && (order?.status === 'pending' || order?.status === 'confirmed');

  useEffect(() => {
    if (!isSearchingForRider) return;
    const animConfig = { duration: 2400, easing: Easing.out(Easing.ease) };
    ring1.value = withRepeat(withTiming(1, animConfig), -1, false);
    ring1Opacity.value = withRepeat(withSequence(withTiming(0.6, { duration: 0 }), withTiming(0, animConfig)), -1, false);
    ring2.value = withRepeat(withDelay(800, withTiming(1, animConfig)), -1, false);
    ring2Opacity.value = withRepeat(withDelay(800, withSequence(withTiming(0.6, { duration: 0 }), withTiming(0, animConfig))), -1, false);
    ring3.value = withRepeat(withDelay(1600, withTiming(1, animConfig)), -1, false);
    ring3Opacity.value = withRepeat(withDelay(1600, withSequence(withTiming(0.6, { duration: 0 }), withTiming(0, animConfig))), -1, false);
    dotPulse.value = withRepeat(withSequence(withTiming(1.1, { duration: 800 }), withTiming(0.95, { duration: 800 })), -1, true);
  }, [isSearchingForRider]);

  const ringStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ring1.value * 2 }], opacity: ring1Opacity.value }));
  const ringStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ring2.value * 2 }], opacity: ring2Opacity.value }));
  const ringStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ring3.value * 2 }], opacity: ring3Opacity.value }));
  const dotPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: dotPulse.value }] }));

  const hasTrackingUrl = !isPickup && hasValidUrl(order?.shipday_tracking_url);

  // Gmail receipt deep link — cross-platform
  const handleViewGmailReceipt = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (Platform.OS === 'ios') {
        const canOpenGmail = await Linking.canOpenURL('googlegmail://');
        if (canOpenGmail) {
          await Linking.openURL('googlegmail://');
          return;
        }
        const canOpenMail = await Linking.canOpenURL('message://');
        if (canOpenMail) {
          await Linking.openURL('message://');
          return;
        }
      }
      await Linking.openURL('https://mail.google.com/mail/');
    } catch (err) {
      console.log('Could not open mail app:', err);
      try {
        await Linking.openURL('mailto:');
      } catch (e) {
        console.log('Mailto fallback failed:', e);
      }
    }
  }, []);

  if (!order) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Order not found</Text></View>;
  }

  // ===== DELIVERY: Show WebView when tracking URL is available =====
  if (!isPickup && hasTrackingUrl && order.status !== 'delivered' && order.status !== 'cancelled') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.backBtn}>
            <MaterialIcons name="close" size={22} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Live Tracking</Text>
            <Text style={styles.headerSub}>{order.restaurant_name} · {order.order_number}</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveIndicator} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Compact status bar */}
        <View style={styles.statusBar}>
          <MaterialIcons
            name={order.status === 'on_the_way' ? 'delivery-dining' : order.status === 'preparing' ? 'restaurant' : 'check-circle'}
            size={18}
            color="#FFF"
          />
          <Text style={styles.statusBarText}>
            {order.status === 'on_the_way' ? 'Rider is on the way'
              : order.status === 'preparing' ? 'Restaurant is preparing your order'
              : order.status === 'confirmed' ? 'Searching for dispatch rider...'
              : 'Order in progress'}
          </Text>
          {order.shipday_eta ? (
            <Text style={styles.statusBarEta}>ETA: {order.shipday_eta}</Text>
          ) : order.estimated_delivery ? (
            <Text style={styles.statusBarEta}>{order.estimated_delivery}</Text>
          ) : null}
        </View>

        {/* Carrier info bar */}
        {order.shipday_carrier_name ? (
          <View style={styles.carrierBar}>
            <View style={styles.carrierAvatar}>
              <MaterialIcons name="person" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.carrierBarName}>{order.shipday_carrier_name}</Text>
              <Text style={styles.carrierBarLabel}>Your rider</Text>
            </View>
            {order.shipday_carrier_phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${order.shipday_carrier_phone}`)} style={styles.carrierCallBtn}>
                <MaterialIcons name="phone" size={18} color={theme.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* WebView - takes remaining space */}
        <View style={{ flex: 1, position: 'relative' }}>
          {webViewLoading ? (
            <View style={styles.webViewLoadingOverlay}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.webViewLoadingText}>Loading live tracking...</Text>
            </View>
          ) : null}
          <WebView
            source={{ uri: order.shipday_tracking_url! }}
            style={{ flex: 1 }}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>

        {/* Bottom actions */}
        <View style={[styles.webViewBottom, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={handleViewGmailReceipt} style={styles.gmailReceiptBtnCompact}>
            <MaterialIcons name="email" size={16} color="#EA4335" />
            <Text style={styles.gmailReceiptTextCompact}>View Receipt in Gmail</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ===== DELIVERY without tracking URL yet: Show "waiting for tracking" + timeline =====
  // ===== PICKUP or DELIVERED/CANCELLED: Status view =====

  const getPickupMessage = () => {
    if (!isPickup) return null;
    switch (order.status) {
      case 'pending': return 'Waiting for the restaurant to confirm your order';
      case 'confirmed': return 'Restaurant has accepted your order and will begin preparing it shortly';
      case 'preparing': return 'Restaurant is preparing your order';
      case 'on_the_way': return `Your order is ready! Head to ${order.restaurant_name} to collect it`;
      case 'delivered': return 'Order Complete — Enjoy your meal!';
      default: return null;
    }
  };

  // Show a "tracking loading" indicator for delivery orders that don't have a tracking URL yet
  const isWaitingForTracking = !isPickup && !hasTrackingUrl && order.status !== 'delivered' && order.status !== 'cancelled';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.backBtn}>
          <MaterialIcons name="close" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isPickup ? 'Pickup Tracking' : 'Order Tracking'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successBanner}>
          <View style={[styles.successIcon, {
            backgroundColor: order.status === 'delivered' ? theme.success
              : order.status === 'on_the_way' && isPickup ? '#2563EB'
              : order.status === 'pending' ? theme.warning : theme.primary
          }]}>
            <MaterialIcons
              name={
                order.status === 'delivered' ? 'check' :
                order.status === 'on_the_way' && isPickup ? 'storefront' :
                order.status === 'pending' ? 'hourglass-top' : 'restaurant'
              }
              size={28}
              color="#FFF"
            />
          </View>
          <Text style={styles.successTitle}>
            {order.status === 'pending' ? 'Order Placed!' :
             order.status === 'delivered' ? (isPickup ? 'Order Collected!' : 'Order Delivered!') :
             isPickup && order.status === 'on_the_way' ? 'Ready for Pickup!' :
             'Order in Progress'}
          </Text>
          <Text style={styles.successSub}>
            {isPickup ? (getPickupMessage() || '') :
             order.status === 'pending'
              ? 'Waiting for the restaurant to confirm'
              : expectedDeliveryTime ? `Expected delivery by ${expectedDeliveryTime}` : 'Preparing your order'}
          </Text>
        </View>

        {/* Searching for Dispatch Rider animation */}
        {isSearchingForRider ? (
          <View style={styles.riderSearchCard}>
            <View style={styles.radarContainer}>
              <Animated.View style={[styles.radarRing, ringStyle1]} />
              <Animated.View style={[styles.radarRing, ringStyle2]} />
              <Animated.View style={[styles.radarRing, ringStyle3]} />
              <Animated.View style={[styles.radarCenter, dotPulseStyle]}>
                <MaterialIcons name="delivery-dining" size={24} color="#FFF" />
              </Animated.View>
            </View>
            <Text style={styles.riderSearchTitle}>Searching for Dispatch Rider</Text>
            <Text style={styles.riderSearchSub}>Looking for the nearest available rider to pick up your order. This usually takes a moment.</Text>
          </View>
        ) : null}

        {/* Waiting for live tracking banner (delivery only, after rider assigned but no URL yet) */}
        {isWaitingForTracking && !isSearchingForRider ? (
          <View style={styles.trackingLoadingCard}>
            <View style={styles.trackingLoadingIcon}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackingLoadingTitle}>Setting up live tracking...</Text>
              <Text style={styles.trackingLoadingText}>
                Live map tracking will appear automatically once your rider is on the way.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Pickup location card */}
        {isPickup && (order.status === 'on_the_way' || order.status === 'preparing') ? (
          <View style={styles.pickupLocationCard}>
            <View style={styles.pickupLocationIcon}>
              <MaterialIcons name="storefront" size={24} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickupLocationName}>{order.restaurant_name}</Text>
              <Text style={styles.pickupLocationAddr}>
                {order.delivery_address?.replace('PICKUP: ', '') || 'Restaurant location'}
              </Text>
            </View>
            {order.status === 'on_the_way' ? (
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>READY</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Carrier info (delivery only, when no tracking URL) */}
        {!isPickup && order.shipday_carrier_name ? (
          <View style={styles.carrierCard}>
            <View style={styles.carrierAvatarLarge}>
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
          <View style={styles.infoRow}>
            <MaterialIcons name={isPickup ? 'storefront' : 'location-on'} size={18} color={theme.textMuted} />
            <Text style={styles.infoText}>
              {isPickup ? order.delivery_address?.replace('PICKUP: ', 'Pickup: ') : order.delivery_address}
            </Text>
          </View>
          <View style={styles.infoRow}><MaterialIcons name="receipt" size={18} color={theme.textMuted} /><Text style={styles.infoText}>{order.order_number}</Text></View>
          <View style={styles.infoRow}><MaterialIcons name="credit-card" size={18} color={theme.textMuted} /><Text style={styles.infoText}>Card Payment (Paystack)</Text></View>
          {isPickup ? (
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
          {/* Detailed price breakdown */}
          <View style={styles.breakdownSection}>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="restaurant-menu" size={14} color={theme.textMuted} />
                <Text style={styles.breakdownLabel}>Food Subtotal</Text>
              </View>
              <Text style={styles.breakdownVal}>{"\u20A6"}{order.subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="delivery-dining" size={14} color={theme.textMuted} />
                <Text style={styles.breakdownLabel}>Delivery Fee</Text>
              </View>
              <Text style={styles.breakdownVal}>
                {isPickup ? 'FREE' : `\u20A6${order.delivery_fee.toLocaleString()}`}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="apps" size={14} color={theme.textMuted} />
                <Text style={styles.breakdownLabel}>App Service Fee</Text>
              </View>
              <Text style={styles.breakdownVal}>{"\u20A6"}{order.service_fee.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="account-balance" size={14} color={theme.textMuted} />
                <Text style={styles.breakdownLabel}>Tax</Text>
              </View>
              <Text style={[styles.breakdownVal, { color: theme.success }]}>{"\u20A6"}0</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={styles.totalValue}>{"\u20A6"}{order.total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Gmail Receipt Nudge - only for delivered orders */}
        {order.status === 'delivered' ? (
          <Pressable onPress={handleViewGmailReceipt} style={styles.gmailReceiptBtn}>
            <MaterialIcons name="email" size={20} color="#EA4335" />
            <Text style={styles.gmailReceiptText}>View Receipt in Gmail</Text>
            <MaterialIcons name="open-in-new" size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}

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

function hasValidUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (url.includes('undefined') || url.includes('null')) return false;
  return true;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEE2E2' },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
  // Compact status bar for WebView mode
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8 },
  statusBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFF' },
  statusBarEta: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  // Carrier bar for WebView mode
  carrierBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  carrierAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  carrierBarName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  carrierBarLabel: { fontSize: 11, color: theme.textMuted },
  carrierCallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  // WebView loading
  webViewLoadingOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', gap: 12 },
  webViewLoadingText: { fontSize: 14, color: theme.textMuted, fontWeight: '500' },
  // Bottom actions for WebView mode
  webViewBottom: { paddingTop: 8, paddingHorizontal: 4, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.border },
  gmailReceiptBtnCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FEF2F2' },
  gmailReceiptTextCompact: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  // Tracking loading card
  trackingLoadingCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 16, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted, marginBottom: 16 },
  trackingLoadingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  trackingLoadingTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  trackingLoadingText: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  // Status view styles
  successBanner: { alignItems: 'center', paddingVertical: 24, backgroundColor: theme.primaryFaint, borderRadius: 20, marginBottom: 16 },
  successIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  successSub: { fontSize: 14, color: theme.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  pickupLocationCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16 },
  pickupLocationIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  pickupLocationName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  pickupLocationAddr: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  readyBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#10B981' },
  readyBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  carrierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginBottom: 16 },
  carrierAvatarLarge: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
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
  orderInfo: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 18, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  itemText: { fontSize: 14, color: theme.textSecondary, marginBottom: 6 },
  breakdownSection: { gap: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, color: theme.textSecondary },
  breakdownVal: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.primary },
  pickupBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EFF6FF' },
  pickupBadgeText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  gmailReceiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 16 },
  gmailReceiptText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
  reorderPromptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.primary },
  reorderPromptText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  reviewPromptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted, marginBottom: 12 },
  reviewPromptText: { fontSize: 15, fontWeight: '700', color: theme.primary },
  homeBtn: { backgroundColor: theme.backgroundDark, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Searching for Dispatch Rider
  riderSearchCard: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, borderRadius: 20, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5', marginBottom: 20 },
  radarContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  radarRing: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: theme.primary },
  radarCenter: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  riderSearchTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  riderSearchSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
});
