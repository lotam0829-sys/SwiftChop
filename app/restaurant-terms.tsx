import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const sections = [
  {
    icon: 'description',
    title: 'Terms of Service',
    content: 'By using SwiftChop as a restaurant partner, you agree to maintain food quality standards, accurate menu pricing, timely order preparation, and compliance with local food safety regulations. SwiftChop reserves the right to suspend accounts that violate these terms.',
  },
  {
    icon: 'privacy-tip',
    title: 'Privacy Policy',
    content: 'SwiftChop collects and processes personal data including business registration details, bank information, and order data solely for the purpose of operating the delivery platform. We do not sell your data to third parties. All financial data is encrypted using industry-standard security protocols.',
  },
  {
    icon: 'gavel',
    title: 'Restaurant Partner Agreement',
    content: 'As a restaurant partner, you grant SwiftChop permission to display your menu, process customer orders on your behalf, and facilitate payments. Commission rates and service fees are outlined in your onboarding agreement. Payments are settled weekly to your registered bank account.',
  },
  {
    icon: 'account-balance-wallet',
    title: 'Commission & Fees',
    content: 'SwiftChop applies a service fee on each order processed through the platform. Delivery fees are calculated based on distance and paid by the customer. The exact commission structure is detailed during the onboarding process and may be updated with prior notice.',
  },
  {
    icon: 'block',
    title: 'Suspension & Termination',
    content: 'Accounts may be suspended for repeated order cancellations, food quality complaints, or violation of platform policies. You may terminate your partnership at any time by contacting support. Outstanding payments will be settled within 14 business days of account closure.',
  },
  {
    icon: 'cookie',
    title: 'Cookie & Data Policy',
    content: 'The SwiftChop app uses local storage and cookies to maintain your session, preferences, and analytics data. This data is used to improve your experience and is not shared with external advertisers.',
  },
];

export default function RestaurantTermsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <View style={styles.headerCard}>
          <MaterialIcons name="policy" size={28} color={theme.primary} />
          <Text style={styles.headerTitle}>Terms & Policies</Text>
          <Text style={styles.headerSub}>Legal information governing your partnership with SwiftChop</Text>
        </View>

        {sections.map((section, idx) => (
          <View key={idx} style={styles.policyCard}>
            <View style={styles.policyHeader}>
              <View style={styles.policyIcon}>
                <MaterialIcons name={section.icon as any} size={20} color={theme.primary} />
              </View>
              <Text style={styles.policyTitle}>{section.title}</Text>
            </View>
            <Text style={styles.policyContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last updated: March 2026</Text>
          <Text style={styles.footerText}>{"\u00A9"} 2026 SwiftChop. All rights reserved.</Text>
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
  policyCard: { marginHorizontal: 16, padding: 18, backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 14 },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  policyIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  policyTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', flex: 1 },
  policyContent: { fontSize: 14, color: '#999', lineHeight: 22 },
  footer: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  footerText: { fontSize: 12, color: '#555' },
});
