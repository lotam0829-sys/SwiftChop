import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Modal, Linking, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import {
  fetchAdminApplications,
  approveApplication,
  rejectApplication,
  getSignedDocumentUrl,
  PendingApplication,
} from '../../services/supabaseData';

type Tab = 'restaurants' | 'riders' | 'approved';

export default function AdminDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();
  const { showAlert } = useAlert();

  const [tab, setTab] = useState<Tab>('restaurants');
  const [pendingRestaurants, setPendingRestaurants] = useState<PendingApplication[]>([]);
  const [pendingRiders, setPendingRiders] = useState<PendingApplication[]>([]);
  const [approved, setApproved] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; user: PendingApplication | null }>({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState('');
  const [detailsExpanded, setDetailsExpanded] = useState<Set<string>>(new Set());

  const isAdmin = !!userProfile?.is_admin;

  // Guard: only admins may view this page
  useEffect(() => {
    if (userProfile && !isAdmin) {
      router.replace('/');
    }
  }, [isAdmin, userProfile, router]);

  const loadData = useCallback(async () => {
    const result = await fetchAdminApplications();
    setPendingRestaurants(result.pendingRestaurants);
    setPendingRiders(result.pendingRiders);
    setApproved(result.approved);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleApprove = (user: PendingApplication) => {
    const isRestaurant = user.role === 'restaurant';
    const hasBankDetails = !!user.bank_code && !!user.bank_account_number;
    const payoutNote = hasBankDetails
      ? 'A Paystack payout subaccount will be created automatically.'
      : 'Note: no bank details on file. Applicant must complete bank setup before receiving payouts.';

    showAlert(
      `Approve ${isRestaurant ? 'Restaurant' : 'Rider'}?`,
      `${user.username || user.email} will gain full access to the platform. ${payoutNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingId(user.id);
            const { error, subaccount_created } = await approveApplication(user.id);
            setProcessingId(null);
            if (error) {
              showAlert('Approval Failed', error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showAlert(
              'Approved',
              `${user.username || user.email} is now live on the platform.${subaccount_created ? '\n\nPaystack payout account created successfully.' : ''}`
            );
            loadData();
          },
        },
      ]
    );
  };

  const openRejectModal = (user: PendingApplication) => {
    Haptics.selectionAsync();
    setRejectModal({ open: true, user });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectModal.user) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 8) {
      showAlert('Reason Required', 'Please provide a clear reason (at least 8 characters) so the applicant knows what to fix.');
      return;
    }
    setProcessingId(rejectModal.user.id);
    const { error } = await rejectApplication(rejectModal.user.id, rejectReason.trim());
    setProcessingId(null);
    setRejectModal({ open: false, user: null });
    setRejectReason('');
    if (error) {
      showAlert('Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showAlert('Rejected', 'Applicant has been notified and can resubmit after addressing the reason.');
    loadData();
  };

  const handleViewDocument = async (user: PendingApplication, docType: 'certificate' | 'id') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const bucket = docType === 'certificate' ? 'certificates' : 'id-documents';
    const path = docType === 'certificate'
      ? `${user.id}/business-certificate.pdf`
      : `${user.id}/id-document.jpg`;
    const url = await getSignedDocumentUrl(bucket, path);
    if (url) {
      Linking.openURL(url);
    } else {
      showAlert('Not Found', 'Document could not be located. The applicant may have skipped upload.');
    }
  };

  const toggleExpand = (id: string) => {
    Haptics.selectionAsync();
    setDetailsExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const currentList = tab === 'restaurants' ? pendingRestaurants : tab === 'riders' ? pendingRiders : approved;
  const tabCount = tab === 'restaurants' ? pendingRestaurants.length : tab === 'riders' ? pendingRiders.length : approved.length;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Review and approve applications</Text>
        </View>
        <Pressable onPress={handleRefresh} style={styles.refreshIconBtn} hitSlop={8}>
          <MaterialIcons name="refresh" size={22} color={theme.textPrimary} />
        </Pressable>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 12 }}>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#FDE68A' }]}>
            <MaterialIcons name="storefront" size={18} color="#B45309" />
          </View>
          <Text style={styles.statValue}>{pendingRestaurants.length}</Text>
          <Text style={styles.statLabel}>Pending Restaurants</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#FECACA' }]}>
            <MaterialIcons name="delivery-dining" size={18} color="#B91C1C" />
          </View>
          <Text style={styles.statValue}>{pendingRiders.length}</Text>
          <Text style={styles.statLabel}>Pending Riders</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }]}>
          <View style={[styles.statIcon, { backgroundColor: '#BFDBFE' }]}>
            <MaterialIcons name="verified" size={18} color="#1E40AF" />
          </View>
          <Text style={styles.statValue}>{approved.length}</Text>
          <Text style={styles.statLabel}>Approved Partners</Text>
        </View>
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['restaurants', 'riders', 'approved'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => { Haptics.selectionAsync(); setTab(t); }} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && { color: '#FFF' }]}>
              {t === 'restaurants' ? `Restaurants (${pendingRestaurants.length})` : t === 'riders' ? `Riders (${pendingRiders.length})` : `Approved (${approved.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      ) : currentList.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
        >
          <MaterialIcons name="inbox" size={56} color={theme.textMuted} />
          <Text style={styles.emptyText}>
            {tab === 'approved' ? 'No approved accounts yet' : `No pending ${tab} to review`}
          </Text>
          <Text style={styles.emptySubText}>
            {tab === 'approved' ? 'Approved partners will show up here.' : 'All caught up! Pull down to refresh anytime.'}
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
        >
          {currentList.map(user => {
            const isExpanded = detailsExpanded.has(user.id);
            const isProcessing = processingId === user.id;
            const isRestaurant = user.role === 'restaurant';
            const iconColor = isRestaurant ? '#7C3AED' : '#059669';
            const iconBg = isRestaurant ? '#EDE9FE' : '#ECFDF5';

            const maskedAccount = user.bank_account_number
              ? `${user.bank_account_number.slice(0, 3)}****${user.bank_account_number.slice(-2)}`
              : null;

            return (
              <View key={user.id} style={styles.card}>
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={[styles.cardAvatar, { backgroundColor: iconBg }]}>
                    <MaterialIcons name={isRestaurant ? 'storefront' : 'delivery-dining'} size={22} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {isRestaurant ? (user.restaurant_name || user.username || 'Unnamed Restaurant') : (user.username || 'Unnamed Rider')}
                    </Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>{user.email}</Text>
                  </View>
                  {tab === 'approved' ? (
                    <View style={styles.approvedBadge}>
                      <MaterialIcons name="verified" size={12} color={theme.success} />
                      <Text style={styles.approvedBadgeText}>Approved</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <MaterialIcons name="hourglass-top" size={12} color="#B45309" />
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  )}
                </View>

                {/* Quick meta chips */}
                <View style={styles.metaRow}>
                  {user.phone ? (
                    <View style={styles.metaChip}>
                      <MaterialIcons name="phone" size={12} color={theme.textSecondary} />
                      <Text style={styles.metaChipText}>{user.phone}</Text>
                    </View>
                  ) : null}
                  {isRestaurant && user.restaurant_cuisine ? (
                    <View style={styles.metaChip}>
                      <MaterialIcons name="restaurant-menu" size={12} color={theme.textSecondary} />
                      <Text style={styles.metaChipText}>{user.restaurant_cuisine}</Text>
                    </View>
                  ) : null}
                  {!isRestaurant && user.vehicle_type ? (
                    <View style={styles.metaChip}>
                      <MaterialIcons name="two-wheeler" size={12} color={theme.textSecondary} />
                      <Text style={styles.metaChipText}>{user.vehicle_type}</Text>
                    </View>
                  ) : null}
                  {user.paystack_subaccount_code ? (
                    <View style={[styles.metaChip, { backgroundColor: theme.successLight }]}>
                      <MaterialIcons name="account-balance-wallet" size={12} color={theme.success} />
                      <Text style={[styles.metaChipText, { color: theme.success }]}>Payout ready</Text>
                    </View>
                  ) : null}
                </View>

                {/* Toggle details */}
                <Pressable onPress={() => toggleExpand(user.id)} style={styles.expandBtn}>
                  <Text style={styles.expandBtnText}>{isExpanded ? 'Hide details' : 'View full details'}</Text>
                  <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={theme.primary} />
                </Pressable>

                {isExpanded ? (
                  <View style={styles.detailsWrap}>
                    {isRestaurant ? (
                      <>
                        <DetailRow icon="location-on" label="Address" value={user.restaurant_address || 'Not provided'} />
                        <DetailRow icon="description" label="Description" value={user.restaurant_description || 'Not provided'} />
                        <DetailRow icon="attach-money" label="Min Order" value={user.restaurant_min_order ? `\u20A6${user.restaurant_min_order.toLocaleString()}` : 'Not set'} />
                        <DetailRow icon="access-time" label="Delivery Time" value={user.restaurant_delivery_time || 'Not set'} />
                      </>
                    ) : (
                      <DetailRow icon="badge" label={user.id_type === 'passport' ? 'Passport' : 'NIN'} value={user.id_number || 'Not provided'} />
                    )}
                    <DetailRow
                      icon="account-balance"
                      label="Bank"
                      value={user.bank_name ? `${user.bank_name}${maskedAccount ? ` \u00B7 ${maskedAccount}` : ''}` : 'No bank on file'}
                    />
                    <DetailRow icon="person" label="Account Name" value={user.bank_account_name || 'Not verified'} />

                    {/* Documents */}
                    {(isRestaurant && user.business_certificate_url) || (!isRestaurant && user.id_document_url) ? (
                      <View style={styles.docsRow}>
                        {isRestaurant && user.business_certificate_url ? (
                          <Pressable onPress={() => handleViewDocument(user, 'certificate')} style={styles.docBtn}>
                            <MaterialIcons name="picture-as-pdf" size={16} color="#EF4444" />
                            <Text style={styles.docBtnText}>View CAC Certificate</Text>
                            <MaterialIcons name="open-in-new" size={14} color={theme.textMuted} />
                          </Pressable>
                        ) : null}
                        {!isRestaurant && user.id_document_url ? (
                          <Pressable onPress={() => handleViewDocument(user, 'id')} style={styles.docBtn}>
                            <MaterialIcons name="badge" size={16} color="#2563EB" />
                            <Text style={styles.docBtnText}>View ID Document</Text>
                            <MaterialIcons name="open-in-new" size={14} color={theme.textMuted} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}

                    {user.rejection_reason ? (
                      <View style={styles.rejectionBox}>
                        <Text style={styles.rejectionLabel}>Previous rejection reason</Text>
                        <Text style={styles.rejectionText}>{user.rejection_reason}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Actions */}
                {tab !== 'approved' ? (
                  <View style={styles.actionsRow}>
                    <Pressable onPress={() => openRejectModal(user)} style={[styles.rejectBtn, isProcessing && { opacity: 0.5 }]} disabled={isProcessing}>
                      <MaterialIcons name="close" size={18} color="#EF4444" />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable onPress={() => handleApprove(user)} style={[styles.approveBtn, isProcessing && { opacity: 0.7 }]} disabled={isProcessing}>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <MaterialIcons name="check" size={18} color="#FFF" />
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reject Reason Modal */}
      <Modal visible={rejectModal.open} transparent animationType="slide" onRequestClose={() => setRejectModal({ open: false, user: null })}>
        <View style={styles.modalOverlay}>
          <View style={[styles.rejectModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reject Application</Text>
            <Text style={styles.modalSubtitle}>
              Provide a clear reason so {rejectModal.user?.username || 'the applicant'} can address the issue and reapply.
            </Text>
            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Bank details do not match business name; CAC certificate is unreadable; ID document is expired..."
              placeholderTextColor={theme.textMuted}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setRejectModal({ open: false, user: null }); setRejectReason(''); }} style={[styles.modalBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.modalBtnText, { color: theme.textPrimary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleReject} style={[styles.modalBtn, { backgroundColor: '#EF4444', flex: 2 }]}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Reject & Notify</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, valueColor }: { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <MaterialIcons name={icon} size={16} color={theme.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  refreshIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },

  statsRow: { flexGrow: 0 },
  statCard: { padding: 14, borderRadius: 14, borderWidth: 1, minWidth: 150, gap: 2 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.backgroundSecondary },
  tabBtnActive: { backgroundColor: theme.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  loadingText: { fontSize: 14, color: theme.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 14 },
  emptySubText: { fontSize: 13, color: theme.textMuted, marginTop: 4, textAlign: 'center' },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border, ...theme.shadow.small },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  cardEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },

  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.successLight },
  approvedBadgeText: { fontSize: 11, fontWeight: '700', color: theme.success },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FEF3C7' },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#B45309' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.backgroundSecondary },
  metaChipText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },

  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.borderLight },
  expandBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },

  detailsWrap: { paddingTop: 10, gap: 10 },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detailIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: theme.textPrimary, marginTop: 2, lineHeight: 18 },

  docsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  docBtnText: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },

  rejectionBox: { padding: 10, borderRadius: 10, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', marginTop: 4 },
  rejectionLabel: { fontSize: 10, fontWeight: '700', color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  rejectionText: { fontSize: 12, color: '#B91C1C', lineHeight: 17 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.borderLight },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FEE2E2' },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  approveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.success },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  rejectModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 16, lineHeight: 20 },
  reasonInput: { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, fontSize: 14, color: theme.textPrimary, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
});
