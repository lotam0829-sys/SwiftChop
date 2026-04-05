import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { updateUserProfile } from '../services/supabaseData';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, refreshProfile } = useApp();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();

  const handleSimulateApproval = async () => {
    if (user?.id) {
      await updateUserProfile(user.id, { is_approved: true } as any);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Image source={require('../assets/images/pending-approval.jpg')} style={styles.illustration} contentFit="contain" />

        <View style={styles.statusBadge}>
          <MaterialIcons name="hourglass-top" size={16} color="#F59E0B" />
          <Text style={styles.statusText}>Pending Approval</Text>
        </View>

        <Text style={styles.title}>Almost there, {userProfile?.username?.split(' ')[0] || 'Partner'}!</Text>
        <Text style={styles.subtitle}>
          Your restaurant <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{userProfile?.restaurant_name || 'application'}</Text> is being reviewed by our team. We will notify you via email at <Text style={{ fontWeight: '600' }}>{userProfile?.email}</Text> once approved.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>Review typically takes 1-2 business days</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="verified" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>We verify your business details and location</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>You will receive an email once approved or if we need more info</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <PrimaryButton
          label="Simulate Approval (Demo)"
          onPress={handleSimulateApproval}
          variant="primary"
          icon={<MaterialIcons name="verified" size={20} color="#FFF" />}
        />
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); logout(); }}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: 200, height: 200, marginBottom: 28 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  statusText: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  title: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  infoCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 18, gap: 14, width: '100%' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoText: { fontSize: 14, color: theme.textSecondary, flex: 1, lineHeight: 20 },
  bottomActions: { gap: 12 },
  logoutBtn: { alignItems: 'center', paddingVertical: 14 },
  logoutText: { fontSize: 15, fontWeight: '600', color: theme.error },
});
