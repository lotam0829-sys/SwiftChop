import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getSupabaseClient } from '@/template';
import { formatNigerianDate } from '../../constants/timeUtils';

interface RiderPayment {
  id: string;
  order_id: string;
  amount: number;
  distance_km: number | null;
  status: string;
  created_at: string;
}

export default function RiderEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();

  const [payments, setPayments] = useState<RiderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('rider_payments')
        .select('*')
        .eq('rider_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setPayments(data);
    } catch (err) {
      console.log('Fetch payments error:', err);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchPayments();
      setLoading(false);
    };
    load();
  }, [fetchPayments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - (now.getDay() * 86400000);

  const todayEarnings = payments
    .filter(p => p.status === 'completed' && new Date(p.created_at).getTime() >= todayStart)
    .reduce((sum, p) => sum + p.amount, 0);

  const weekEarnings = payments
    .filter(p => p.status === 'completed' && new Date(p.created_at).getTime() >= weekStart)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalEarnings = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const todayDeliveries = payments.filter(p => new Date(p.created_at).getTime() >= todayStart).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return theme.success;
      case 'pending': return theme.warning;
      case 'failed': return theme.error;
      default: return theme.textMuted;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed': return '#ECFDF5';
      case 'pending': return '#FEF3C7';
      case 'failed': return '#FEE2E2';
      default: return theme.backgroundSecondary;
    }
  };

  const renderPaymentItem = ({ item }: { item: RiderPayment }) => (
    <View style={styles.paymentItem}>
      <View style={[styles.paymentIcon, { backgroundColor: getStatusBg(item.status) }]}>
        <MaterialIcons
          name={item.status === 'completed' ? 'check-circle' : item.status === 'pending' ? 'hourglass-top' : 'error'}
          size={22}
          color={getStatusColor(item.status)}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentTitle}>Delivery Payment</Text>
        <Text style={styles.paymentDate}>{formatNigerianDate(item.created_at)}</Text>
        {item.distance_km ? (
          <Text style={styles.paymentDistance}>{item.distance_km} km</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.paymentAmount, { color: getStatusColor(item.status) }]}>
          {item.status === 'completed' ? '+' : ''}{"\u20A6"}{item.amount.toLocaleString()}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: getStatusBg(item.status) }]}>
          <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {userProfile?.username?.split(' ')[0] || 'Rider'}</Text>
            <Text style={styles.greetingSub}>Here are your earnings</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Active</Text>
          </View>
        </View>

        {/* Earnings Hero */}
        <LinearGradient colors={['#059669', '#047857']} style={styles.earningsHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.heroLabel}>Today's Earnings</Text>
          <Text style={styles.heroAmount}>{"\u20A6"}{todayEarnings.toLocaleString()}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{todayDeliveries}</Text>
              <Text style={styles.heroStatLabel}>Deliveries</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{"\u20A6"}{weekEarnings.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>This Week</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{"\u20A6"}{totalEarnings.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>All Time</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatCard}>
            <MaterialIcons name="delivery-dining" size={24} color="#10B981" />
            <Text style={styles.quickStatValue}>{payments.length}</Text>
            <Text style={styles.quickStatLabel}>Total Deliveries</Text>
          </View>
          <View style={styles.quickStatCard}>
            <MaterialIcons name="trending-up" size={24} color="#3B82F6" />
            <Text style={styles.quickStatValue}>
              {payments.length > 0 ? `\u20A6${Math.round(totalEarnings / Math.max(1, payments.filter(p => p.status === 'completed').length)).toLocaleString()}` : '\u20A60'}
            </Text>
            <Text style={styles.quickStatLabel}>Avg per Trip</Text>
          </View>
        </View>

        {/* Payment History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <Text style={styles.sectionCount}>{payments.length} payments</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="account-balance-wallet" size={40} color="#6B7280" />
            </View>
            <Text style={styles.emptyTitle}>No payments yet</Text>
            <Text style={styles.emptySub}>Complete deliveries to start earning. Payments appear here instantly after each delivery.</Text>
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            {payments.map(item => (
              <View key={item.id}>{renderPaymentItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  greetingSub: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.15)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  onlineText: { fontSize: 13, fontWeight: '600', color: '#10B981' },
  earningsHero: { marginHorizontal: 16, borderRadius: 20, padding: 24, marginBottom: 16 },
  heroLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 4 },
  heroAmount: { fontSize: 40, fontWeight: '800', color: '#FFF', marginBottom: 20 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  quickStats: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  quickStatCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2A2A2A' },
  quickStatValue: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  quickStatLabel: { fontSize: 12, color: '#9CA3AF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  sectionCount: { fontSize: 13, color: '#6B7280' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  paymentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#1A1A1A', marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  paymentIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paymentTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  paymentDate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  paymentDistance: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  paymentAmount: { fontSize: 16, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
});
