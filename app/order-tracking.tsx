import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence } from 'react-native-reanimated';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

const steps = [
  { key: 'confirmed', icon: 'check-circle', label: 'Order Confirmed', sub: 'Restaurant received your order' },
  { key: 'preparing', icon: 'restaurant', label: 'Preparing', sub: 'Chef is making your food' },
  { key: 'on_the_way', icon: 'delivery-dining', label: 'On the Way', sub: 'Rider is heading to you' },
  { key: 'delivered', icon: 'done-all', label: 'Delivered', sub: 'Enjoy your meal!' },
];

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { customerOrders, updateOrderStatus } = useApp();

  const order = customerOrders.find(o => o.id === orderId) || customerOrders[0];
  const [currentStep, setCurrentStep] = useState(0);
  const autoProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusIndex = steps.findIndex(s => s.key === order?.status);

  // Animate steps sequentially
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

  // Auto-progress order status every 8 seconds for demo
  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;

    autoProgressRef.current = setInterval(() => {
      const currentIdx = steps.findIndex(s => s.key === order.status);
      if (currentIdx >= 0 && currentIdx < steps.length - 1) {
        const nextStatus = steps[currentIdx + 1].key;
        updateOrderStatus(order.id, nextStatus);
      }
    }, 8000);

    return () => {
      if (autoProgressRef.current) clearInterval(autoProgressRef.current);
    };
  }, [order?.status, order?.id]);

  // Pulse animation for current step
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

  if (!order) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Order not found</Text></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(tabs)/orders')} style={styles.backBtn}>
          <MaterialIcons name="close" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.successBanner}>
        <View style={styles.successIcon}><MaterialIcons name="check" size={28} color="#FFF" /></View>
        <Text style={styles.successTitle}>Order Placed!</Text>
        <Text style={styles.successSub}>Estimated delivery: {order.estimated_delivery}</Text>
      </View>

      <View style={styles.timeline}>
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentStep;
          const isCurrent = idx === currentStep;
          return (
            <View key={step.key} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <Animated.View style={[
                  styles.timelineDot,
                  isCompleted && { backgroundColor: theme.primary },
                  isCurrent ? pulseStyle : undefined,
                ]}>
                  <MaterialIcons name={step.icon as any} size={20} color={isCompleted ? '#FFF' : theme.textMuted} />
                </Animated.View>
                {idx < steps.length - 1 ? <View style={[styles.timelineLine, isCompleted && { backgroundColor: theme.primary }]} /> : null}
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
        <View style={styles.divider} />
        {(order.order_items || []).map((item, idx) => (
          <Text key={idx} style={styles.itemText}>{item.quantity}x {item.name} — ₦{(item.price * item.quantity).toLocaleString()}</Text>
        ))}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>₦{order.total.toLocaleString()}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={() => router.replace('/(tabs)')} style={[styles.homeBtn, { marginBottom: insets.bottom + 16 }]}>
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  successBanner: { alignItems: 'center', paddingVertical: 28, backgroundColor: theme.primaryFaint, borderRadius: 20, marginBottom: 28 },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.success, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  successSub: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
  timeline: { marginBottom: 24 },
  timelineItem: { flexDirection: 'row', gap: 14 },
  timelineLeft: { alignItems: 'center', width: 44 },
  timelineDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, height: 32, backgroundColor: theme.border, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 24 },
  timelineLabel: { fontSize: 15, fontWeight: '500', color: theme.textMuted },
  timelineSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  orderInfo: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 18 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  itemText: { fontSize: 14, color: theme.textSecondary, marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.primary },
  homeBtn: { backgroundColor: theme.backgroundDark, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
