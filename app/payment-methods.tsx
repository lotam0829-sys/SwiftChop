import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();

  const displayName = userProfile?.username || userProfile?.email?.split('@')[0] || 'YOUR NAME';
  const maskedName = displayName.toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Payment Methods</Text>

      {/* Virtual Card Display */}
      <View style={styles.cardSection}>
        <LinearGradient
          colors={['#1A1A2E', '#16213E', '#0F3460']}
          style={styles.virtualCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardChip}>
              <MaterialIcons name="contactless" size={22} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={styles.cardBrand}>Paystack</Text>
          </View>
          <Text style={styles.cardNumber}>{"\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  ****"}</Text>
          <View style={styles.cardBottomRow}>
            <View>
              <Text style={styles.cardSmallLabel}>CARDHOLDER</Text>
              <Text style={styles.cardHolderName}>{maskedName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardSmallLabel}>EXPIRES</Text>
              <Text style={styles.cardHolderName}>**/**</Text>
            </View>
          </View>
          <View style={styles.cardTypeRow}>
            {['Visa', 'Mastercard', 'Verve'].map(type => (
              <View key={type} style={styles.cardTypePill}>
                <Text style={styles.cardTypePillText}>{type}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
        <Text style={styles.cardCaption}>
          Your card is stored securely and encrypted by Paystack — we never see your full card details.
        </Text>
      </View>

      {/* Security info */}
      <View style={styles.securityCard}>
        <View style={[styles.securityIcon, { backgroundColor: '#E8F5E9' }]}>
          <MaterialIcons name="shield" size={24} color="#2E7D32" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.securityTitle}>Secure Payments</Text>
          <Text style={styles.securityText}>
            Your card is stored securely and encrypted by Paystack — we never see your full card details.
          </Text>
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
        <Text style={styles.securityNoteText}>All payment information is encrypted end-to-end by Paystack, a PCI-DSS certified payment processor trusted by over 60,000 businesses in Nigeria.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  // Virtual Card
  cardSection: { marginBottom: 24 },
  virtualCard: { borderRadius: 18, padding: 24, minHeight: 200, justifyContent: 'space-between' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardChip: { width: 40, height: 30, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  cardBrand: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  cardNumber: { fontSize: 20, fontWeight: '600', color: '#FFF', letterSpacing: 2, marginBottom: 16 },
  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardSmallLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 4 },
  cardHolderName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  cardTypeRow: { flexDirection: 'row', gap: 6 },
  cardTypePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  cardTypePillText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  cardCaption: { fontSize: 13, color: theme.textMuted, lineHeight: 18, marginTop: 12, paddingHorizontal: 4 },
  // Security
  securityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18, borderRadius: 16, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 24 },
  securityIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  securityTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  securityText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  // How it works
  howItWorksCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: theme.border },
  howTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  howStepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  howStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  howStepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  howStepText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  // Accepted cards
  acceptedCards: { marginBottom: 24 },
  acceptedTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  cardTypes: { flexDirection: 'row', gap: 10 },
  cardTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  cardTypeText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  securityNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
