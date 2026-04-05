import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const sections = [
  {
    icon: 'handshake',
    title: 'Acceptance of Terms',
    content: 'By downloading, installing, or using the SwiftChop application, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.',
  },
  {
    icon: 'shopping-bag',
    title: 'Ordering & Payments',
    content: 'All orders placed through SwiftChop are subject to restaurant acceptance and availability. Payments are processed securely via card only. Prices displayed include the item cost; delivery and service fees are shown separately at checkout.',
  },
  {
    icon: 'delivery-dining',
    title: 'Delivery',
    content: 'Estimated delivery times are calculated based on distance and restaurant preparation time. Actual delivery times may vary. SwiftChop is not liable for delays caused by traffic, weather, or unforeseen circumstances.',
  },
  {
    icon: 'cancel',
    title: 'Cancellations & Refunds',
    content: 'Orders may be cancelled within 2 minutes of placement at no charge. After this window, cancellations are subject to restaurant and rider status. Refunds for quality issues must be reported within 30 minutes of delivery.',
  },
  {
    icon: 'person',
    title: 'User Accounts',
    content: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information during registration and to update your profile as needed.',
  },
  {
    icon: 'block',
    title: 'Prohibited Conduct',
    content: 'Users must not misuse the platform, submit fraudulent orders, harass delivery riders or restaurant staff, or attempt to manipulate pricing, ratings, or reviews.',
  },
  {
    icon: 'gavel',
    title: 'Limitation of Liability',
    content: 'SwiftChop acts as a marketplace connecting customers with restaurants. We are not directly responsible for food preparation, quality, or allergen information. Restaurants are solely responsible for the accuracy of their menu listings.',
  },
  {
    icon: 'update',
    title: 'Changes to Terms',
    content: 'SwiftChop reserves the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms. Users will be notified of significant changes via email or in-app notification.',
  },
];

export default function CustomerTermsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Terms of Service</Text>
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
