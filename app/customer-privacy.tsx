import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const sections = [
  {
    icon: 'info',
    title: 'Information We Collect',
    content: 'We collect personal information you provide during registration (name, email, phone number), delivery addresses, order history, payment details (processed securely via Stripe), and device information including location data when you grant permission.',
  },
  {
    icon: 'analytics',
    title: 'How We Use Your Data',
    content: 'Your data is used to process and deliver orders, personalise your experience (nearby restaurants, recommendations), communicate order updates and promotions, calculate delivery fees based on distance, and improve our platform and services.',
  },
  {
    icon: 'location-on',
    title: 'Location Data',
    content: 'With your permission, we collect location data to show nearby restaurants, calculate accurate delivery fees and times, and track deliveries in real time. You can revoke location permission at any time via your device settings.',
  },
  {
    icon: 'share',
    title: 'Data Sharing',
    content: 'We share necessary information with restaurants (your order details and delivery address), delivery riders (delivery address and contact), and payment processors (encrypted card data). We do not sell your personal data to third parties.',
  },
  {
    icon: 'lock',
    title: 'Data Security',
    content: 'We use industry-standard encryption (TLS/SSL) to protect data in transit. Payment information is processed through PCI-compliant systems. Access to personal data is restricted to authorised personnel only.',
  },
  {
    icon: 'manage-accounts',
    title: 'Your Rights',
    content: 'You have the right to access, correct, or delete your personal data. You can update your profile information at any time in the app. To request data deletion, contact our support team.',
  },
  {
    icon: 'notifications',
    title: 'Communications',
    content: 'We send order-related notifications (status updates, delivery alerts) and occasional promotional messages. You can manage notification preferences in Settings > Notifications.',
  },
  {
    icon: 'child-care',
    title: 'Children\'s Privacy',
    content: 'SwiftChop is not intended for users under the age of 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such data, please contact us immediately.',
  },
];

export default function CustomerPrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: March 2026</Text>

      {sections.map((section, idx) => (
        <View key={idx} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <MaterialIcons name={section.icon as any} size={20} color={theme.primary} />
            </View>
            <Text style={styles.cardTitle}>{section.title}</Text>
          </View>
          <Text style={styles.cardContent}>{section.content}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{"\u00A9"} 2026 SwiftChop. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  lastUpdated: { fontSize: 13, color: theme.textMuted, marginBottom: 24 },
  card: { padding: 18, backgroundColor: theme.backgroundSecondary, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  cardContent: { fontSize: 14, color: theme.textSecondary, lineHeight: 22 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 12, color: theme.textMuted },
});
