import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAlert } from '@/template';

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Payment Methods</Text>

      <View style={styles.infoCard}>
        <MaterialIcons name="credit-card" size={24} color={theme.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Card Payments Only</Text>
          <Text style={styles.infoText}>SwiftChop accepts debit and credit card payments only. Your card details are securely encrypted using industry-standard PCI compliance.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Saved Cards</Text>

      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <MaterialIcons name="credit-card" size={36} color={theme.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No cards saved yet</Text>
        <Text style={styles.emptySubtitle}>Your payment cards will appear here once you complete your first order or add one during checkout.</Text>
      </View>

      <Pressable onPress={() => { Haptics.selectionAsync(); showAlert('Coming Soon', 'Stripe payment integration will be available shortly. You can add cards during checkout.'); }} style={styles.addBtn}>
        <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
        <Text style={styles.addBtnText}>Add New Card</Text>
      </Pressable>

      <View style={styles.securityNote}>
        <MaterialIcons name="lock" size={16} color={theme.success} />
        <Text style={styles.securityText}>All payment information is encrypted and securely stored using industry-standard PCI compliance. We never store your full card number.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18, borderRadius: 16, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted, marginBottom: 28 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 32, backgroundColor: theme.backgroundSecondary, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.primary, marginBottom: 24 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  securityText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
