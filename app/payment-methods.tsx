import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Payment Methods</Text>

      <View style={styles.infoCard}>
        <View style={[styles.infoIconWrap, { backgroundColor: '#E8F5E9' }]}>
          <MaterialIcons name="credit-card" size={24} color="#2E7D32" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Paystack Payments</Text>
          <Text style={styles.infoText}>SwiftChop uses Paystack for secure card payments. You will enter your card details at checkout each time you order. Your card information is never stored on our servers.</Text>
        </View>
      </View>

      <View style={styles.howItWorksCard}>
        <Text style={styles.howTitle}>How it works</Text>
        {[
          { icon: 'shopping-cart', text: 'Add items to your cart and go to checkout' },
          { icon: 'credit-card', text: 'Tap "Pay & Place Order" to proceed' },
          { icon: 'lock', text: 'Enter card details on the secure Paystack page' },
          { icon: 'check-circle', text: 'Payment is processed and order is confirmed' },
        ].map((step, i) => (
          <View key={i} style={styles.howStep}>
            <View style={styles.howStepNum}>
              <Text style={styles.howStepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.howStepIcon}>
              <MaterialIcons name={step.icon as any} size={20} color={theme.primary} />
            </View>
            <Text style={styles.howStepText}>{step.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.acceptedCards}>
        <Text style={styles.acceptedTitle}>Accepted Cards</Text>
        <View style={styles.cardTypes}>
          {['Visa', 'Mastercard', 'Verve'].map(type => (
            <View key={type} style={styles.cardTypeBadge}>
              <MaterialIcons name="credit-card" size={16} color={theme.primary} />
              <Text style={styles.cardTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.securityNote}>
        <MaterialIcons name="lock" size={16} color={theme.success} />
        <Text style={styles.securityText}>All payment information is encrypted end-to-end by Paystack, a PCI-DSS certified payment processor trusted by over 60,000 businesses in Nigeria.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18, borderRadius: 16, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 24 },
  infoIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  howItWorksCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: theme.border },
  howTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  howStepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  howStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  howStepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  howStepText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  acceptedCards: { marginBottom: 24 },
  acceptedTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  cardTypes: { flexDirection: 'row', gap: 10 },
  cardTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  cardTypeText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  securityText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
