import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
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
  avatar_url: string | null;
  created_at?: string;
}

const vehicleLabels: Record<string, string> = {
  bike: 'Bicycle',
  motorcycle: 'Motorcycle',
  car: 'Car',
  tricycle: 'Tricycle',
};

const vehicleIcons: Record<string, string> = {
  bike: 'pedal-bike',
  motorcycle: 'two-wheeler',
  car: 'directions-car',
  tricycle: 'electric-rickshaw',
};

export default function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile } = useApp();

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
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
  };

  useEffect(() => {
    loadProfile();
  }, [userProfile?.id]);

  // Refresh profile when user profile changes (e.g. after editing)
  useEffect(() => {
    if (userProfile?.id) {
      loadProfile();
    }
  }, [userProfile?.username, userProfile?.phone]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  const maskedAccount = profile?.bank_account_number
    ? `****${profile.bank_account_number.slice(-4)}`
    : 'Not set';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>My Profile</Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}
            style={styles.editBtn}
          >
            <MaterialIcons name="edit" size={18} color="#10B981" />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        {/* Avatar & Name */}
        <View style={styles.avatarSection}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/edit-rider-profile' as any); }}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>{profile?.username?.charAt(0)?.toUpperCase() || 'R'}</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <MaterialIcons name="camera-alt" size={14} color="#FFF" />
            </View>
          </Pressable>
          <Text style={styles.riderName}>{profile?.username || 'Rider'}</Text>
          <Text style={styles.riderEmail}>{profile?.email}</Text>
          <View style={[styles.approvalBadge, profile?.is_approved ? styles.approvedBadge : styles.pendingBadge]}>
            <MaterialIcons name={profile?.is_approved ? 'verified' : 'hourglass-top'} size={14} color={profile?.is_approved ? '#059669' : '#D97706'} />
            <Text style={[styles.approvalText, profile?.is_approved ? { color: '#059669' } : { color: '#D97706' }]}>
              {profile?.is_approved ? 'Verified Rider' : 'Pending Verification'}
            </Text>
          </View>
        </View>

        {/* Personal Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Details</Text>
          </View>
          <InfoRow icon="person" label="Full Name" value={profile?.username || 'Not set'} />
          <InfoRow icon="email" label="Email" value={profile?.email || 'Not set'} />
          <InfoRow icon="phone" label="Phone" value={profile?.phone || 'Not set'} />
        </View>

        {/* Vehicle */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.vehicleBadge}>
            <MaterialIcons name={(vehicleIcons[profile?.vehicle_type || ''] || 'two-wheeler') as any} size={28} color="#10B981" />
            <Text style={styles.vehicleText}>{vehicleLabels[profile?.vehicle_type || ''] || profile?.vehicle_type || 'Not set'}</Text>
          </View>
        </View>

        {/* ID Verification */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ID Verification</Text>
          <InfoRow icon="badge" label="ID Type" value={profile?.id_type === 'nin' ? 'NIN' : profile?.id_type === 'passport' ? 'International Passport' : 'Not set'} />
          <InfoRow icon="pin" label="ID Number" value={profile?.id_number ? `${profile.id_number.slice(0, 3)}****${profile.id_number.slice(-3)}` : 'Not set'} />
          <View style={styles.verificationStatus}>
            <MaterialIcons name={profile?.is_approved ? 'check-circle' : 'schedule'} size={16} color={profile?.is_approved ? theme.success : theme.warning} />
            <Text style={[styles.verificationText, { color: profile?.is_approved ? theme.success : theme.warning }]}>
              {profile?.is_approved ? 'ID Verified' : 'Verification Pending'}
            </Text>
          </View>
        </View>

        {/* Bank Account */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bank Account</Text>
          <InfoRow icon="account-balance" label="Bank" value={profile?.bank_name || 'Not set'} />
          <InfoRow icon="credit-card" label="Account Number" value={maskedAccount} />
          <InfoRow icon="person" label="Account Name" value={profile?.bank_account_name || 'Not set'} />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon as any} size={18} color="#6B7280" />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: 12, borderWidth: 3, borderColor: '#10B981' },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: '#10B981' },
  avatarLetter: { fontSize: 36, fontWeight: '700', color: '#10B981' },
  cameraIcon: { position: 'absolute', bottom: 12, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D0D0D' },
  riderName: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  riderEmail: { fontSize: 14, color: '#6B7280', marginBottom: 10 },
  approvalBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  approvedBadge: { backgroundColor: '#ECFDF5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  approvalText: { fontSize: 13, fontWeight: '600' },
  sectionCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2A2A2A' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '500', color: '#E5E7EB' },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.1)' },
  vehicleText: { fontSize: 16, fontWeight: '600', color: '#10B981' },
  verificationStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  verificationText: { fontSize: 13, fontWeight: '600' },
});
