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

  const cards = [
    { id: '1', type: 'Visa', last4: '4532', expiry: '12/27', isDefault: true },
    { id: '2', type: 'Mastercard', last4: '8891', expiry: '06/26', isDefault: false },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.sectionTitle}>Saved Cards</Text>
      {cards.map((card) => (
        <View key={card.id} style={[styles.cardRow, card.isDefault ? styles.cardRowDefault : null]}>
          <View style={styles.cardIcon}>
            <MaterialIcons name="credit-card" size={24} color={card.isDefault ? theme.primary : theme.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.cardType}>{card.type}</Text>
              {card.isDefault ? (
                <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
              ) : null}
            </View>
            <Text style={styles.cardNumber}>{"\u2022\u2022\u2022\u2022 "}{card.last4}  |  {card.expiry}</Text>
          </View>
          <Pressable onPress={() => { Haptics.selectionAsync(); showAlert('Card Options', 'Manage this card', [{ text: 'Set as Default' }, { text: 'Remove', style: 'destructive' }, { text: 'Cancel', style: 'cancel' }]); }}>
            <MaterialIcons name="more-vert" size={22} color={theme.textMuted} />
          </Pressable>
        </View>
      ))}

      <Pressable onPress={() => { Haptics.selectionAsync(); showAlert('Coming Soon', 'Stripe payment integration will be available shortly.'); }} style={styles.addBtn}>
        <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
        <Text style={styles.addBtnText}>Add New Card</Text>
      </Pressable>

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Other Payment Methods</Text>

      {[
        { icon: 'account-balance', label: 'Bank Transfer', sub: 'Pay directly from your bank' },
        { icon: 'payments', label: 'Cash on Delivery', sub: 'Pay the rider when your order arrives' },
      ].map((method, idx) => (
        <View key={idx} style={styles.methodRow}>
          <View style={styles.methodIcon}>
            <MaterialIcons name={method.icon as any} size={22} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.methodLabel}>{method.label}</Text>
            <Text style={styles.methodSub}>{method.sub}</Text>
          </View>
          <MaterialIcons name="check-circle" size={20} color={theme.success} />
        </View>
      ))}

      <View style={styles.securityNote}>
        <MaterialIcons name="lock" size={16} color={theme.success} />
        <Text style={styles.securityText}>All payment information is encrypted and securely stored using industry-standard PCI compliance.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  cardRowDefault: { borderColor: theme.primary, backgroundColor: theme.primaryFaint },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...theme.shadow.small },
  cardType: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  cardNumber: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  defaultBadge: { backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.primary, marginTop: 4, marginBottom: 8 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 24 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  methodIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  methodSub: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 24, paddingHorizontal: 4 },
  securityText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
