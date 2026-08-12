import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, refreshProfile } = useApp();
  const { logout } = useAuth();

  // Auto-refresh profile every 30s so approval is detected as soon as the admin acts
  useEffect(() => {
    const interval = setInterval(() => {
      refreshProfile();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  const handleCheckStatus = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshProfile();
  };

  const handleContactSupport = () => {
    Haptics.selectionAsync();
    Linking.openURL('mailto:contact@onspace.ai?subject=SwiftChop%20Approval%20Inquiry%20-%20' + encodeURIComponent(userProfile?.email || ''));
  };

  const hasRejection = !!userProfile?.rejection_reason;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Image source={require('../assets/images/pending-approval.jpg')} style={styles.illustration} contentFit="contain" />

        <View style={[styles.statusBadge, hasRejection && { backgroundColor: '#FEE2E2' }]}>
          <MaterialIcons name={hasRejection ? 'error-outline' : 'hourglass-top'} size={16} color={hasRejection ? '#B91C1C' : '#F59E0B'} />
          <Text style={[styles.statusText, hasRejection && { color: '#B91C1C' }]}>{hasRejection ? 'Action Required' : 'Pending Approval'}</Text>
        </View>

        <Text style={styles.title}>{hasRejection ? 'Additional info needed' : `Almost there, ${userProfile?.username?.split(' ')[0] || 'Partner'}!`}</Text>

        {hasRejection ? (
          <>
            <Text style={styles.subtitle}>
              Our review team needs you to address the following before we can approve your account:
            </Text>
            <View style={styles.rejectionCard}>
              <MaterialIcons name="info" size={20} color="#B91C1C" />
              <Text style={styles.rejectionText}>{userProfile?.rejection_reason}</Text>
            </View>
            <Text style={styles.subSubtitle}>
              Please update your details or contact support at <Text style={{ fontWeight: '600' }}>contact@onspace.ai</Text> to resolve this, then check back for approval.
            </Text>
          </>
        ) : (
          <Text style={styles.subtitle}>
            {userProfile?.role === 'rider'
              ? <>Your dispatch rider application is being reviewed by our admin team. We will notify you at <Text style={{ fontWeight: '600' }}>{userProfile?.email}</Text> as soon as your account is approved.</>
              : <>Your restaurant <Text style={{ fontWeight: '700', color: theme.textPrimary }}>{userProfile?.restaurant_name || 'application'}</Text> is being reviewed by our admin team. We will notify you at <Text style={{ fontWeight: '600' }}>{userProfile?.email}</Text> as soon as your account is approved.</>
            }
          </Text>
        )}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>Review typically takes 1-2 business days</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="verified" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>We verify your identity, bank details, and business documents</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="account-balance-wallet" size={20} color={theme.textMuted} />
            <Text style={styles.infoText}>Once approved, your Paystack payout account is set up automatically</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <PrimaryButton
          label="Check Approval Status"
          onPress={handleCheckStatus}
          variant="dark"
          icon={<MaterialIcons name="refresh" size={20} color="#FFF" />}
        />
        <Pressable onPress={handleContactSupport} style={styles.supportBtn}>
          <MaterialIcons name="mail-outline" size={18} color={theme.primary} />
          <Text style={styles.supportText}>Contact Support</Text>
        </Pressable>
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
  bottomActions: { gap: 10 },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.primaryMuted, backgroundColor: theme.primaryFaint },
  supportText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  logoutBtn: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { fontSize: 15, fontWeight: '600', color: theme.error },
  rejectionCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 16, width: '100%' },
  rejectionText: { flex: 1, fontSize: 14, color: '#B91C1C', lineHeight: 20 },
  subSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
});
