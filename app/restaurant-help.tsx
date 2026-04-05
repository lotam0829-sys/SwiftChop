import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

const faqSections = [
  {
    title: 'Getting Started',
    faqs: [
      { q: 'How do I set up my restaurant?', a: 'Complete the onboarding process by providing your restaurant details, uploading your business certificate, and adding bank details. Once approved, your restaurant will be live.' },
      { q: 'How long does approval take?', a: 'Restaurant approval typically takes 1-3 business days. You will be notified via email once your account is verified.' },
    ],
  },
  {
    title: 'Menu Management',
    faqs: [
      { q: 'How do I update my restaurant menu?', a: 'Go to the Menu tab in your dashboard. Tap the + button to add items. You can create custom categories, upload images, set prices, and mark items as popular.' },
      { q: 'Can I create my own categories?', a: 'Yes. In the Menu tab, tap "Manage" next to the category filter to add, rename, or remove categories that suit your restaurant.' },
      { q: 'How do I hide a menu item temporarily?', a: 'Tap the eye icon next to any menu item to toggle its visibility. Hidden items will not appear to customers.' },
    ],
  },
  {
    title: 'Orders & Payments',
    faqs: [
      { q: 'When do I receive payments?', a: 'Payments are settled weekly to your registered bank account. You can view your earnings in the Dashboard analytics section.' },
      { q: 'What is the service fee?', a: 'A small service fee is applied per order to cover platform operations. This is transparently shown to customers at checkout.' },
      { q: 'What if a customer complains about an order?', a: 'Contact our support team immediately through the Contact Support page. We handle disputes and issue refunds when appropriate.' },
    ],
  },
  {
    title: 'Operations',
    faqs: [
      { q: 'How do I change my operating hours?', a: 'Go to Settings > Operating Hours. Set your daily open and close times for each day of the week.' },
      { q: 'How do I pause receiving orders?', a: 'Toggle the "Open/Closed" status on your Dashboard to temporarily stop receiving new orders. You can reopen at any time.' },
      { q: 'How is the delivery fee calculated?', a: 'Delivery fees are automatically calculated based on the distance between your restaurant and the customer. You do not need to set this manually.' },
    ],
  },
];

export default function RestaurantHelpScreen() {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleFaq = (key: string) => {
    Haptics.selectionAsync();
    setExpanded(expanded === key ? null : key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <View style={styles.headerCard}>
          <MaterialIcons name="menu-book" size={28} color={theme.primary} />
          <Text style={styles.headerTitle}>Help Centre</Text>
          <Text style={styles.headerSub}>Find answers to common questions about managing your restaurant</Text>
        </View>

        {faqSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.faqs.map((faq, fIdx) => {
              const key = `${sIdx}-${fIdx}`;
              const isExpanded = expanded === key;
              return (
                <Pressable key={key} onPress={() => toggleFaq(key)} style={styles.faqCard}>
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQ}>{faq.q}</Text>
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={22} color="#999" />
                  </View>
                  {isExpanded ? <Text style={styles.faqA}>{faq.a}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.footerCard}>
          <MaterialIcons name="info-outline" size={18} color="#999" />
          <Text style={styles.footerText}>
            Cannot find what you are looking for? Use the Contact Support page to reach our team directly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  headerCard: { alignItems: 'center', marginHorizontal: 16, padding: 24, backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24, gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.primary, marginBottom: 12, letterSpacing: 0.3 },
  faqCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  faqQ: { fontSize: 14, fontWeight: '600', color: '#FFF', flex: 1, lineHeight: 20 },
  faqA: { fontSize: 14, color: '#999', lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  footerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, padding: 16, backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  footerText: { flex: 1, fontSize: 13, color: '#999', lineHeight: 19 },
});
