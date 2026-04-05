import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { Order } from '../../services/mockData';

const statusConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  pending: { color: '#F59E0B', bg: '#FEF3C7', icon: 'schedule', label: 'Pending' },
  confirmed: { color: '#3B82F6', bg: '#DBEAFE', icon: 'check-circle', label: 'Confirmed' },
  preparing: { color: '#8B5CF6', bg: '#EDE9FE', icon: 'restaurant', label: 'Preparing' },
  on_the_way: { color: '#F59E0B', bg: '#FEF3C7', icon: 'delivery-dining', label: 'On the Way' },
  delivered: { color: '#10B981', bg: '#D1FAE5', icon: 'done-all', label: 'Delivered' },
  cancelled: { color: '#EF4444', bg: '#FEE2E2', icon: 'cancel', label: 'Cancelled' },
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { customerOrders } = useApp();

  const renderOrder = ({ item }: { item: Order }) => {
    const status = statusConfig[item.status] || statusConfig.pending;
    const date = new Date(item.createdAt);
    const dateStr = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Image source={getImage(item.restaurantImageKey)} style={styles.restaurantImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.restaurantName}>{item.restaurantName}</Text>
            <Text style={styles.orderDate}>{dateStr} · {item.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <MaterialIcons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.orderDivider} />
        <View style={styles.orderItems}>
          {item.items.map((i, idx) => (
            <Text key={idx} style={styles.itemText}>{i.quantity}x {i.name}</Text>
          ))}
        </View>
        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>₦{item.total.toLocaleString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.titleBar}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {customerOrders.length > 0 ? (
        <FlashList
          data={customerOrders}
          keyExtractor={(item) => item.id}
          estimatedItemSize={180}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={renderOrder}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        />
      ) : (
        <View style={styles.emptyState}>
          <Image source={require('../../assets/images/empty-orders.jpg')} style={styles.emptyImage} contentFit="contain" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>Your order history will appear here once you place your first order</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  titleBar: { paddingHorizontal: 16, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, ...theme.shadow.medium },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  restaurantImg: { width: 44, height: 44, borderRadius: 12 },
  restaurantName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  orderDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderDivider: { height: 1, backgroundColor: theme.borderLight, marginVertical: 12 },
  orderItems: { gap: 4, marginBottom: 12 },
  itemText: { fontSize: 14, color: theme.textSecondary },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 13, color: theme.textMuted, fontWeight: '500' },
  totalValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyImage: { width: 200, height: 150, marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
});
