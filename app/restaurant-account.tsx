import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function RestaurantAccountScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, updateProfile } = useApp();
  const { showAlert } = useAlert();

  const [username, setUsername] = useState(userProfile?.username || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [saving, setSaving] = useState(false);

  // Bank details (local state for now)
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({ username, phone, address });
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Saved', 'Account details updated successfully');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Your name" placeholderTextColor="#666" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.input, styles.disabledInput]}>
                <Text style={styles.disabledText}>{userProfile?.email || 'Not set'}</Text>
                <MaterialIcons name="lock" size={16} color="#666" />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" placeholderTextColor="#666" keyboardType="phone-pad" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your address" placeholderTextColor="#666" />
            </View>
          </View>

          {/* Bank Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="account-balance" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Bank Details</Text>
            </View>
            <Text style={styles.sectionSub}>For receiving payments from orders</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g. GTBank" placeholderTextColor="#666" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Number</Text>
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="0123456789" placeholderTextColor="#666" keyboardType="number-pad" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="Account holder name" placeholderTextColor="#666" />
            </View>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="notifications" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Notification Preferences</Text>
            </View>

            {[
              { icon: 'receipt-long', label: 'New Orders', sub: 'Get notified when you receive a new order', enabled: true },
              { icon: 'campaign', label: 'Promotions', sub: 'Tips and special offers from SwiftChop', enabled: false },
              { icon: 'trending-up', label: 'Weekly Reports', sub: 'Revenue and performance summary', enabled: true },
            ].map((item, idx) => (
              <View key={idx} style={styles.notifRow}>
                <View style={styles.notifIconWrap}>
                  <MaterialIcons name={item.icon as any} size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifLabel}>{item.label}</Text>
                  <Text style={styles.notifSub}>{item.sub}</Text>
                </View>
                <Pressable
                  onPress={() => Haptics.selectionAsync()}
                  style={[styles.toggle, item.enabled && styles.toggleActive]}
                >
                  <View style={[styles.toggleDot, item.enabled && styles.toggleDotActive]} />
                </Pressable>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <PrimaryButton label="Save Changes" onPress={handleSave} loading={saving} variant="primary" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sectionSub: { fontSize: 13, color: '#999', marginBottom: 16 },
  field: { marginTop: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  disabledInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabledText: { fontSize: 15, color: '#666' },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  notifIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,107,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  notifLabel: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  notifSub: { fontSize: 12, color: '#999', marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#2A2A2A', justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: theme.primary },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#666' },
  toggleDotActive: { backgroundColor: '#FFF', alignSelf: 'flex-end' },
});
