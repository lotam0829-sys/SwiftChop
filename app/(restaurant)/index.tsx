import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import { updateRestaurant } from '../../services/supabaseData';

export default function RestaurantDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { userProfile, restaurantOrders, restaurantMenuItems, loadingRestaurantData, ownerRestaurant, refreshRestaurantData } = useApp();

  const todayOrders = restaurantOrders.filter(o => {
    const d = new Date(o.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  // Revenue only counts delivered orders — not pending, preparing, or cancelled
  const todayDelivered = todayOrders.filter(o => o.status === 'delivered');
  const todayRevenue = todayDelivered.reduce((s, o) => s + o.subtotal, 0);
  const pendingCount = restaurantOrders.filter(o => o.status === 'pending').length;
  const preparingCount = restaurantOrders.filter(o => o.status === 'preparing' || o.status === 'confirmed').length;

  // Analytics
  const weekOrders = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    return restaurantOrders.filter(o => new Date(o.created_at) >= weekAgo);
  }, [restaurantOrders]);
  // Only count delivered orders for revenue
  const weekDelivered = weekOrders.filter(o => o.status === 'delivered');
  const weekRevenue = weekDelivered.reduce((s, o) => s + o.subtotal, 0);
  const avgOrderValue = weekDelivered.length > 0 ? Math.round(weekRevenue / weekDelivered.length) : 0;

  // Popular items
  const popularItems = useMemo(() => {
    const counts: Record<string, { name: string; count: number; revenue: number }> = {};
    restaurantOrders.forEach(o => {
      (o.order_items || []).forEach(item => {
        if (!counts[item.name]) counts[item.name] = { name: item.name, count: 0, revenue: 0 };
        counts[item.name].count += item.quantity;
        counts[item.name].revenue += item.price * item.quantity;
      });
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [restaurantOrders]);

  const statCards = [
    { label: "Today's Orders", value: todayOrders.length.toString(), icon: 'receipt-long', color: '#3B82F6', bg: '#DBEAFE' },
    { label: 'Revenue', value: `\u20A6${(todayRevenue / 1000).toFixed(1)}k`, icon: 'account-balance-wallet', color: '#10B981', bg: '#D1FAE5' },
    { label: 'Pending', value: pendingCount.toString(), icon: 'hourglass-top', color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'Preparing', value: preparingCount.toString(), icon: 'restaurant', color: '#8B5CF6', bg: '#EDE9FE' },
  ];

  const handleToggleStatus = async () => {
    if (!ownerRestaurant) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newStatus = !ownerRestaurant.is_open;
    await updateRestaurant(ownerRestaurant.id, { is_open: newStatus } as any);
    await refreshRestaurantData();
    showAlert(newStatus ? 'Restaurant is now Open' : 'Restaurant is now Closed');
  };

  if (loadingRestaurantData) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  const isOpen = ownerRestaurant?.is_open ?? true;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} {"\uD83D\uDC68\u200D\uD83C\uDF73"}</Text>
            <Text style={styles.restaurantName}>{ownerRestaurant?.name || userProfile?.restaurant_name || 'My Restaurant'}</Text>
          </View>
          <Pressable onPress={handleToggleStatus} style={[styles.statusBadge, !isOpen && { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <View style={[styles.statusDot, !isOpen && { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.statusText, !isOpen && { color: '#EF4444' }]}>{isOpen ? 'Open' : 'Closed'}</Text>
          </Pressable>
        </View>

        <LinearGradient colors={['#1A1A1A', '#111']} style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.revenueLabel}>{"TODAY'S REVENUE"}</Text>
              <Text style={styles.revenueValue}>{"\u20A6"}{todayRevenue.toLocaleString()}</Text>
            </View>
            <View style={styles.revenueIconWrap}>
              <MaterialIcons name="trending-up" size={28} color={theme.primary} />
            </View>
          </View>
          <View style={styles.revenueMeta}>
            <Text style={styles.revenueMetaText}>{todayDelivered.length} completed today</Text>
            <Text style={styles.revenueMetaText}>{"\u00B7"}</Text>
            <Text style={styles.revenueMetaText}>{restaurantMenuItems.filter(i => i.is_available).length} items live</Text>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          {statCards.map((stat, idx) => (
            <View key={idx} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                <MaterialIcons name={stat.icon as any} size={22} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Analytics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.analyticsRow}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{weekOrders.length}</Text>
              <Text style={styles.analyticsLabel}>Orders</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{"\u20A6"}{(weekRevenue / 1000).toFixed(1)}k</Text>
              <Text style={styles.analyticsLabel}>Revenue</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsValue}>{"\u20A6"}{avgOrderValue.toLocaleString()}</Text>
              <Text style={styles.analyticsLabel}>Avg. Order</Text>
            </View>
          </View>
        </View>

        {/* Popular Items */}
        {popularItems.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Sellers</Text>
            {popularItems.map((item, idx) => (
              <View key={idx} style={styles.popularRow}>
                <View style={styles.popularRank}>
                  <Text style={styles.popularRankText}>#{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.popularName}>{item.name}</Text>
                  <Text style={styles.popularMeta}>{item.count} sold {"\u00B7"} {"\u20A6"}{item.revenue.toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {restaurantOrders.length === 0 ? (
            <Text style={{ color: '#666', fontSize: 14 }}>No orders yet. They will appear here when customers order.</Text>
          ) : null}
          {restaurantOrders.slice(0, 5).map((order) => {
            const statusColors: Record<string, string> = {
              pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
              on_the_way: '#F59E0B', delivered: '#10B981', cancelled: '#EF4444',
            };
            const items = order.order_items || [];
            return (
              <View key={order.id} style={styles.orderRow}>
                <View style={[styles.orderDot, { backgroundColor: statusColors[order.status] || '#999' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCustomer}>{order.customer_name || 'Customer'}</Text>
                  <Text style={styles.orderItems} numberOfLines={1}>
                    {items.map(i => `${i.quantity}x ${i.name}`).join(', ') || 'Order items'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.orderTotal}>{"\u20A6"}{order.total.toLocaleString()}</Text>
                  <Text style={[styles.orderStatus, { color: statusColors[order.status] }]}>
                    {order.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(restaurant)/menu'); }}>
              <MaterialIcons name="add-circle" size={28} color={theme.primary} />
              <Text style={styles.actionLabel}>Add Item</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={handleToggleStatus}>
              <MaterialIcons name={isOpen ? 'toggle-on' : 'toggle-off'} size={28} color={isOpen ? '#10B981' : '#EF4444'} />
              <Text style={styles.actionLabel}>{isOpen ? 'Open' : 'Closed'}</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(restaurant)/orders'); }}>
              <MaterialIcons name="receipt-long" size={28} color="#3B82F6" />
              <Text style={styles.actionLabel}>Orders</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  greeting: { fontSize: 14, color: '#999', marginBottom: 4 },
  restaurantName: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  statusText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  revenueCard: { marginHorizontal: 16, borderRadius: 20, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: '#2A2A2A' },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  revenueLabel: { fontSize: 11, fontWeight: '600', color: '#666', letterSpacing: 1, textTransform: 'uppercase' },
  revenueValue: { fontSize: 36, fontWeight: '700', color: '#FFF', marginTop: 4 },
  revenueIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  revenueMeta: { flexDirection: 'row', gap: 8, marginTop: 16 },
  revenueMetaText: { fontSize: 13, color: '#999' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  statIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4, fontWeight: '500' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  // Analytics
  analyticsRow: { flexDirection: 'row', gap: 10 },
  analyticsCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  analyticsValue: { fontSize: 20, fontWeight: '700', color: theme.primary },
  analyticsLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  // Popular
  popularRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  popularRank: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  popularRankText: { fontSize: 13, fontWeight: '700', color: theme.primary },
  popularName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  popularMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  // Orders
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderCustomer: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  orderItems: { fontSize: 13, color: '#999', marginTop: 2 },
  orderTotal: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  orderStatus: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 18, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#CCC' },
});
