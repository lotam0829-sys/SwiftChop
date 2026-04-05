import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { config } from '../constants/config';

const faqs = [
  { q: 'How do I track my order?', a: 'After placing an order, go to Orders tab and tap on the active order to see real-time delivery tracking.' },
  { q: 'How can I cancel an order?', a: 'You can cancel within 2 minutes of placing. After that, contact support for help.' },
  { q: 'What payment methods are accepted?', a: 'We accept debit/credit cards, bank transfers, and cash on delivery.' },
  { q: 'How is the delivery fee calculated?', a: 'Delivery fees are based on the distance between the restaurant and your delivery address. A base fee plus per-kilometre rate applies.' },
  { q: 'My order arrived cold/damaged', a: 'Contact our support team within 30 minutes of delivery and we will arrange a refund or replacement.' },
];

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <View style={styles.contactCard}>
        <View style={styles.contactIconWrap}>
          <MaterialIcons name="support-agent" size={32} color={theme.primary} />
        </View>
        <Text style={styles.contactTitle}>Need help?</Text>
        <Text style={styles.contactSub}>Our support team is available 24/7</Text>
        <View style={styles.contactActions}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`mailto:${config.supportEmail}`); }} style={styles.contactBtn}>
            <MaterialIcons name="email" size={20} color={theme.primary} />
            <Text style={styles.contactBtnText}>Email Us</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`tel:${config.supportPhone}`); }} style={styles.contactBtn}>
            <MaterialIcons name="phone" size={20} color={theme.primary} />
            <Text style={styles.contactBtnText}>Call Us</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {faqs.map((faq, idx) => (
        <Pressable key={idx} onPress={() => { Haptics.selectionAsync(); setExpanded(expanded === idx ? null : idx); }} style={styles.faqCard}>
          <View style={styles.faqHeader}>
            <Text style={styles.faqQ}>{faq.q}</Text>
            <MaterialIcons name={expanded === idx ? 'expand-less' : 'expand-more'} size={22} color={theme.textMuted} />
          </View>
          {expanded === idx ? <Text style={styles.faqA}>{faq.a}</Text> : null}
        </Pressable>
      ))}

      <View style={{ height: 24 }} />
      <Text style={styles.sectionTitle}>Legal</Text>
      {['Terms of Service', 'Privacy Policy', 'Cookie Policy'].map((item, idx) => (
        <Pressable key={idx} style={styles.legalRow} onPress={() => Haptics.selectionAsync()}>
          <MaterialIcons name="description" size={20} color={theme.textMuted} />
          <Text style={styles.legalLabel}>{item}</Text>
          <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  contactCard: { backgroundColor: theme.primaryFaint, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 28, borderWidth: 1, borderColor: theme.primaryMuted },
  contactIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...theme.shadow.small },
  contactTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  contactSub: { fontSize: 14, color: theme.textSecondary, marginBottom: 20 },
  contactActions: { flexDirection: 'row', gap: 12, width: '100%' },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: theme.border },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  faqCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  faqQ: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, flex: 1, lineHeight: 20 },
  faqA: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  legalLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.textPrimary },
});
