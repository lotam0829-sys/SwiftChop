import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function RestaurantProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useApp();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); logout(); } },
    ]);
  };

  const settingsSections = [
    {
      title: 'RESTAURANT',
      items: [
        { icon: 'storefront', label: 'Restaurant Info', sub: 'Name, address, cuisine type' },
        { icon: 'schedule', label: 'Operating Hours', sub: 'Set your open/close times' },
        { icon: 'delivery-dining', label: 'Delivery Settings', sub: 'Fees, radius, minimum order' },
        { icon: 'photo-camera', label: 'Photos', sub: 'Cover image, gallery' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { icon: 'person', label: 'Account Details', sub: user?.email || '' },
        { icon: 'account-balance', label: 'Bank Details', sub: 'Payment withdrawal settings' },
        { icon: 'notifications', label: 'Notifications', sub: 'Order alerts, promotions' },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        { icon: 'help', label: 'Help Centre', sub: 'FAQ and guides' },
        { icon: 'chat', label: 'Contact Support', sub: 'Chat with our team' },
        { icon: 'description', label: 'Terms & Policies', sub: 'Legal information' },
      ],
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <View style={styles.titleBar}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Restaurant Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <MaterialIcons name="storefront" size={28} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.restaurantName || 'My Restaurant'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={14} color="#10B981" />
              <Text style={styles.verifiedText}>Verified Partner</Text>
            </View>
          </View>
        </View>

        {/* Settings Groups */}
        {settingsSections.map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, iIdx) => (
              <Pressable key={iIdx} style={styles.settingRow} onPress={() => Haptics.selectionAsync()}>
                <View style={styles.settingIconWrap}>
                  <MaterialIcons name={item.icon as any} size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Text style={styles.settingSub}>{item.sub}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#666" />
              </Pressable>
            ))}
          </View>
        ))}

        {/* Version */}
        <Text style={styles.version}>SwiftChop Restaurant v1.0.0</Text>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  titleBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 12, padding: 18, backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  avatarCircle: { width: 56, height: 56, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  profileEmail: { fontSize: 13, color: '#999', marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  section: { marginTop: 28, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#666', letterSpacing: 1, marginBottom: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  settingIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  settingSub: { fontSize: 12, color: '#999', marginTop: 2 },
  version: { textAlign: 'center', fontSize: 12, color: '#555', marginTop: 32, marginBottom: 16 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.3)' },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
});
