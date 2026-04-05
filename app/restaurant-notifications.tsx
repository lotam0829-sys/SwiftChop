import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAlert } from '@/template';

interface NotifSetting { key: string; icon: string; label: string; sub: string; }

const sections: { title: string; items: NotifSetting[] }[] = [
  {
    title: 'ORDER ALERTS',
    items: [
      { key: 'newOrder', icon: 'receipt-long', label: 'New Orders', sub: 'Get notified immediately when a new order arrives' },
      { key: 'orderAccepted', icon: 'check-circle', label: 'Order Accepted', sub: 'Confirmation when your order is picked up by a rider' },
      { key: 'orderDelivered', icon: 'where-to-vote', label: 'Order Delivered', sub: 'Notification when delivery is completed' },
      { key: 'orderCancelled', icon: 'cancel', label: 'Order Cancelled', sub: 'Alert when a customer cancels an order' },
    ],
  },
  {
    title: 'BUSINESS',
    items: [
      { key: 'weeklyReport', icon: 'trending-up', label: 'Weekly Reports', sub: 'Revenue and performance summary every Monday' },
      { key: 'lowStock', icon: 'inventory', label: 'Low Stock Alerts', sub: 'When menu items are running low' },
      { key: 'reviews', icon: 'rate-review', label: 'New Reviews', sub: 'When customers leave feedback' },
    ],
  },
  {
    title: 'PLATFORM',
    items: [
      { key: 'promotions', icon: 'campaign', label: 'Promotions', sub: 'Tips and offers to boost your sales' },
      { key: 'updates', icon: 'system-update', label: 'App Updates', sub: 'New features and improvements' },
    ],
  },
];

export default function RestaurantNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    newOrder: true, orderAccepted: true, orderDelivered: true, orderCancelled: true,
    weeklyReport: true, lowStock: false, reviews: true,
    promotions: false, updates: true,
  });

  const toggle = (key: string) => {
    if (key === 'newOrder') {
      showAlert('Required', 'New order notifications cannot be disabled.');
      return;
    }
    Haptics.selectionAsync();
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.container}>
      <ScrollView
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#666', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  sub: { fontSize: 12, color: '#999', marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#2A2A2A', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: theme.primary },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#666' },
  toggleDotOn: { backgroundColor: '#FFF', alignSelf: 'flex-end' },
});
