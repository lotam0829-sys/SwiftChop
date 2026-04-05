import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { DbOrder } from '../../services/supabaseData';
import { notifyPickupReady } from '../../services/pickupNotification';
import { useAlert } from '@/template';

const statusTabs = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'delivered', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusConfig: Record<string, { color: string; bg: string; label: string; next?: string; nextLabel?: string }> = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', label: 'New Order', next: 'confirmed', nextLabel: 'Accept' },
  confirmed: { color: '#3B82F6', bg: '#DBEAFE', label: 'Confirmed', next: 'preparing', nextLabel: 'Start Preparing' },
  preparing: { color: '#8B5CF6', bg: '#EDE9FE', label: 'Preparing', next: 'on_the_way', nextLabel: 'Ready for Pickup' },
  on_the_way: { color: '#F59E0B', bg: '#FEF3C7', label: 'On the Way' },
  delivered: { color: '#10B981', bg: '#D1FAE5', label: 'Delivered' },
  cancelled: { color: '#EF4444', bg: '#FEE2E2', label: 'Cancelled' },
};

export default function RestaurantOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { restaurantOrders, updateOrderStatus, refreshRestaurantData } = useApp();
  const { showAlert } = useAlert();
  const [notifyingOrderId, setNotifyingOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    let orders = restaurantOrders;

    // Status filter
    if (activeTab !== 'all') {
      orders = orders.filter(o => o.status === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      orders = orders.filter(o =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q) ||
        o.delivery_address.toLowerCase().includes(q) ||
        (o.order_items || []).some(i => i.name.toLowerCase().includes(q))
      );
    }

    return orders;
  }, [restaurantOrders, activeTab, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRestaurantData();
    setRefreshing(false);
  }, [refreshRestaurantData]);

  const todayOrders = useMemo(() => {
    const today = new Date().toDateString();
    return restaurantOrders.filter(o => new Date(o.created_at).toDateString() === today);
  }, [restaurantOrders]);

  const todayRevenue = useMemo(() => {
    return todayOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
  }, [todayOrders]);

  const renderOrder = ({ item }: { item: DbOrder }) => {
    const config = statusConfig[item.status] || statusConfig.pending;
    const time = new Date(item.created_at);
    const dateStr = time.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
    const timeStr = time.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    const items = item.order_items || [];

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderId}>{item.order_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>
            <Text style={styles.customerName}>{item.customer_name || 'Customer'}</Text>
            <Text style={styles.orderTime}>{dateStr} {"\u00B7"} {timeStr}</Text>
          </View>
          <Text style={styles.orderTotal}>{"\u20A6"}{item.total.toLocaleString()}</Text>
        </View>

        <View style={styles.itemsList}>
          {items.slice(0, 4).map((i, idx) => (
            <Text key={idx} style={styles.itemText}>{i.quantity}x {i.name}</Text>
          ))}
          {items.length > 4 ? (
            <Text style={styles.moreItems}>+{items.length - 4} more</Text>
          ) : null}
        </View>

        <View style={styles.addressRow}>
          <MaterialIcons name={item.delivery_address?.startsWith('PICKUP:') ? 'storefront' : 'location-on'} size={16} color="#999" />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.delivery_address?.startsWith('PICKUP:') ? item.delivery_address.replace('PICKUP: ', 'Pickup: ') : item.delivery_address}
          </Text>
          {item.delivery_address?.startsWith('PICKUP:') ? (
            <View style={styles.pickupTag}>
              <Text style={styles.pickupTagText}>Pickup</Text>
            </View>
          ) : null}
        </View>

        {config.next ? (
          <View style={styles.actionsRow}>
            {item.status === 'pending' ? (
              <Pressable
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); updateOrderStatus(item.id, 'cancelled'); }}
                style={styles.rejectBtn}
              >
                <Text style={styles.rejectText}>Decline</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateOrderStatus(item.id, config.next as string); }}
              style={[styles.acceptBtn, { flex: item.status === 'pending' ? 1 : undefined }]}
            >
              <Text style={styles.acceptText}>{config.nextLabel}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Pickup Ready Notification Button */}
        {item.delivery_address?.startsWith('PICKUP:') && (item.status === 'preparing' || item.status === 'confirmed') ? (
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setNotifyingOrderId(item.id);
              const { success, error } = await notifyPickupReady(item.id);
              setNotifyingOrderId(null);
              if (success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert('Customer Notified', 'The customer has been notified that their pickup order is ready.');
              } else {
                showAlert('Notification Failed', error || 'Could not notify the customer. They may not have notifications enabled.');
              }
            }}
            style={styles.notifyPickupBtn}
            disabled={notifyingOrderId === item.id}
          >
            <MaterialIcons name="notifications-active" size={18} color="#2563EB" />
            <Text style={styles.notifyPickupText}>
              {notifyingOrderId === item.id ? 'Notifying...' : 'Notify Ready for Pickup'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleBar}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.count}>{restaurantOrders.length} total {"\u00B7"} {todayOrders.length} today {"\u00B7"} {"\u20A6"}{todayRevenue.toLocaleString()} revenue</Text>
        </View>
        <Pressable onPress={() => { Haptics.selectionAsync(); setShowSearch(!showSearch); }} style={styles.searchToggle}>
          <MaterialIcons name={showSearch ? 'close' : 'search'} size={22} color="#FFF" />
        </Pressable>
      </View>

      {/* Search bar */}
      {showSearch ? (
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by customer, order #, or item..."
            placeholderTextColor="#666"
            autoFocus
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color="#999" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.tabsContainer}>
        {statusTabs.map((tab) => {
          const count = tab.key === 'all' ? restaurantOrders.length : restaurantOrders.filter(o => o.status === tab.key).length;
          return (
            <Pressable key={tab.key} onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }} style={[styles.tab, activeTab === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              {count > 0 ? (
                <View style={[styles.tabBadge, activeTab === tab.key && { backgroundColor: theme.primary }]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && { color: '#FFF' }]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        estimatedItemSize={220}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        renderItem={renderOrder}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color="#555" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching orders' : 'No orders'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? `No results for "${searchQuery}"` : 'Orders will appear here when customers place them'}
            </Text>
            {searchQuery ? (
              <Pressable onPress={() => { setSearchQuery(''); setActiveTab('all'); }} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear Filters</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  count: { fontSize: 12, color: '#999', marginTop: 4 },
  searchToggle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: '#1A1A1A', paddingHorizontal: 14, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  searchInput: { flex: 1, fontSize: 14, color: '#FFF' },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 14, gap: 6, flexWrap: 'wrap' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A' },
  tabActive: { backgroundColor: 'rgba(255,107,0,0.15)' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#999' },
  tabTextActive: { color: theme.primary },
  tabBadge: { backgroundColor: '#2A2A2A', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#999' },
  orderCard: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  orderIdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  orderId: { fontSize: 12, fontWeight: '600', color: '#666' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  customerName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  orderTime: { fontSize: 12, color: '#999', marginTop: 2 },
  orderTotal: { fontSize: 18, fontWeight: '700', color: theme.primary },
  itemsList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A', gap: 4 },
  itemText: { fontSize: 14, color: '#CCC' },
  moreItems: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 2 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  addressText: { fontSize: 13, color: '#999', flex: 1 },
  pickupTag: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pickupTagText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rejectBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444' },
  rejectText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  acceptBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' },
  acceptText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' },
  clearBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.15)' },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  notifyPickupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#93C5FD' },
  notifyPickupText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
});
