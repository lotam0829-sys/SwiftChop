import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';

interface NotifSetting { key: string; icon: string; label: string; sub: string; }

const sections: { title: string; items: NotifSetting[] }[] = [
  {
    title: 'ORDER UPDATES',
    items: [
      { key: 'orderConfirmed', icon: 'check-circle', label: 'Order Confirmed', sub: 'When your order is accepted by the restaurant' },
      { key: 'orderPickedUp', icon: 'delivery-dining', label: 'Picked Up', sub: 'When the rider picks up your food' },
      { key: 'orderDelivered', icon: 'where-to-vote', label: 'Delivered', sub: 'When your order arrives at your door' },
    ],
  },
  {
    title: 'PROMOTIONS',
    items: [
      { key: 'deals', icon: 'local-offer', label: 'Deals & Discounts', sub: 'Special offers and promo codes' },
      { key: 'newRestaurants', icon: 'store', label: 'New Restaurants', sub: 'When new restaurants join near you' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { key: 'security', icon: 'security', label: 'Security Alerts', sub: 'Login from new device, password changes' },
      { key: 'newsletter', icon: 'mail', label: 'Newsletter', sub: 'Weekly food highlights and tips' },
    ],
  },
];

export default function NotificationsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    orderConfirmed: true,
    orderPickedUp: true,
    orderDelivered: true,
    deals: true,
    newRestaurants: false,
    security: true,
    newsletter: false,
  });

  const toggle = (key: string) => {
    Haptics.selectionAsync();
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      {sections.map((section, sIdx) => (
        <View key={sIdx} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={styles.iconWrap}>
                <MaterialIcons name={item.icon as any} size={20} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.sub}>{item.sub}</Text>
              </View>
              <Pressable onPress={() => toggle(item.key)} style={[styles.toggle, enabled[item.key] ? styles.toggleOn : null]}>
                <View style={[styles.toggleDot, enabled[item.key] ? styles.toggleDotOn : null]} />
              </Pressable>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  iconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  sub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: theme.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: theme.primary },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', ...theme.shadow.small },
  toggleDotOn: { alignSelf: 'flex-end' },
});
