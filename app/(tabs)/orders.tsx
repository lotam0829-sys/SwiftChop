import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { DbOrder } from '../../services/supabaseData';
import { formatNigerianDate, formatNigerianTime, NIGERIA_TIMEZONE } from '../../constants/timeUtils';

const statusConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', icon: 'schedule', label: 'Pending' },
  confirmed: { color: '#3B82F6', bg: '#DBEAFE', icon: 'check-circle', label: 'Confirmed' },
  preparing: { color: '#8B5CF6', bg: '#EDE9FE', icon: 'restaurant', label: 'Preparing' },
  on_the_way: { color: '#F59E0B', bg: '#FEF3C7', icon: 'delivery-dining', label: 'On the Way' },
  delivered: { color: '#10B981', bg: '#D1FAE5', icon: 'done-all', label: 'Delivered' },
  cancelled: { color: '#EF4444', bg: '#FEE2E2', icon: 'cancel', label: 'Cancelled' },
};

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { customerOrders, loadingOrders, refreshCustomerOrders, reorder } = useApp();

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredOrders = useMemo(() => {
    let orders = customerOrders;

    // Status filter
    if (activeFilter === 'active') {
      orders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'on_the_way'].includes(o.status));
    } else if (activeFilter === 'delivered') {
      orders = orders.filter(o => o.status === 'delivered');
    } else if (activeFilter === 'cancelled') {
      orders = orders.filter(o => o.status === 'cancelled');
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(o =>
        o.restaurant_name.toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q) ||
        (o.order_items || []).some(i => i.name.toLowerCase().includes(q))
      );
    }

    return orders;
  }, [customerOrders, activeFilter, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshCustomerOrders();
    setRefreshing(false);
  }, [refreshCustomerOrders]);

  const handleOrderPress = useCallback((order: DbOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (['pending', 'confirmed', 'preparing', 'on_the_way'].includes(order.status)) {
      router.push({ pathname: '/order-tracking', params: { orderId: order.id } });
    }
  }, [router]);

  const handleReviewPress = useCallback((order: DbOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/review',
      params: {
        orderId: order.id,
        restaurantId: order.restaurant_id,
        restaurantName: order.restaurant_name,
      },
    });
  }, [router]);

  const handleReorder = useCallback(async (order: DbOrder) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await reorder(order);
    if (success) {
      router.push('/cart');
    }
  }, [reorder, router]);

  const filterCounts = useMemo(() => ({
    all: customerOrders.length,
    active: customerOrders.filter(o => ['pending', 'confirmed', 'preparing', 'on_the_way'].includes(o.status)).length,
    delivered: customerOrders.filter(o => o.status === 'delivered').length,
    cancelled: customerOrders.filter(o => o.status === 'cancelled').length,
  }), [customerOrders]);

  const renderOrder = ({ item }: { item: DbOrder }) => {
    const status = statusConfig[item.status] || statusConfig.pending;
    const date = new Date(item.created_at);
    const dateStr = formatNigerianDate(date);
    const timeStr = formatNigerianTime(date);
    const items = item.order_items || [];
    const isActive = ['pending', 'confirmed', 'preparing', 'on_the_way'].includes(item.status);
    const isDelivered = item.status === 'delivered';

    return (
      <Pressable onPress={() => handleOrderPress(item)} style={({ pressed }) => [styles.orderCard, pressed && isActive && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
        <View style={styles.orderHeader}>
          <Image source={getImage(item.restaurant_image_key)} style={styles.restaurantImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantName}>{item.restaurant_name}</Text>
            <Text style={styles.orderDate}>{dateStr} {"\u00B7"} {timeStr}</Text>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <MaterialIcons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.orderDivider} />
        <View style={styles.orderItems}>
          {items.slice(0, 3).map((i, idx) => (
            <Text key={idx} style={styles.itemText}>{i.quantity}x {i.name}</Text>
          ))}
          {items.length > 3 ? (
            <Text style={styles.moreItems}>+{items.length - 3} more items</Text>
          ) : null}
        </View>
        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{"\u20A6"}{item.total.toLocaleString()}</Text>
        </View>

        {/* Reorder + Review buttons for delivered orders */}
        {isDelivered ? (
          <View style={styles.deliveredActions}>
            <Pressable onPress={() => handleReorder(item)} style={styles.reorderBtn}>
              <MaterialIcons name="replay" size={16} color="#FFF" />
              <Text style={styles.reorderBtnText}>Reorder</Text>
            </Pressable>
            <Pressable onPress={() => handleReviewPress(item)} style={styles.reviewBtn}>
              <MaterialIcons name="star" size={16} color={theme.primary} />
              <Text style={styles.reviewBtnText}>Review</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Track button for active orders */}
        {isActive ? (
          <View style={styles.trackHint}>
            <MaterialIcons name="gps-fixed" size={14} color={theme.info} />
            <Text style={styles.trackHintText}>Tap to track your order</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>My Orders</Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setShowSearch(!showSearch); }}
          style={styles.searchToggle}
        >
          <MaterialIcons name={showSearch ? 'close' : 'search'} size={22} color={theme.textPrimary} />
        </Pressable>
      </View>

      {/* Search bar */}
      {showSearch ? (
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by restaurant, order #, or item..."
            placeholderTextColor={theme.textMuted}
            autoFocus
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Filter tabs */}
      <View style={styles.filtersRow}>
        {filterTabs.map((tab) => {
          const count = filterCounts[tab.key as keyof typeof filterCounts];
          const isActive = activeFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(tab.key); }}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{tab.label}</Text>
              {count > 0 ? (
                <View style={[styles.filterBadge, isActive && { backgroundColor: theme.primary }]}>
                  <Text style={[styles.filterBadgeText, isActive && { color: '#FFF' }]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {loadingOrders ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : filteredOrders.length > 0 ? (
        <FlashList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          estimatedItemSize={220}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={renderOrder}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      ) : (
        <View style={styles.emptyState}>
          {customerOrders.length > 0 ? (
            <>
              <MaterialIcons name="filter-list" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>No matching orders</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? `No results for "${searchQuery}"` : `No ${activeFilter} orders found`}
              </Text>
              <Pressable onPress={() => { setActiveFilter('all'); setSearchQuery(''); }} style={styles.clearFilterBtn}>
                <Text style={styles.clearFilterText}>Clear Filters</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Image source={require('../../assets/images/empty-orders.jpg')} style={styles.emptyImage} contentFit="contain" />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>Your order history will appear here once you place your first order</Text>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  searchToggle: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary },
  filtersRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary },
  filterChipActive: { backgroundColor: theme.primaryFaint },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: theme.primary },
  filterBadge: { backgroundColor: theme.border, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterBadgeText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, ...theme.shadow.medium },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restaurantImg: { width: 44, height: 44, borderRadius: 12 },
  restaurantName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  orderDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  orderNumber: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderDivider: { height: 1, backgroundColor: theme.borderLight, marginVertical: 12 },
  orderItems: { gap: 4, marginBottom: 12 },
  itemText: { fontSize: 14, color: theme.textSecondary },
  moreItems: { fontSize: 12, color: theme.textMuted, fontStyle: 'italic', marginTop: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: theme.textMuted, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  deliveredActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reorderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primary },
  reorderBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  reviewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted },
  reviewBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  trackHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8 },
  trackHintText: { fontSize: 12, color: theme.info, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyImage: { width: 200, height: 150, marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  clearFilterBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primaryFaint },
  clearFilterText: { fontSize: 14, fontWeight: '600', color: theme.primary },
});
