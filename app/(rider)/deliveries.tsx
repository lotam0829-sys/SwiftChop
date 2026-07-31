import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert, getSupabaseClient } from '@/template';
import { formatNigerianDate, formatNigerianTime } from '../../constants/timeUtils';

interface DeliveryOrder {
  id: string;
  order_number: string;
  restaurant_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  delivery_note: string | null;
  total: number;
  status: string;
  created_at: string;
  shipday_carrier_name: string | null;
  distance_km?: number;
  rider_payment_amount?: number;
  rider_payment_status?: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', label: 'Pending', icon: 'schedule' },
  confirmed: { color: '#3B82F6', bg: '#DBEAFE', label: 'Confirmed', icon: 'check-circle' },
  preparing: { color: '#8B5CF6', bg: '#EDE9FE', label: 'Preparing', icon: 'restaurant' },
  on_the_way: { color: '#F59E0B', bg: '#FEF3C7', label: 'In Transit', icon: 'delivery-dining' },
  delivered: { color: '#10B981', bg: '#D1FAE5', label: 'Delivered', icon: 'done-all' },
  cancelled: { color: '#EF4444', bg: '#FEE2E2', label: 'Cancelled', icon: 'cancel' },
};

/** Extract the 4-digit PIN from an order's delivery_note. Returns null if none found. */
function extractPin(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/\[PIN:\s*(\d{4})\]/i);
  return match ? match[1] : null;
}

export default function RiderDeliveriesScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();
  const { showAlert } = useAlert();

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  // PIN verification modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinTargetOrder, setPinTargetOrder] = useState<DeliveryOrder | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const pinInputs = useRef<Array<TextInput | null>>([null, null, null, null]);

  const fetchDeliveries = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();

      const { data: payments } = await supabase
        .from('rider_payments')
        .select('order_id, amount, status, distance_km')
        .eq('rider_id', userProfile.id)
        .eq('payment_type', 'delivery')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!payments || payments.length === 0) {
        setDeliveries([]);
        return;
      }

      const orderIds = payments.map(p => p.order_id);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, restaurant_name, customer_name, customer_phone, delivery_address, delivery_note, total, status, created_at, shipday_carrier_name')
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      const orderMap = new Map((orders || []).map(o => [o.id, o]));
      const merged: DeliveryOrder[] = payments
        .filter(p => orderMap.has(p.order_id))
        .map(p => {
          const order = orderMap.get(p.order_id)!;
          return {
            ...order,
            distance_km: p.distance_km,
            rider_payment_amount: p.amount,
            rider_payment_status: p.status,
          };
        });

      setDeliveries(merged);
    } catch (err) {
      console.log('Fetch deliveries error:', err);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchDeliveries();
      setLoading(false);
    };
    load();
  }, [fetchDeliveries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliveries();
    setRefreshing(false);
  };

  const filtered = deliveries.filter(d => {
    if (activeTab === 'active') return !['delivered', 'cancelled'].includes(d.status);
    if (activeTab === 'completed') return ['delivered', 'cancelled'].includes(d.status);
    return true;
  });

  const openPinModal = (order: DeliveryOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPinTargetOrder(order);
    setPinDigits(['', '', '', '']);
    setPinError(null);
    setPinModalOpen(true);
    // Focus first input shortly after opening
    setTimeout(() => { pinInputs.current[0]?.focus(); }, 250);
  };

  const closePinModal = () => {
    setPinModalOpen(false);
    setPinTargetOrder(null);
    setPinDigits(['', '', '', '']);
    setPinError(null);
    setConfirmingDelivery(false);
  };

  const handlePinDigitChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError(null);
    if (digit && index < 3) {
      pinInputs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputs.current[index - 1]?.focus();
      const next = [...pinDigits];
      next[index - 1] = '';
      setPinDigits(next);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!pinTargetOrder) return;

    const enteredPin = pinDigits.join('');
    if (enteredPin.length !== 4) {
      setPinError('Please enter all 4 digits');
      return;
    }

    const expectedPin = extractPin(pinTargetOrder.delivery_note);

    if (!expectedPin) {
      // Legacy order without PIN — allow completion but warn
      showAlert(
        'No PIN on Order',
        'This order does not have a delivery PIN (older order). Confirm delivery anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => finalizeDelivery(pinTargetOrder.id) },
        ]
      );
      return;
    }

    if (enteredPin !== expectedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPinError('Incorrect PIN. Ask the customer to share it again.');
      setPinDigits(['', '', '', '']);
      pinInputs.current[0]?.focus();
      return;
    }

    // PIN correct — mark delivered
    await finalizeDelivery(pinTargetOrder.id);
  };

  const finalizeDelivery = async (orderId: string) => {
    setConfirmingDelivery(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) {
        console.log('Delivery confirm error:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinError('Could not update order. Please try again.');
        setConfirmingDelivery(false);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closePinModal();
      showAlert('Delivery Confirmed', 'The order has been marked as delivered. Your payment will be processed shortly.');
      await fetchDeliveries();
    } catch (err) {
      console.log('Finalize delivery error:', err);
      setPinError('Something went wrong. Please try again.');
      setConfirmingDelivery(false);
    }
  };

  const renderDelivery = ({ item }: { item: DeliveryOrder }) => {
    const cfg = statusConfig[item.status] || statusConfig.pending;
    const date = new Date(item.created_at);
    const isPickup = item.delivery_address?.startsWith('PICKUP:');
    const canConfirmDelivery = item.status === 'on_the_way' && !isPickup;

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderId}>{item.order_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
            <Text style={styles.dateText}>{formatNigerianDate(date)} {"\u00B7"} {formatNigerianTime(date)}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <MaterialIcons name="person" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{item.customer_name || 'Customer'}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={16} color="#6B7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {isPickup ? 'Pickup Order' : item.delivery_address}
            </Text>
          </View>
          {item.distance_km ? (
            <View style={styles.detailRow}>
              <MaterialIcons name="straighten" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{item.distance_km} km</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.earningLabel}>Your Earning</Text>
            <Text style={styles.earningAmount}>{"\u20A6"}{(item.rider_payment_amount || 0).toLocaleString()}</Text>
          </View>
          <View style={[styles.paymentStatusBadge, { 
            backgroundColor: item.rider_payment_status === 'completed' ? '#ECFDF5' 
              : item.rider_payment_status === 'pending' ? '#FEF3C7' : '#F3F4F6' 
          }]}>
            <MaterialIcons 
              name={item.rider_payment_status === 'completed' ? 'check-circle' : 'hourglass-top'} 
              size={14} 
              color={item.rider_payment_status === 'completed' ? '#10B981' : '#F59E0B'} 
            />
            <Text style={[styles.paymentStatusText, { 
              color: item.rider_payment_status === 'completed' ? '#10B981' : '#F59E0B' 
            }]}>
              {item.rider_payment_status === 'completed' ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Confirm Delivery CTA (only for in-transit delivery orders) */}
        {canConfirmDelivery ? (
          <Pressable
            onPress={() => openPinModal(item)}
            style={({ pressed }) => [styles.confirmDeliveryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
            <MaterialIcons name="verified-user" size={18} color="#FFF" />
            <Text style={styles.confirmDeliveryBtnText}>Confirm Delivery with PIN</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const currentPin = pinDigits.join('');

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>My Deliveries</Text>
        <Text style={styles.subtitle}>{deliveries.length} total deliveries</Text>
      </View>

      <View style={styles.tabsRow}>
        {(['active', 'completed', 'all'] as const).map(tab => {
          const count = tab === 'active' ? deliveries.filter(d => !['delivered', 'cancelled'].includes(d.status)).length
            : tab === 'completed' ? deliveries.filter(d => ['delivered', 'cancelled'].includes(d.status)).length
            : deliveries.length;
          return (
            <Pressable
              key={tab}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'active' ? 'Active' : tab === 'completed' ? 'Completed' : 'All'}
              </Text>
              {count > 0 ? (
                <View style={[styles.tabBadge, activeTab === tab && { backgroundColor: '#10B981' }]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab && { color: '#FFF' }]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={item => item.id}
          estimatedItemSize={220}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={renderDelivery}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="delivery-dining" size={40} color="#6B7280" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'active' ? 'No active deliveries' : activeTab === 'completed' ? 'No completed deliveries' : 'No deliveries yet'}
              </Text>
              <Text style={styles.emptySub}>
                Accept delivery requests on Shipday Drive to see them here.
              </Text>
            </View>
          }
        />
      )}

      {/* PIN Verification Modal */}
      <Modal visible={pinModalOpen} transparent animationType="fade" onRequestClose={closePinModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <MaterialIcons name="verified-user" size={28} color="#10B981" />
              </View>
              <Pressable onPress={closePinModal} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={22} color="#9CA3AF" />
              </Pressable>
            </View>

            <Text style={styles.modalTitle}>Confirm Delivery</Text>
            <Text style={styles.modalSubtitle}>
              Ask <Text style={{ color: '#FFF', fontWeight: '700' }}>{pinTargetOrder?.customer_name || 'the customer'}</Text> for their 4-digit delivery PIN and enter it below.
            </Text>

            {pinTargetOrder?.order_number ? (
              <View style={styles.orderRefRow}>
                <MaterialIcons name="receipt-long" size={14} color="#6B7280" />
                <Text style={styles.orderRefText}>Order {pinTargetOrder.order_number}</Text>
              </View>
            ) : null}

            <View style={styles.pinInputRow}>
              {pinDigits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { pinInputs.current[i] = ref; }}
                  style={[styles.pinInputBox, digit ? styles.pinInputBoxFilled : null, pinError ? styles.pinInputBoxError : null]}
                  value={digit}
                  onChangeText={val => handlePinDigitChange(i, val)}
                  onKeyPress={({ nativeEvent }) => handlePinKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectionColor="#10B981"
                  autoFocus={i === 0}
                />
              ))}
            </View>

            {pinError ? (
              <View style={styles.pinErrorRow}>
                <MaterialIcons name="error-outline" size={14} color="#EF4444" />
                <Text style={styles.pinErrorText}>{pinError}</Text>
              </View>
            ) : (
              <Text style={styles.pinHelperText}>
                The PIN was shared with the customer at checkout. Do not confirm before handing over the food.
              </Text>
            )}

            <Pressable
              onPress={handleConfirmDelivery}
              disabled={confirmingDelivery || currentPin.length !== 4}
              style={({ pressed }) => [
                styles.confirmBtn,
                (confirmingDelivery || currentPin.length !== 4) && { opacity: 0.5 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              {confirmingDelivery ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#FFF" />
                  <Text style={styles.confirmBtnText}>Mark as Delivered</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={closePinModal} disabled={confirmingDelivery} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  titleBar: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A' },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#10B981' },
  tabBadge: { backgroundColor: '#2A2A2A', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  deliveryCard: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  cardHeader: { flexDirection: 'row' },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orderId: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  restaurantName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  dateText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 12 },
  detailsSection: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  earningLabel: { fontSize: 11, color: '#6B7280' },
  earningAmount: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  paymentStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  paymentStatusText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19, paddingHorizontal: 32 },

  // Confirm delivery button
  confirmDeliveryBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  confirmDeliveryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#9CA3AF', lineHeight: 20, marginBottom: 12 },
  orderRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#111111',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  orderRefText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  pinInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  pinInputBox: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#111111',
    borderWidth: 2,
    borderColor: '#2A2A2A',
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  pinInputBoxFilled: { borderColor: '#10B981' },
  pinInputBoxError: { borderColor: '#EF4444' },
  pinErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  pinErrorText: { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },
  pinHelperText: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 20 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#10B981',
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
});
