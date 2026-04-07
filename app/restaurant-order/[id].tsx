import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import { getImage } from '../../constants/images';
import { formatNigerianDate, formatNigerianTime } from '../../constants/timeUtils';
import { config } from '../../constants/config';
import { notifyPickupReady } from '../../services/pickupNotification';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

const stageConfig: Record<string, { icon: string; color: string; bg: string; label: string; description: string }> = {
  pending: { icon: 'hourglass-top', color: '#F59E0B', bg: '#FEF3C7', label: 'New Order', description: 'Waiting for you to accept this order' },
  confirmed: { icon: 'check-circle', color: '#3B82F6', bg: '#DBEAFE', label: 'Accepted', description: 'Order accepted. Start cooking when ready.' },
  preparing: { icon: 'restaurant', color: '#8B5CF6', bg: '#EDE9FE', label: 'Preparing', description: 'Food is being prepared in the kitchen' },
  on_the_way: { icon: 'delivery-dining', color: '#F59E0B', bg: '#FEF3C7', label: 'Picked Up', description: 'Rider has picked up the food' },
  delivered: { icon: 'done-all', color: '#10B981', bg: '#D1FAE5', label: 'Delivered', description: 'Order has been delivered to the customer' },
  cancelled: { icon: 'cancel', color: '#EF4444', bg: '#FEE2E2', label: 'Cancelled', description: 'This order has been cancelled' },
};

export default function RestaurantOrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { restaurantOrders, updateOrderStatus, refreshOrder } = useApp();
  const { showAlert } = useAlert();

  const [actionLoading, setActionLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [menuItemsMap, setMenuItemsMap] = useState<Record<string, any>>({});

  const order = restaurantOrders.find(o => o.id === id);

  // Fetch menu items for BOGO/promo info
  useEffect(() => {
    if (!order?.restaurant_id) return;
    const loadMenu = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('menu_items')
          .select('id, is_bogo, bogo_description, bogo_start, bogo_end')
          .eq('restaurant_id', order.restaurant_id);
        if (data) {
          const map: Record<string, any> = {};
          data.forEach((m: any) => { map[m.id] = m; });
          setMenuItemsMap(map);
        }
      } catch (err) {
        console.log('Menu load error:', err);
      }
    };
    loadMenu();
  }, [order?.restaurant_id]);

  // Poll for updates every 10s
  useEffect(() => {
    if (!id || !order || order.status === 'delivered' || order.status === 'cancelled') return;
    const interval = setInterval(() => { refreshOrder(id); }, 10000);
    return () => clearInterval(interval);
  }, [id, order?.status]);

  const stage = stageConfig[order?.status || 'pending'] || stageConfig.pending;
  const isPickup = order?.delivery_address?.startsWith('PICKUP:');
  const items = order?.order_items || [];

  const handleAccept = async () => {
    if (!order) return;
    setActionLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateOrderStatus(order.id, 'confirmed');
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!order) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showAlert('Decline Order?', 'This will cancel the order and initiate a refund to the customer.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Decline & Refund',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          // First cancel the order
          await updateOrderStatus(order.id, 'cancelled');

          // Then initiate refund
          try {
            const supabase = getSupabaseClient();
            const { data: refundData, error: refundError } = await supabase.functions.invoke('refund-order', {
              body: { order_id: order.id },
            });

            if (refundError) {
              let msg = refundError.message;
              if (refundError instanceof FunctionsHttpError) {
                try { msg = await refundError.context?.text() || msg; } catch {}
              }
              console.log('Refund note:', msg);
              showAlert('Order Declined', 'The order has been cancelled. Refund could not be processed automatically — please contact support if needed.');
            } else if (refundData?.refunded) {
              showAlert('Order Declined & Refunded', `The customer will receive a refund of ${"\u20A6"}${order.total.toLocaleString()}. This may take 3-5 business days.`);
            } else {
              showAlert('Order Declined', refundData?.message || 'The order has been cancelled and the customer has been notified.');
            }
          } catch (err) {
            console.log('Refund error:', err);
            showAlert('Order Declined', 'The order has been cancelled. If the customer was charged, a refund will be processed.');
          }

          setActionLoading(false);
          router.back();
        },
      },
    ]);
  };

  const handleStartPreparing = async () => {
    if (!order) return;
    setActionLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateOrderStatus(order.id, 'preparing');
    setActionLoading(false);
  };

  const handleReadyForPickup = async () => {
    if (!order) return;
    setActionLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateOrderStatus(order.id, 'on_the_way');
    setActionLoading(false);
  };

  const handleOrderPickedUp = async () => {
    if (!order) return;
    setActionLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateOrderStatus(order.id, 'delivered');
    setActionLoading(false);
  };

  const handleNotifyPickupReady = async () => {
    if (!order) return;
    setNotifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { success, error } = await notifyPickupReady(order.id);
    setNotifying(false);
    if (success) {
      showAlert('Customer Notified', 'The customer has been notified that their pickup order is ready.');
    } else {
      showAlert('Notification Failed', error || 'Could not notify the customer.');
    }
  };

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="error-outline" size={48} color="#666" />
          <Text style={{ fontSize: 16, color: '#FFF', marginTop: 12 }}>Order not found</Text>
        </View>
      </View>
    );
  }

  const timeStr = formatNigerianTime(new Date(order.created_at));
  const dateStr = formatNigerianDate(new Date(order.created_at), { year: undefined });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{order.order_number}</Text>
          <Text style={styles.headerSub}>{dateStr} at {timeStr}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: stage.bg }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: stage.color }]}>
            <MaterialIcons name={stage.icon as any} size={24} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: stage.color }]}>{stage.label}</Text>
            <Text style={styles.statusDesc}>{stage.description}</Text>
          </View>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.customerCard}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>{(order.customer_name || 'C').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{order.customer_name || 'Customer'}</Text>
              {order.customer_phone ? <Text style={styles.customerPhone}>{order.customer_phone}</Text> : null}
            </View>
            {isPickup ? (
              <View style={styles.pickupTag}><Text style={styles.pickupTagText}>Pickup</Text></View>
            ) : (
              <View style={styles.deliveryTag}><Text style={styles.deliveryTagText}>Delivery</Text></View>
            )}
          </View>
          {!isPickup ? (
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={16} color="#999" />
              <Text style={styles.addressText}>{order.delivery_address}</Text>
            </View>
          ) : null}
          {order.delivery_note ? (
            <View style={styles.noteRow}>
              <MaterialIcons name="edit-note" size={16} color="#999" />
              <Text style={styles.noteText}>{order.delivery_note}</Text>
            </View>
          ) : null}
        </View>

        {/* Items ordered */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered ({items.length})</Text>
          {items.map((item, idx) => {
            const menuImageKey = item.menu_item_id ? undefined : 'heroJollof';
            return (
              <View key={idx} style={styles.itemCard}>
                <Image source={getImage(menuImageKey || 'heroJollof')} style={styles.itemImage} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>{item.quantity}x {config.currency}{item.price.toLocaleString()} each</Text>
                  {item.menu_item_id && menuItemsMap[item.menu_item_id]?.is_bogo ? (
                    <View style={styles.bogoTag}>
                      <MaterialIcons name="local-offer" size={12} color="#D97706" />
                      <Text style={styles.bogoTagText}>
                        {menuItemsMap[item.menu_item_id]?.bogo_description || 'Buy One Get One Free'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.itemTotal}>{config.currency}{(item.price * item.quantity).toLocaleString()}</Text>
              </View>
            );
          })}
        </View>

        {/* Fee breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fee Breakdown</Text>
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="restaurant-menu" size={16} color="#999" />
                <Text style={styles.breakdownLabel}>Food Subtotal</Text>
              </View>
              <Text style={styles.breakdownVal}>{config.currency}{order.subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="delivery-dining" size={16} color="#999" />
                <Text style={styles.breakdownLabel}>Delivery Fee</Text>
              </View>
              <Text style={styles.breakdownVal}>{isPickup ? 'FREE' : `${config.currency}${order.delivery_fee.toLocaleString()}`}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="apps" size={16} color="#999" />
                <Text style={styles.breakdownLabel}>App Service Fee</Text>
              </View>
              <Text style={styles.breakdownVal}>{config.currency}{order.service_fee.toLocaleString()}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Customer Total</Text>
              <Text style={styles.totalVal}>{config.currency}{order.total.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Rider info (if assigned) */}
        {order.shipday_carrier_name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dispatch Rider</Text>
            <View style={styles.riderCard}>
              <View style={styles.riderAvatar}>
                <MaterialIcons name="delivery-dining" size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>{order.shipday_carrier_name}</Text>
                {order.shipday_carrier_phone ? <Text style={styles.riderPhone}>{order.shipday_carrier_phone}</Text> : null}
              </View>
              {order.shipday_eta ? (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaText}>ETA {order.shipday_eta}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
        {order.status === 'pending' ? (
          <View style={styles.actionRow}>
            <Pressable onPress={handleReject} disabled={actionLoading} style={[styles.rejectBtn, actionLoading && { opacity: 0.5 }]}>
              <MaterialIcons name="close" size={20} color="#EF4444" />
              <Text style={styles.rejectBtnText}>Decline</Text>
            </Pressable>
            <Pressable onPress={handleAccept} disabled={actionLoading} style={[styles.acceptBtn, actionLoading && { opacity: 0.5 }]}>
              {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <MaterialIcons name="check" size={20} color="#FFF" />
                  <Text style={styles.acceptBtnText}>Accept Order</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : order.status === 'confirmed' ? (
          <Pressable onPress={handleStartPreparing} disabled={actionLoading} style={[styles.primaryActionBtn, { backgroundColor: '#8B5CF6' }, actionLoading && { opacity: 0.5 }]}>
            {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
              <>
                <MaterialIcons name="restaurant" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>Start Preparing</Text>
              </>
            )}
          </Pressable>
        ) : order.status === 'preparing' ? (
          <View style={{ gap: 10 }}>
            <Pressable onPress={handleReadyForPickup} disabled={actionLoading} style={[styles.primaryActionBtn, { backgroundColor: '#2563EB' }, actionLoading && { opacity: 0.5 }]}>
              {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#FFF" />
                  <Text style={styles.primaryActionText}>{isPickup ? 'Ready for Customer Pickup' : 'Ready for Rider Pickup'}</Text>
                </>
              )}
            </Pressable>
            {isPickup ? (
              <Pressable onPress={handleNotifyPickupReady} disabled={notifying} style={[styles.secondaryActionBtn, notifying && { opacity: 0.5 }]}>
                <MaterialIcons name="notifications-active" size={18} color="#2563EB" />
                <Text style={styles.secondaryActionText}>{notifying ? 'Notifying...' : 'Notify Customer'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : order.status === 'on_the_way' && isPickup ? (
          <Pressable onPress={handleOrderPickedUp} disabled={actionLoading} style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }, actionLoading && { opacity: 0.5 }]}>
            {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
              <>
                <MaterialIcons name="done-all" size={20} color="#FFF" />
                <Text style={styles.primaryActionText}>Mark as Collected</Text>
              </>
            )}
          </Pressable>
        ) : order.status === 'delivered' || order.status === 'cancelled' ? (
          <View style={styles.completedBanner}>
            <MaterialIcons name={order.status === 'delivered' ? 'check-circle' : 'cancel'} size={20} color={order.status === 'delivered' ? '#10B981' : '#EF4444'} />
            <Text style={[styles.completedText, { color: order.status === 'delivered' ? '#10B981' : '#EF4444' }]}>
              {order.status === 'delivered' ? 'Order Completed' : 'Order Cancelled'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 12, color: '#999', marginTop: 2 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 8, marginBottom: 16, padding: 16, borderRadius: 16 },
  statusIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontSize: 18, fontWeight: '700' },
  statusDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  customerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  customerAvatarText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  customerPhone: { fontSize: 13, color: '#999', marginTop: 2 },
  pickupTag: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  pickupTagText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  deliveryTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deliveryTagText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingHorizontal: 4 },
  addressText: { flex: 1, fontSize: 13, color: '#999', lineHeight: 18 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, paddingHorizontal: 4, padding: 10, borderRadius: 10, backgroundColor: '#1A1A1A' },
  noteText: { flex: 1, fontSize: 13, color: '#CCC', lineHeight: 18, fontStyle: 'italic' },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  itemImage: { width: 56, height: 56, borderRadius: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  itemQty: { fontSize: 12, color: '#999', marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: theme.primary },
  breakdownCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  breakdownLabel: { fontSize: 14, color: '#999' },
  breakdownVal: { fontSize: 14, fontWeight: '600', color: '#CCC' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  totalVal: { fontSize: 20, fontWeight: '700', color: theme.primary },
  riderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,107,0,0.15)', alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  riderPhone: { fontSize: 13, color: '#999', marginTop: 2 },
  etaBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(255,107,0,0.15)' },
  etaText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  actionBar: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#0D0D0D', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  actionRow: { flexDirection: 'row', gap: 12 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#EF4444' },
  rejectBtnText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: theme.primary },
  acceptBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18, borderRadius: 14 },
  primaryActionText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  secondaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2563EB' },
  secondaryActionText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  completedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: '#1A1A1A' },
  completedText: { fontSize: 16, fontWeight: '700' },
  bogoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#FEF3C7', alignSelf: 'flex-start' },
  bogoTagText: { fontSize: 11, fontWeight: '600', color: '#D97706' },
});
