import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { DbOrder } from '../../services/supabaseData';
import { useAlert } from '@/template';
import { formatNigerianDate, formatNigerianTime } from '../../constants/timeUtils';

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

// Generate a short alert tone programmatically using expo-av
async function playNewOrderAlert() {
  try {
    // Use system notification sound via a short beep pattern
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/536/536420_4921277-lq.mp3' },
      { shouldPlay: true, volume: 1.0 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (err) {
    console.log('Alert sound error:', err);
    // Fallback: heavy haptic if sound fails
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

export default function RestaurantOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { restaurantOrders, updateOrderStatus, refreshRestaurantData, deleteOrders } = useApp();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // === 15-SECOND AUTO-REFRESH POLLING ===
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPendingCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);

  const pendingCount = useMemo(
    () => restaurantOrders.filter(o => o.status === 'pending').length,
    [restaurantOrders]
  );

  // Track pending count changes and play alert for NEW pending orders
  useEffect(() => {
    if (isInitialLoadRef.current) {
      // First load — set baseline, no alert
      prevPendingCountRef.current = pendingCount;
      isInitialLoadRef.current = false;
      return;
    }

    if (pendingCount > prevPendingCountRef.current) {
      // New pending order(s) arrived
      playNewOrderAlert();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingCount]);

  // Start/stop polling based on screen focus and app state
  useEffect(() => {
    const startPolling = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        refreshRestaurantData();
      }, 15000);
    };

    const stopPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    if (isFocused) {
      startPolling();
    } else {
      stopPolling();
    }

    // Also respond to app going to background/foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isFocused) {
        refreshRestaurantData();
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [isFocused, refreshRestaurantData]);

  // Set audio mode for playback
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

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

  const handleDeleteOrders = useCallback(async () => {
    showAlert('Archive Orders?', `Archive ${selectedIds.size} selected order(s)? They will be hidden from your list but financial records are preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive', onPress: async () => {
          setDeleting(true);
          const success = await deleteOrders(Array.from(selectedIds), 'restaurant');
          setDeleting(false);
          if (success) {
            setSelectedIds(new Set());
            setSelectMode(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      },
    ]);
  }, [selectedIds, deleteOrders, showAlert]);

  const renderOrder = ({ item }: { item: DbOrder }) => {
    const cfg = statusConfig[item.status] || statusConfig.pending;
    const time = new Date(item.created_at);
    const dateStr = formatNigerianDate(time, { year: undefined });
    const timeStr = formatNigerianTime(time);
    const items = item.order_items || [];

    return (
      <Pressable
        onPress={() => {
          if (selectMode) {
            Haptics.selectionAsync();
            setSelectedIds(prev => {
              const next = new Set(prev);
              if (next.has(item.id)) next.delete(item.id);
              else if (['delivered', 'cancelled'].includes(item.status)) next.add(item.id);
              return next;
            });
            return;
          }
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/restaurant-order/[id]', params: { id: item.id } });
        }}
        onLongPress={() => { if (!selectMode && ['delivered', 'cancelled'].includes(item.status)) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSelectMode(true); setSelectedIds(new Set([item.id])); } }}
        style={[styles.orderCard, selectMode && selectedIds.has(item.id) && { borderColor: '#EF4444', borderWidth: 2 }]}
      >
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderId}>{item.order_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={styles.customerName}>{item.customer_name || 'Customer'}</Text>
            <Text style={styles.orderTime}>{dateStr} {"\u00B7"} {timeStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.orderTotal}>{"\u20A6"}{item.total.toLocaleString()}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#666" style={{ marginTop: 4 }} />
          </View>
        </View>

        <View style={styles.itemsList}>
          {items.slice(0, 3).map((i, idx) => (
            <Text key={idx} style={styles.itemText}>{i.quantity}x {i.name}</Text>
          ))}
          {items.length > 3 ? (
            <Text style={styles.moreItems}>+{items.length - 3} more items</Text>
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

        {/* Quick action hint */}
        {cfg.next ? (
          <View style={styles.quickActionHint}>
            <MaterialIcons name="touch-app" size={14} color={theme.primary} />
            <Text style={styles.quickActionText}>Tap to manage this order</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleBar}>
        <View>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.count}>{restaurantOrders.length} total {"\u00B7"} {todayOrders.length} today {"\u00B7"} {"\u20A6"}{todayRevenue.toLocaleString()} revenue</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {selectMode ? (
            <>
              <Pressable onPress={() => { setSelectMode(false); setSelectedIds(new Set()); }} style={styles.searchToggle}>
                <MaterialIcons name="close" size={22} color="#FFF" />
              </Pressable>
              {selectedIds.size > 0 ? (
                <Pressable
                  onPress={handleDeleteOrders}
                  disabled={deleting}
                  style={[styles.searchToggle, { backgroundColor: 'rgba(239,68,68,0.2)' }]}
                >
                  {deleting ? <ActivityIndicator size="small" color="#EF4444" /> : <MaterialIcons name="archive" size={22} color="#EF4444" />}
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <Pressable onPress={() => { Haptics.selectionAsync(); setSelectMode(true); }} style={styles.searchToggle}>
                <MaterialIcons name="checklist" size={22} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => { Haptics.selectionAsync(); setShowSearch(!showSearch); }} style={styles.searchToggle}>
                <MaterialIcons name={showSearch ? 'close' : 'search'} size={22} color="#FFF" />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* New order alert banner */}
      {pendingCount > 0 ? (
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setActiveTab('pending'); }}
          style={styles.newOrderBanner}
        >
          <View style={styles.newOrderPulse}>
            <MaterialIcons name="notifications-active" size={18} color="#FFF" />
          </View>
          <Text style={styles.newOrderBannerText}>{pendingCount} new order{pendingCount > 1 ? 's' : ''} waiting</Text>
          <MaterialIcons name="chevron-right" size={18} color="#F59E0B" />
        </Pressable>
      ) : null}

      {selectMode ? (
        <View style={{ backgroundColor: 'rgba(255,107,0,0.1)', paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 16, borderRadius: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary, textAlign: 'center' }}>{selectedIds.size} selected — Tap completed orders to select</Text>
        </View>
      ) : null}

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
  // New order alert banner
  newOrderBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  newOrderPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  newOrderBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#F59E0B' },
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
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 4, textAlign: 'center' },
  clearBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.15)' },
  clearBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  quickActionHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,0,0.15)' },
  quickActionText: { fontSize: 12, fontWeight: '600', color: theme.primary },
});
