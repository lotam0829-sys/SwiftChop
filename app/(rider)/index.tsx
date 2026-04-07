import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { formatNigerianDate, formatNigerianTime } from '../../constants/timeUtils';
import { createPaystackSubaccount } from '../../services/supabaseData';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface RiderPayment {
  id: string;
  order_id: string;
  amount: number;
  distance_km: number | null;
  status: string;
  payment_type: string;
  paystack_transfer_code: string | null;
  paystack_reference: string | null;
  metadata: any;
  created_at: string;
}

interface FinancialSummary {
  available_balance: number;
  pending_earnings: number;
  completed_earnings: number;
  total_earned: number;
  total_withdrawn: number;
  processing_withdrawals: number;
  today_earnings: number;
  week_earnings: number;
  today_deliveries: number;
  total_deliveries: number;
  payments: RiderPayment[];
}

export default function RiderEarningsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile } = useApp();
  const { showAlert } = useAlert();

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subaccountStatus, setSubaccountStatus] = useState<'active' | 'missing' | 'loading'>('loading');
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState<RiderPayment | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'deliveries' | 'withdrawals'>('all');

  // Pulse animation for available balance
  const balancePulse = useSharedValue(1);
  useEffect(() => {
    if (summary && summary.available_balance > 0) {
      balancePulse.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500 }),
          withTiming(1, { duration: 1500 })
        ), -1, true
      );
    }
  }, [summary?.available_balance]);
  const balancePulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: balancePulse.value }] }));

  const fetchFinancialData = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();

      // Call the edge function for comprehensive financial summary
      const { data, error } = await supabase.functions.invoke('rider-fetch-transfers', {
        body: { rider_id: userProfile.id },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text() || msg; } catch {}
        }
        console.log('Fetch transfers error:', msg);
        // Fallback: direct DB query
        await fallbackDirectQuery();
        return;
      }

      if (data) {
        setSummary(data);
      }

      // Check subaccount status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paystack_subaccount_code')
        .eq('id', userProfile.id)
        .single();
      setSubaccountStatus(profile?.paystack_subaccount_code ? 'active' : 'missing');

    } catch (err) {
      console.log('Financial data error:', err);
      await fallbackDirectQuery();
    }
  }, [userProfile?.id]);

  const fallbackDirectQuery = async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('rider_payments')
        .select('*')
        .eq('rider_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const payments = data || [];
      const deliveries = payments.filter(p => p.payment_type === 'delivery' || !p.payment_type);
      const withdrawals = payments.filter(p => p.payment_type === 'withdrawal');

      const totalEarned = deliveries.reduce((s, p) => s + p.amount, 0);
      const totalWithdrawn = withdrawals.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
      const processingW = withdrawals.filter(p => p.status === 'processing' || p.status === 'pending').reduce((s, p) => s + p.amount, 0);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - (now.getDay() * 86400000);

      setSummary({
        available_balance: Math.max(0, totalEarned - totalWithdrawn - processingW),
        pending_earnings: deliveries.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
        completed_earnings: deliveries.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
        total_earned: totalEarned,
        total_withdrawn: totalWithdrawn,
        processing_withdrawals: processingW,
        today_earnings: deliveries.filter(p => new Date(p.created_at).getTime() >= todayStart).reduce((s, p) => s + p.amount, 0),
        week_earnings: deliveries.filter(p => new Date(p.created_at).getTime() >= weekStart).reduce((s, p) => s + p.amount, 0),
        today_deliveries: deliveries.filter(p => new Date(p.created_at).getTime() >= todayStart).length,
        total_deliveries: deliveries.length,
        payments,
      });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('paystack_subaccount_code')
        .eq('id', userProfile.id)
        .single();
      setSubaccountStatus(profile?.paystack_subaccount_code ? 'active' : 'missing');
    } catch (err) {
      console.log('Fallback query error:', err);
      setSubaccountStatus('missing');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchFinancialData();
      setLoading(false);
    };
    load();
  }, [fetchFinancialData]);

  // Auto-refresh every 30 seconds while screen is open
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFinancialData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFinancialData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFinancialData();
    setRefreshing(false);
  };

  const handleActivateSubaccount = async () => {
    if (!userProfile?.id) {
      showAlert('Error', 'User profile not found. Please log out and log back in.');
      return;
    }
    setCreatingSubaccount(true);
    try {
      const supabase = getSupabaseClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('bank_code, bank_account_number, bank_account_name, username, bank_name')
        .eq('id', userProfile.id)
        .single();

      if (!profile?.bank_account_number || !profile?.bank_code) {
        showAlert('Bank Details Missing', 'Your bank details are incomplete. Please update them in your profile settings first.');
        setCreatingSubaccount(false);
        return;
      }

      const { data: subData, error: subError } = await createPaystackSubaccount(
        userProfile.id,
        profile.bank_account_name || profile.username || 'Rider',
        profile.bank_code,
        profile.bank_account_number
      );

      if (subError) {
        showAlert('Activation Failed', `Could not create payout account: ${subError}`);
      } else if (subData?.subaccount_code) {
        setSubaccountStatus('active');
        showAlert('Success', 'Your Paystack payout account has been activated successfully.');
      }
    } catch (err) {
      showAlert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setCreatingSubaccount(false);
    }
  };

  const handleWithdraw = async () => {
    if (!userProfile?.id || !summary) return;
    const amount = summary.available_balance;
    if (amount <= 0) {
      showAlert('No Funds', 'You have no available balance to withdraw.');
      return;
    }
    if (subaccountStatus !== 'active') {
      showAlert('Setup Required', 'Please activate your Paystack payout account first.');
      return;
    }

    showAlert(
      'Confirm Withdrawal',
      `Withdraw \u20A6${amount.toLocaleString()} to your bank account? This usually takes 1-5 minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Withdraw \u20A6${amount.toLocaleString()}`,
          style: 'default',
          onPress: async () => {
            setWithdrawing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
              const supabase = getSupabaseClient();
              const { data, error } = await supabase.functions.invoke('rider-withdraw', {
                body: { rider_id: userProfile.id, amount },
              });

              if (error) {
                let msg = error.message;
                if (error instanceof FunctionsHttpError) {
                  try {
                    const text = await error.context?.text();
                    const parsed = JSON.parse(text || '{}');
                    msg = parsed.error || parsed.message || text || msg;
                    // Check for Paystack tier restriction
                    if (parsed.requires_upgrade) {
                      showAlert(
                        'Transfers Not Yet Enabled',
                        'The platform needs to complete Paystack business verification before rider withdrawals can be processed. Your earnings are recorded and safe. Contact support for an update.'
                      );
                      setWithdrawing(false);
                      return;
                    }
                  } catch { }
                }
                showAlert('Withdrawal Failed', msg);
              } else if (data?.requires_upgrade) {
                showAlert(
                  'Transfers Not Yet Enabled',
                  data.message || 'Paystack business verification is pending. Your earnings are safe and will be available once transfers are enabled.'
                );
              } else if (data?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showAlert(
                  'Withdrawal Successful',
                  `\u20A6${amount.toLocaleString()} is being transferred to your bank account. Check your bank app in a few minutes.`
                );
                // Refresh data to show updated balances
                await fetchFinancialData();
              } else {
                showAlert('Withdrawal Issue', data?.message || 'Transfer could not be completed. Please try again.');
              }
            } catch (err) {
              showAlert('Error', 'An unexpected error occurred during withdrawal.');
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const filteredPayments = useMemo(() => {
    if (!summary) return [];
    if (activeTab === 'deliveries') return summary.payments.filter(p => p.payment_type === 'delivery' || !p.payment_type);
    if (activeTab === 'withdrawals') return summary.payments.filter(p => p.payment_type === 'withdrawal');
    return summary.payments;
  }, [summary, activeTab]);

  const getPaymentIcon = (p: RiderPayment) => {
    if (p.payment_type === 'withdrawal') return 'account-balance';
    return 'delivery-dining';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'processing': return '#3B82F6';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed': return '#ECFDF5';
      case 'pending': return '#FEF3C7';
      case 'processing': return '#DBEAFE';
      case 'failed': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const avgPerTrip = summary && summary.total_deliveries > 0
    ? Math.round(summary.total_earned / summary.total_deliveries)
    : 0;

  const canWithdraw = summary && summary.available_balance > 0 && subaccountStatus === 'active' && !withdrawing;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={{ color: '#6B7280', marginTop: 12, fontSize: 14 }}>Loading your earnings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {userProfile?.username?.split(' ')[0] || 'Rider'}</Text>
            <Text style={styles.greetingSub}>{formatNigerianDate(new Date())}</Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Active</Text>
          </View>
        </View>

        {/* Balance Hero Card */}
        <Animated.View style={balancePulseStyle}>
          <LinearGradient colors={['#059669', '#047857', '#065F46']} style={styles.balanceHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.balanceTopRow}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={styles.balanceBadge}>
                <MaterialIcons name="account-balance-wallet" size={14} color="#A7F3D0" />
              </View>
            </View>
            <Text style={styles.balanceAmount}>{"\u20A6"}{(summary?.available_balance || 0).toLocaleString()}</Text>

            {/* Withdraw Button */}
            <Pressable
              onPress={handleWithdraw}
              disabled={!canWithdraw}
              style={({ pressed }) => [
                styles.withdrawBtn,
                !canWithdraw && styles.withdrawBtnDisabled,
                pressed && canWithdraw && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              {withdrawing ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <MaterialIcons name="account-balance" size={18} color={canWithdraw ? '#059669' : '#6B7280'} />
                  <Text style={[styles.withdrawBtnText, !canWithdraw && { color: '#6B7280' }]}>
                    {summary && summary.available_balance > 0 ? `Withdraw \u20A6${summary.available_balance.toLocaleString()}` : 'No funds to withdraw'}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Balance Breakdown */}
            <View style={styles.balanceBreakdown}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{"\u20A6"}{(summary?.pending_earnings || 0).toLocaleString()}</Text>
                <Text style={styles.breakdownLabel}>Pending</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{"\u20A6"}{(summary?.total_withdrawn || 0).toLocaleString()}</Text>
                <Text style={styles.breakdownLabel}>Withdrawn</Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{"\u20A6"}{(summary?.processing_withdrawals || 0).toLocaleString()}</Text>
                <Text style={styles.breakdownLabel}>Processing</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Paystack Subaccount Warning */}
        {subaccountStatus === 'missing' ? (
          <Pressable
            onPress={handleActivateSubaccount}
            disabled={creatingSubaccount}
            style={({ pressed }) => [styles.subaccountWarning, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.subaccountWarningIcon}>
              <MaterialIcons name="warning" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subaccountWarningTitle}>Payment Setup Required</Text>
              <Text style={styles.subaccountWarningSub}>
                {creatingSubaccount ? 'Setting up your Paystack payout account...' : 'Tap to activate Paystack so you can withdraw earnings.'}
              </Text>
            </View>
            {creatingSubaccount ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <MaterialIcons name="chevron-right" size={22} color="#D97706" />
            )}
          </Pressable>
        ) : subaccountStatus === 'active' ? (
          <View style={styles.subaccountActive}>
            <MaterialIcons name="verified" size={16} color="#10B981" />
            <Text style={styles.subaccountActiveText}>Paystack payout account active</Text>
          </View>
        ) : null}

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <MaterialIcons name="today" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{"\u20A6"}{(summary?.today_earnings || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
              <MaterialIcons name="date-range" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{"\u20A6"}{(summary?.week_earnings || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
              <MaterialIcons name="trending-up" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{"\u20A6"}{avgPerTrip.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Avg/Trip</Text>
          </View>
        </View>

        {/* Performance Row */}
        <View style={styles.performanceRow}>
          <View style={styles.perfCard}>
            <MaterialIcons name="delivery-dining" size={22} color="#10B981" />
            <View>
              <Text style={styles.perfValue}>{summary?.today_deliveries || 0}</Text>
              <Text style={styles.perfLabel}>Today Deliveries</Text>
            </View>
          </View>
          <View style={styles.perfCard}>
            <MaterialIcons name="local-shipping" size={22} color="#3B82F6" />
            <View>
              <Text style={styles.perfValue}>{summary?.total_deliveries || 0}</Text>
              <Text style={styles.perfLabel}>Total Deliveries</Text>
            </View>
          </View>
        </View>

        {/* Start Earning CTA */}
        <Pressable
          onPress={() => {
            const url = Platform.OS === 'ios'
              ? 'https://apps.apple.com/ca/app/shipday-drive/id1531504620'
              : 'https://play.google.com/store/apps/details?id=com.shipday.driver';
            Linking.openURL(url);
          }}
          style={({ pressed }) => [styles.startEarningBtn, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.startEarningIcon}>
            <MaterialIcons name="delivery-dining" size={26} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.startEarningTitle}>Go Online</Text>
            <Text style={styles.startEarningSub}>Open Shipday Drive to accept deliveries</Text>
          </View>
          <MaterialIcons name="open-in-new" size={18} color="#10B981" />
        </Pressable>

        {/* Payment History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <Text style={styles.sectionCount}>{summary?.payments.length || 0} transactions</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {([
            { key: 'all', label: 'All', count: summary?.payments.length || 0 },
            { key: 'deliveries', label: 'Earnings', count: summary?.payments.filter(p => p.payment_type === 'delivery' || !p.payment_type).length || 0 },
            { key: 'withdrawals', label: 'Withdrawals', count: summary?.payments.filter(p => p.payment_type === 'withdrawal').length || 0 },
          ] as const).map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              {tab.count > 0 ? (
                <View style={[styles.tabBadge, activeTab === tab.key && { backgroundColor: '#10B981' }]}>
                  <Text style={[styles.tabBadgeText, activeTab === tab.key && { color: '#FFF' }]}>{tab.count}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        {/* Payment List */}
        {filteredPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name={activeTab === 'withdrawals' ? 'account-balance' : 'account-balance-wallet'} size={36} color="#6B7280" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'withdrawals' ? 'No withdrawals yet' : activeTab === 'deliveries' ? 'No earnings yet' : 'No transactions yet'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'withdrawals' 
                ? 'Complete deliveries and withdraw your earnings here.'
                : 'Complete deliveries via Shipday Drive to start earning.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 6 }}>
            {filteredPayments.map(item => (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPaymentDetail(item);
                }}
                style={({ pressed }) => [styles.paymentItem, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              >
                <View style={[styles.paymentIcon, { backgroundColor: getStatusBg(item.status) }]}>
                  <MaterialIcons
                    name={getPaymentIcon(item) as any}
                    size={20}
                    color={getStatusColor(item.status)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>
                    {item.payment_type === 'withdrawal' ? 'Withdrawal' : 'Delivery Earning'}
                  </Text>
                  <Text style={styles.paymentDate}>
                    {formatNigerianDate(new Date(item.created_at))} {"\u00B7"} {formatNigerianTime(new Date(item.created_at))}
                  </Text>
                  {item.distance_km && item.payment_type !== 'withdrawal' ? (
                    <Text style={styles.paymentDistance}>{item.distance_km} km</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.paymentAmount, { color: item.payment_type === 'withdrawal' ? '#EF4444' : '#10B981' }]}>
                    {item.payment_type === 'withdrawal' ? '-' : '+'}{"\u20A6"}{item.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: getStatusBg(item.status) }]}>
                    <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={18} color="#4B5563" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Payment Detail Modal */}
      <Modal visible={!!showPaymentDetail} transparent animationType="slide" onRequestClose={() => setShowPaymentDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            {showPaymentDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIconWrap, { backgroundColor: getStatusBg(showPaymentDetail.status) }]}>
                    <MaterialIcons
                      name={getPaymentIcon(showPaymentDetail) as any}
                      size={28}
                      color={getStatusColor(showPaymentDetail.status)}
                    />
                  </View>
                  <Text style={styles.modalTitle}>
                    {showPaymentDetail.payment_type === 'withdrawal' ? 'Withdrawal Details' : 'Earning Details'}
                  </Text>
                  <Text style={[styles.modalAmount, { color: showPaymentDetail.payment_type === 'withdrawal' ? '#EF4444' : '#10B981' }]}>
                    {showPaymentDetail.payment_type === 'withdrawal' ? '-' : '+'}{"\u20A6"}{showPaymentDetail.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.modalStatusBadge, { backgroundColor: getStatusBg(showPaymentDetail.status) }]}>
                    <Text style={[styles.modalStatusText, { color: getStatusColor(showPaymentDetail.status) }]}>
                      {getStatusLabel(showPaymentDetail.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalDetails}>
                  <DetailRow label="Date" value={formatNigerianDate(new Date(showPaymentDetail.created_at))} />
                  <DetailRow label="Time" value={formatNigerianTime(new Date(showPaymentDetail.created_at))} />
                  <DetailRow label="Type" value={showPaymentDetail.payment_type === 'withdrawal' ? 'Bank Withdrawal' : 'Delivery Payment'} />
                  {showPaymentDetail.distance_km && showPaymentDetail.payment_type !== 'withdrawal' ? (
                    <DetailRow label="Distance" value={`${showPaymentDetail.distance_km} km`} />
                  ) : null}
                  {showPaymentDetail.paystack_reference ? (
                    <DetailRow label="Reference" value={showPaymentDetail.paystack_reference} />
                  ) : null}
                  {showPaymentDetail.paystack_transfer_code ? (
                    <DetailRow label="Transfer Code" value={showPaymentDetail.paystack_transfer_code} />
                  ) : null}
                  {showPaymentDetail.metadata?.bank_name ? (
                    <DetailRow label="Bank" value={showPaymentDetail.metadata.bank_name} />
                  ) : null}
                  {showPaymentDetail.metadata?.account_last4 ? (
                    <DetailRow label="Account" value={`****${showPaymentDetail.metadata.account_last4}`} />
                  ) : null}
                  {showPaymentDetail.metadata?.balance_before != null ? (
                    <>
                      <DetailRow label="Balance Before" value={`\u20A6${showPaymentDetail.metadata.balance_before.toLocaleString()}`} />
                      <DetailRow label="Balance After" value={`\u20A6${showPaymentDetail.metadata.balance_after.toLocaleString()}`} />
                    </>
                  ) : null}
                </View>

                {/* Status explanation */}
                <View style={styles.statusExplain}>
                  <MaterialIcons name="info-outline" size={16} color="#6B7280" />
                  <Text style={styles.statusExplainText}>
                    {showPaymentDetail.status === 'pending'
                      ? 'This payment is being processed. Transfers usually take 1-5 minutes depending on your bank.'
                      : showPaymentDetail.status === 'processing'
                      ? 'Transfer is in progress. Please check your bank app shortly.'
                      : showPaymentDetail.status === 'completed'
                      ? 'This transaction has been completed successfully.'
                      : showPaymentDetail.status === 'failed'
                      ? 'This transfer failed. Please contact support if the issue persists.'
                      : 'Status will be updated automatically.'}
                  </Text>
                </View>

                <Pressable onPress={() => setShowPaymentDetail(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  greetingSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.15)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  onlineText: { fontSize: 13, fontWeight: '600', color: '#10B981' },

  // Balance Hero
  balanceHero: { marginHorizontal: 16, borderRadius: 20, padding: 22, marginBottom: 14 },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  balanceBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: '#FFF', marginBottom: 16 },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFF', marginBottom: 18 },
  withdrawBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.15)' },
  withdrawBtnText: { fontSize: 15, fontWeight: '700', color: '#059669' },
  balanceBreakdown: { flexDirection: 'row', alignItems: 'center' },
  breakdownItem: { flex: 1, alignItems: 'center' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  breakdownLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  breakdownDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Subaccount
  subaccountWarning: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  subaccountWarningIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' },
  subaccountWarningTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  subaccountWarningSub: { fontSize: 12, color: '#A16207', lineHeight: 17 },
  subaccountActive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginBottom: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.1)' },
  subaccountActiveText: { fontSize: 12, fontWeight: '600', color: '#10B981' },

  // Quick stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#2A2A2A' },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 11, color: '#6B7280' },

  // Performance
  performanceRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  perfCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  perfValue: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  perfLabel: { fontSize: 11, color: '#6B7280' },

  // Start earning
  startEarningBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 20, padding: 14, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.25)' },
  startEarningIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  startEarningTitle: { fontSize: 16, fontWeight: '700', color: '#10B981', marginBottom: 2 },
  startEarningSub: { fontSize: 12, color: '#6B7280' },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sectionCount: { fontSize: 12, color: '#6B7280' },

  // Tabs
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A' },
  tabActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#10B981' },
  tabBadge: { backgroundColor: '#2A2A2A', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },

  // Payment items
  paymentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  paymentIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  paymentTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  paymentDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  paymentDistance: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  paymentAmount: { fontSize: 15, fontWeight: '700' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  statusPillText: { fontSize: 9, fontWeight: '700' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 14, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 18 },
  modalHeader: { alignItems: 'center', marginBottom: 24 },
  modalIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  modalAmount: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  modalStatusBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  modalStatusText: { fontSize: 13, fontWeight: '700' },
  modalDetails: { backgroundColor: '#0D0D0D', borderRadius: 14, padding: 16, marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#E5E7EB', maxWidth: '60%', textAlign: 'right' },
  statusExplain: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(107,114,128,0.1)', marginBottom: 16 },
  statusExplainText: { flex: 1, fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#2A2A2A' },
  modalCloseBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
