import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const sections = [
  {
    icon: 'cookie',
    title: 'What Are Cookies & Local Storage',
    content: 'Cookies and local storage are small pieces of data stored on your device. In our mobile app, we use local storage (AsyncStorage) to save your preferences, session data, and cached information to provide a faster and more personalised experience.',
  },
  {
    icon: 'login',
    title: 'Authentication & Session',
    content: 'We store your authentication session token locally so you remain logged in between app sessions. This token is encrypted and automatically refreshed for security. Logging out clears all session data from your device.',
  },
  {
    icon: 'shopping-cart',
    title: 'Cart Data',
    content: 'Your shopping cart contents are stored locally on your device so items are preserved if you close and reopen the app. Cart data is automatically cleared after a successful order or manual removal.',
  },
  {
    icon: 'settings',
    title: 'User Preferences',
    content: 'We store your notification preferences, display settings, and last-used delivery address locally to provide a seamless experience without requiring repeated configuration.',
  },
  {
    icon: 'analytics',
    title: 'Analytics',
    content: 'We may collect anonymous usage data (screen views, feature usage, crash reports) to improve app performance and user experience. This data cannot be used to identify you personally.',
  },
  {
    icon: 'delete',
    title: 'Managing Your Data',
    content: 'You can clear all locally stored data by logging out of the app or clearing the app data through your device settings (Settings > Apps > SwiftChop > Clear Data). Note that this will log you out and reset all preferences.',
  },
  {
    icon: 'security',
    title: 'Third-Party Services',
    content: 'Our app integrates with third-party services (payment processing, push notifications, mapping) that may use their own cookies or tracking mechanisms. These services operate under their own privacy policies.',
  },
];

export default function CustomerCookiesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Cookie & Data Policy</Text>
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
