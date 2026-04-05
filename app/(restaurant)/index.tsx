import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function RestaurantDashboard() {
  const insets = useSafeAreaInsets();
  const { user, restaurantOrders, restaurantMenuItems } = useApp();

  const todayOrders = restaurantOrders.filter(o => {
    const d = new Date(o.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const pendingCount = restaurantOrders.filter(o => o.status === 'pending').length;
  const preparingCount = restaurantOrders.filter(o => o.status === 'preparing' || o.status === 'confirmed').length;

  const statCards = [
    { label: "Today's Orders", value: todayOrders.length.toString(), icon: 'receipt-long', color: '#3B82F6', bg: '#DBEAFE' },
    { label: 'Revenue', value: `₦${(todayRevenue / 1000).toFixed(1)}k`, icon: 'account-balance-wallet', color: '#10B981', bg: '#D1FAE5' },
    { label: 'Pending', value: pendingCount.toString(), icon: 'hourglass-top', color: '#F59E0B', bg: '#FEF3C7' },
    { label: 'Preparing', value: preparingCount.toString(), icon: 'restaurant', color: '#8B5CF6', bg: '#EDE9FE' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'} 👨‍🍳</Text>
            <Text style={styles.restaurantName}>{user?.restaurantName || 'My Restaurant'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Open</Text>
          </View>
        </View>

        {/* Revenue Card */}
        <LinearGradient colors={['#1A1A1A', '#111']} style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.revenueLabel}>TODAY'S REVENUE</Text>
              <Text style={styles.revenueValue}>₦{todayRevenue.toLocaleString()}</Text>
            </View>
            <View style={styles.revenueIconWrap}>
              <MaterialIcons name="trending-up" size={28} color={theme.primary} />
            </View>
          </View>
          <View style={styles.revenueMeta}>
            <Text style={styles.revenueMetaText}>{todayOrders.length} orders today</Text>
            <Text style={styles.revenueMetaText}>·</Text>
            <Text style={styles.revenueMetaText}>{restaurantMenuItems.filter(i => i.isAvailable).length} items live</Text>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
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

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {restaurantOrders.slice(0, 5).map((order) => {
            const statusColors: Record<string, string> = {
              pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
              on_the_way: '#F59E0B', delivered: '#10B981', cancelled: '#EF4444',
            };
            return (
              <View key={order.id} style={styles.orderRow}>
                <View style={[styles.orderDot, { backgroundColor: statusColors[order.status] || '#999' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCustomer}>{order.customerName || 'Customer'}</Text>
                  <Text style={styles.orderItems} numberOfLines={1}>
                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.orderTotal}>₦{order.total.toLocaleString()}</Text>
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
            <Pressable style={styles.actionCard}>
              <MaterialIcons name="add-circle" size={28} color={theme.primary} />
              <Text style={styles.actionLabel}>Add Item</Text>
            </Pressable>
            <Pressable style={styles.actionCard}>
              <MaterialIcons name="toggle-on" size={28} color="#10B981" />
              <Text style={styles.actionLabel}>Status</Text>
            </Pressable>
            <Pressable style={styles.actionCard}>
              <MaterialIcons name="bar-chart" size={28} color="#3B82F6" />
              <Text style={styles.actionLabel}>Analytics</Text>
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
