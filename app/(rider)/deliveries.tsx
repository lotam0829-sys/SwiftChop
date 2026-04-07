import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getSupabaseClient } from '@/template';
import { formatNigerianDate, formatNigerianTime } from '../../constants/timeUtils';

interface DeliveryOrder {
  id: string;
  order_number: string;
  restaurant_name: string;
  customer_name: string | null;
  delivery_address: string;
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

export default function RiderDeliveriesScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'all'>('active');

  const fetchDeliveries = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();

      // Fetch rider's delivery payments to find associated orders
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
        .select('id, order_number, restaurant_name, customer_name, delivery_address, total, status, created_at, shipday_carrier_name')
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

  const renderDelivery = ({ item }: { item: DeliveryOrder }) => {
    const cfg = statusConfig[item.status] || statusConfig.pending;
    const date = new Date(item.created_at);

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
              {item.delivery_address?.startsWith('PICKUP:') ? 'Pickup Order' : item.delivery_address}
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
      </View>
    );
  };

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
          estimatedItemSize={200}
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
});
