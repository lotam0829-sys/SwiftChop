import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { config } from '../constants/config';

const faqs = [
  { q: 'How do I update my restaurant menu?', a: 'Go to the Menu tab in your dashboard. Tap the + button to add items, or swipe to edit/delete existing ones.' },
  { q: 'When do I receive payments?', a: 'Payments are settled weekly to your registered bank account. You can view your earnings in the Dashboard.' },
  { q: 'How do I change my operating hours?', a: 'Go to Settings > Operating Hours. Set your daily open and close times.' },
  { q: 'What if a customer complains about an order?', a: 'Contact our support team immediately. We handle disputes and issue refunds when appropriate.' },
  { q: 'How do I pause receiving orders?', a: 'Toggle the "Open" status on your Dashboard to temporarily stop receiving new orders.' },
];

export default function RestaurantSupportScreen() {
  const insets = useSafeAreaInsets();

  const [expanded, setExpanded] = React.useState<number | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        {/* Contact Card */}
        <View style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <MaterialIcons name="support-agent" size={32} color={theme.primary} />
          </View>
          <Text style={styles.contactTitle}>Need help?</Text>
          <Text style={styles.contactSub}>Our support team is available 24/7 to help with any issues</Text>

          <View style={styles.contactActions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`mailto:${config.supportEmail}`); }}
              style={styles.contactBtn}
            >
              <MaterialIcons name="email" size={20} color={theme.primary} />
              <Text style={styles.contactBtnText}>Email Us</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`tel:${config.supportPhone}`); }}
              style={styles.contactBtn}
            >
              <MaterialIcons name="phone" size={20} color={theme.primary} />
              <Text style={styles.contactBtnText}>Call Us</Text>
            </Pressable>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((faq, idx) => (
            <Pressable
              key={idx}
              onPress={() => { Haptics.selectionAsync(); setExpanded(expanded === idx ? null : idx); }}
              style={styles.faqCard}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQ}>{faq.q}</Text>
                <MaterialIcons name={expanded === idx ? 'expand-less' : 'expand-more'} size={22} color="#999" />
              </View>
              {expanded === idx ? <Text style={styles.faqA}>{faq.a}</Text> : null}
            </Pressable>
          ))}
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          {[
            { icon: 'description', label: 'Terms of Service' },
            { icon: 'privacy-tip', label: 'Privacy Policy' },
            { icon: 'gavel', label: 'Restaurant Partner Agreement' },
            { icon: 'cookie', label: 'Cookie Policy' },
          ].map((item, idx) => (
            <Pressable key={idx} style={styles.legalRow} onPress={() => Haptics.selectionAsync()}>
              <MaterialIcons name={item.icon as any} size={20} color="#999" />
              <Text style={styles.legalLabel}>{item.label}</Text>
              <MaterialIcons name="open-in-new" size={16} color="#666" />
            </Pressable>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>SwiftChop Restaurant</Text>
          <Text style={styles.infoVersion}>Version 1.0.0 (Build 1)</Text>
          <Text style={styles.infoCopyright}>© 2026 SwiftChop. All rights reserved.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  contactCard: { marginHorizontal: 16, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28 },
  contactIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  contactTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  contactSub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  contactActions: { flexDirection: 'row', gap: 12, width: '100%' },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,107,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,0,0.3)' },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 14 },
  faqCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  faqQ: { fontSize: 14, fontWeight: '600', color: '#FFF', flex: 1, lineHeight: 20 },
  faqA: { fontSize: 14, color: '#999', lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  legalLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#CCC' },
  infoCard: { alignItems: 'center', paddingVertical: 24, marginHorizontal: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#666' },
  infoVersion: { fontSize: 13, color: '#555', marginTop: 4 },
  infoCopyright: { fontSize: 12, color: '#444', marginTop: 8 },
});
