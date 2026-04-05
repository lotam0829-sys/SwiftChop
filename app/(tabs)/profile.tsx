import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, customerOrders } = useApp();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); logout(); } },
    ]);
  };

  const totalSpent = customerOrders.reduce((s, o) => s + o.total, 0);

  const menuItems = [
    { icon: 'person-outline', label: 'Edit Profile', subtitle: 'Name, email, phone' },
    { icon: 'location-on', label: 'Delivery Addresses', subtitle: 'Manage saved addresses' },
    { icon: 'credit-card', label: 'Payment Methods', subtitle: 'Cards and mobile money' },
    { icon: 'notifications-none', label: 'Notifications', subtitle: 'Order updates, promotions' },
    { icon: 'help-outline', label: 'Help & Support', subtitle: 'FAQ, contact us' },
    { icon: 'info-outline', label: 'About SwiftChop', subtitle: 'Version 1.0.0' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        <View style={styles.titleBar}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@email.com'}</Text>
            <Text style={styles.userPhone}>{user?.phone || '+234 800 000 0000'}</Text>
          </View>
          <Pressable style={styles.editBtn}>
            <MaterialIcons name="edit" size={18} color={theme.primary} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customerOrders.length}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>₦{(totalSpent / 1000).toFixed(0)}k</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{customerOrders.filter(o => o.status === 'delivered').length}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <Pressable key={index} style={styles.menuItem} onPress={() => Haptics.selectionAsync()}>
              <View style={styles.menuIconWrap}>
                <MaterialIcons name={item.icon as any} size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={20} color={theme.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  titleBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  userCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 16, backgroundColor: theme.backgroundSecondary, borderRadius: 16, gap: 14 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  userName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  userEmail: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  userPhone: { fontSize: 13, color: theme.textMuted, marginTop: 1 },
  editBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...theme.shadow.small },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: theme.primaryFaint, borderRadius: 14, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.primary },
  statLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 4, fontWeight: '500' },
  menuSection: { marginTop: 28, marginHorizontal: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight, gap: 14 },
  menuIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  menuSubtitle: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, marginHorizontal: 16, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: theme.errorLight },
  logoutText: { fontSize: 15, fontWeight: '600', color: theme.error },
});
