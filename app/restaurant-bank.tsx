import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';

export default function RestaurantBankScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, updateProfile } = useApp();
  const { showAlert } = useAlert();

  const [bankName, setBankName] = useState((userProfile as any)?.bank_name || '');
  const [accountNumber, setAccountNumber] = useState((userProfile as any)?.bank_account_number || '');
  const [accountName, setAccountName] = useState((userProfile as any)?.bank_account_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!bankName.trim()) { showAlert('Required', 'Please enter your bank name'); return; }
    if (!accountNumber.trim() || accountNumber.trim().length < 10) { showAlert('Required', 'Please enter a valid 10-digit account number'); return; }
    if (!accountName.trim()) { showAlert('Required', 'Please enter the account holder name'); return; }

    setSaving(true);
    await updateProfile({
      bank_name: bankName.trim(),
      bank_account_number: accountNumber.trim(),
      bank_account_name: accountName.trim(),
    } as any);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Saved', 'Bank details updated successfully');
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoCard}>
            <MaterialIcons name="account-balance" size={24} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Payment Settlement</Text>
              <Text style={styles.infoText}>Your earnings from customer orders are settled to this bank account weekly every Friday.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.field}>
              <Text style={styles.label}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. GTBank, First Bank, Access Bank"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Number *</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                placeholder="0123456789"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={10}
              />
              <Text style={styles.hint}>10-digit Nigerian bank account number</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account Name *</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Name as it appears on your bank account"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.securityNote}>
            <MaterialIcons name="lock" size={16} color={theme.success} />
            <Text style={styles.securityText}>Your bank information is encrypted and securely stored. Only used for payment settlement.</Text>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <Pressable onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Bank Details'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginHorizontal: 16, padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,107,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)', marginBottom: 24 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  infoText: { fontSize: 14, color: '#999', lineHeight: 20 },
  section: { paddingHorizontal: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  hint: { fontSize: 12, color: '#666', marginTop: 6 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 20, marginTop: 8 },
  securityText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 17 },
  saveBtn: { backgroundColor: theme.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
