import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { config } from '../../constants/config';

export default function RiderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile } = useApp();
  const { logout } = useAuth();
  const { showAlert } = useAlert();

  const router = require('expo-router').useRouter();
  const [paymentNotifications, setPaymentNotifications] = useState(true);
  const [promotionalNotifications, setPromotionalNotifications] = useState(false);
  const [deliveryAlerts, setDeliveryAlerts] = useState(true);

  const handleLogout = () => {
    showAlert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@swiftchop.com?subject=Rider Support Request');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <Pressable onPress={() => router.push('/edit-rider-profile' as any)} style={styles.linkRow}>
            <MaterialIcons name="edit" size={20} color="#10B981" />
            <Text style={styles.linkText}>Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
          </Pressable>

          <Pressable onPress={() => {
            Linking.openURL(Platform.OS === 'ios' 
              ? 'https://apps.apple.com/ca/app/shipday-drive/id1531504620'
              : 'https://play.google.com/store/apps/details?id=com.shipday.driver'
            );
          }} style={styles.linkRow}>
            <MaterialIcons name="delivery-dining" size={20} color="#10B981" />
            <Text style={styles.linkText}>Open Shipday Drive</Text>
            <MaterialIcons name="open-in-new" size={20} color="#6B7280" />
          </Pressable>
        </View>

        {/* Notifications */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="account-balance-wallet" size={20} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Payment Updates</Text>
                <Text style={styles.settingDesc}>Notifications for completed payments and transfers</Text>
              </View>
            </View>
            <Switch
              value={paymentNotifications}
              onValueChange={setPaymentNotifications}
              trackColor={{ false: '#3A3A3A', true: 'rgba(16,185,129,0.4)' }}
              thumbColor={paymentNotifications ? '#10B981' : '#6B7280'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="notifications-active" size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Delivery Alerts</Text>
                <Text style={styles.settingDesc}>Sound and vibration for new delivery requests</Text>
              </View>
            </View>
            <Switch
              value={deliveryAlerts}
              onValueChange={setDeliveryAlerts}
              trackColor={{ false: '#3A3A3A', true: 'rgba(16,185,129,0.4)' }}
              thumbColor={deliveryAlerts ? '#10B981' : '#6B7280'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="campaign" size={20} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Promotions</Text>
                <Text style={styles.settingDesc}>Special bonuses and earning opportunities</Text>
              </View>
            </View>
            <Switch
              value={promotionalNotifications}
              onValueChange={setPromotionalNotifications}
              trackColor={{ false: '#3A3A3A', true: 'rgba(16,185,129,0.4)' }}
              thumbColor={promotionalNotifications ? '#10B981' : '#6B7280'}
            />
          </View>
        </View>

        {/* Support */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Support</Text>

          <Pressable onPress={handleContactSupport} style={styles.linkRow}>
            <MaterialIcons name="headset-mic" size={20} color="#6B7280" />
            <Text style={styles.linkText}>Contact Support</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
          </Pressable>

          <Pressable onPress={() => Linking.openURL('https://swiftchop.com/rider-faq')} style={styles.linkRow}>
            <MaterialIcons name="help-outline" size={20} color="#6B7280" />
            <Text style={styles.linkText}>FAQ</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
          </Pressable>

          <Pressable onPress={() => Linking.openURL('https://swiftchop.com/rider-terms')} style={styles.linkRow}>
            <MaterialIcons name="description" size={20} color="#6B7280" />
            <Text style={styles.linkText}>Terms of Service</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
          </Pressable>
        </View>

        {/* Account */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.accountInfo}>
            <Text style={styles.accountEmail}>{userProfile?.email}</Text>
            <Text style={styles.accountRole}>Dispatch Rider</Text>
          </View>

          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' }}>
            <Text style={{ fontSize: 13, color: '#F87171', lineHeight: 19 }}>
              To delete your account or request data export, please contact support at {config.supportEmail}
            </Text>
          </View>
        </View>

        <Text style={styles.versionText}>SwiftChop Rider v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', paddingHorizontal: 20, paddingVertical: 16 },
  sectionCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2A2A2A' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  settingInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#E5E7EB' },
  settingDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#E5E7EB' },
  accountInfo: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', marginBottom: 12 },
  accountEmail: { fontSize: 15, fontWeight: '500', color: '#E5E7EB' },
  accountRole: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)', marginTop: 4 },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  versionText: { textAlign: 'center', fontSize: 12, color: '#4B5563', paddingVertical: 16 },
});
