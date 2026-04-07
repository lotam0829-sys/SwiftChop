import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Linking, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useApp } from '../../contexts/AppContext';
import { getSupabaseClient } from '@/template';

interface RiderProfile {
  id: string;
  username: string | null;
  email: string;
  phone: string | null;
  vehicle_type: string | null;
  id_type: string | null;
  id_number: string | null;
  is_approved: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_code: string | null;
  avatar_url: string | null;
  paystack_subaccount_code: string | null;
  created_at?: string;
}

const vehicleConfig: Record<string, { label: string; icon: string; color: string }> = {
  bike: { label: 'Bicycle', icon: 'pedal-bike', color: '#3B82F6' },
  motorcycle: { label: 'Motorcycle', icon: 'two-wheeler', color: '#10B981' },
  car: { label: 'Car', icon: 'directions-car', color: '#8B5CF6' },
  tricycle: { label: 'Tricycle', icon: 'electric-rickshaw', color: '#F59E0B' },
};

export default function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile } = useApp();

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userProfile.id)
        .single();
      if (data) setProfile(data);
    } catch (err) {
      console.log('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (userProfile?.id) loadProfile();
  }, [userProfile?.username, userProfile?.phone]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  const vehicle = vehicleConfig[profile?.vehicle_type || ''] || { label: profile?.vehicle_type || 'Not set', icon: 'two-wheeler', color: '#6B7280' };
  const maskedAccount = profile?.bank_account_number ? `****${profile.bank_account_number.slice(-4)}` : null;
  const maskedId = profile?.id_number ? `${profile.id_number.slice(0, 3)}****${profile.id_number.slice(-3)}` : null;
  const idLabel = profile?.id_type === 'nin' ? 'NIN' : profile?.id_type === 'passport' ? 'International Passport' : profile?.id_type === 'drivers_license' ? "Driver's License" : profile?.id_type || 'Not set';

  const completionItems = [
    { done: !!profile?.username, label: 'Full Name' },
    { done: !!profile?.phone, label: 'Phone Number' },
    { done: !!profile?.vehicle_type, label: 'Vehicle Type' },
    { done: !!profile?.id_number, label: 'ID Verification' },
    { done: !!profile?.bank_account_number, label: 'Bank Account' },
    { done: !!profile?.avatar_url, label: 'Profile Photo' },
  ];
  const completedCount = completionItems.filter(i => i.done).length;
  const completionPct = Math.round((completedCount / completionItems.length) * 100);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}
            style={styles.editBtn}
          >
            <MaterialIcons name="edit" size={16} color="#10B981" />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* Profile Hero Card */}
        <LinearGradient colors={['#1A1A1A', '#111111']} style={styles.heroCard}>
          <View style={styles.avatarRow}>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{profile?.username?.charAt(0)?.toUpperCase() || 'R'}</Text>
                </View>
              )}
              <View style={styles.cameraIcon}>
                <MaterialIcons name="camera-alt" size={12} color="#FFF" />
              </View>
            </Pressable>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.riderName}>{profile?.username || 'Rider'}</Text>
              <Text style={styles.riderEmail}>{profile?.email}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, profile?.is_approved ? styles.approvedBg : styles.pendingBg]}>
                  <MaterialIcons
                    name={profile?.is_approved ? 'verified' : 'hourglass-top'}
                    size={13}
                    color={profile?.is_approved ? '#059669' : '#D97706'}
                  />
                  <Text style={[styles.statusText, { color: profile?.is_approved ? '#059669' : '#D97706' }]}>
                    {profile?.is_approved ? 'Verified' : 'Pending'}
                  </Text>
                </View>
                {profile?.paystack_subaccount_code ? (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <MaterialIcons name="account-balance-wallet" size={13} color="#10B981" />
                    <Text style={[styles.statusText, { color: '#10B981' }]}>Payouts Active</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Profile Completion */}
          {completionPct < 100 ? (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}
              style={styles.completionCard}
            >
              <View style={styles.completionHeader}>
                <Text style={styles.completionTitle}>Profile Completion</Text>
                <Text style={styles.completionPct}>{completionPct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
              </View>
              <View style={styles.missingItems}>
                {completionItems.filter(i => !i.done).map((item, idx) => (
                  <View key={idx} style={styles.missingItem}>
                    <MaterialIcons name="radio-button-unchecked" size={14} color="#F59E0B" />
                    <Text style={styles.missingItemText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          ) : null}
        </LinearGradient>

        {/* Vehicle Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="directions-bike" size={18} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Vehicle</Text>
          </View>
          <View style={[styles.vehicleDisplay, { borderColor: `${vehicle.color}30` }]}>
            <View style={[styles.vehicleIconWrap, { backgroundColor: `${vehicle.color}15` }]}>
              <MaterialIcons name={vehicle.icon as any} size={28} color={vehicle.color} />
            </View>
            <Text style={[styles.vehicleLabel, { color: vehicle.color }]}>{vehicle.label}</Text>
          </View>
        </View>

        {/* Contact Info Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="contact-phone" size={18} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>
          <InfoRow icon="person" label="Full Name" value={profile?.username || 'Not set'} />
          <InfoRow icon="email" label="Email" value={profile?.email || 'Not set'} />
          <InfoRow icon="phone" label="Phone" value={profile?.phone || 'Not set'} />
        </View>

        {/* ID Verification Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="badge" size={18} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>ID Verification</Text>
          </View>
          <InfoRow icon="credit-card" label="ID Type" value={idLabel} />
          <InfoRow icon="pin" label="ID Number" value={maskedId || 'Not set'} />
          <View style={styles.verifyRow}>
            <MaterialIcons
              name={profile?.is_approved ? 'check-circle' : 'schedule'}
              size={16}
              color={profile?.is_approved ? '#10B981' : '#F59E0B'}
            />
            <Text style={[styles.verifyText, { color: profile?.is_approved ? '#10B981' : '#F59E0B' }]}>
              {profile?.is_approved ? 'ID Verified' : 'Verification Pending'}
            </Text>
          </View>
        </View>

        {/* Bank Account Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="account-balance" size={18} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Bank Account</Text>
          </View>
          {profile?.bank_name ? (
            <View style={styles.bankDisplay}>
              <View style={styles.bankIconWrap}>
                <MaterialIcons name="account-balance" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bankName}>{profile.bank_name}</Text>
                <Text style={styles.bankAccount}>{maskedAccount}</Text>
                {profile.bank_account_name ? (
                  <Text style={styles.bankHolder}>{profile.bank_account_name}</Text>
                ) : null}
              </View>
              <MaterialIcons name="check-circle" size={18} color="#10B981" />
            </View>
          ) : (
            <View style={styles.bankMissing}>
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.bankMissingText}>No bank account linked. Add your bank details to receive payouts.</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="flash-on" size={18} color="#9CA3AF" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <MaterialIcons name="edit" size={18} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={20} color="#4B5563" />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL(Platform.OS === 'ios'
                ? 'https://apps.apple.com/ca/app/shipday-drive/id1531504620'
                : 'https://play.google.com/store/apps/details?id=com.shipday.driver'
              );
            }}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <MaterialIcons name="delivery-dining" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.actionText}>Open Shipday Drive</Text>
            <MaterialIcons name="open-in-new" size={18} color="#4B5563" />
          </Pressable>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL('mailto:support@swiftchop.com?subject=Rider Support'); }}
            style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.8 }, { borderBottomWidth: 0 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
              <MaterialIcons name="headset-mic" size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.actionText}>Contact Support</Text>
            <MaterialIcons name="chevron-right" size={20} color="#4B5563" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const isEmpty = value === 'Not set';
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <MaterialIcons name={icon as any} size={16} color="#6B7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, isEmpty && { color: '#6B7280', fontStyle: 'italic' }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#10B981' },

  // Hero Card
  heroCard: { marginHorizontal: 16, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#10B981' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10B981' },
  avatarLetter: { fontSize: 28, fontWeight: '700', color: '#10B981' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1A1A1A' },
  riderName: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  riderEmail: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  approvedBg: { backgroundColor: '#ECFDF5' },
  pendingBg: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Profile Completion
  completionCard: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  completionTitle: { fontSize: 13, fontWeight: '600', color: '#F59E0B' },
  completionPct: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#2A2A2A', overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  missingItems: { gap: 6 },
  missingItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  missingItemText: { fontSize: 12, color: '#D97706' },

  // Section Cards
  sectionCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#E5E7EB' },

  // Vehicle
  vehicleDisplay: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 12, backgroundColor: '#111111', borderWidth: 1 },
  vehicleIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehicleLabel: { fontSize: 17, fontWeight: '700' },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  infoIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: '500', color: '#E5E7EB' },

  // Verify
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8 },
  verifyText: { fontSize: 12, fontWeight: '600' },

  // Bank
  bankDisplay: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#111111', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  bankIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' },
  bankName: { fontSize: 15, fontWeight: '600', color: '#E5E7EB' },
  bankAccount: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  bankHolder: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  bankMissing: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  bankMissingText: { flex: 1, fontSize: 13, color: '#D97706', lineHeight: 18 },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#E5E7EB' },
});
