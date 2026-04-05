import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';

export default function DeliveryAddressesScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { userProfile, updateProfile } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const savedAddress = userProfile?.address;

  const handleUpdatePrimary = async (address: string) => {
    await updateProfile({ address });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Updated', 'Primary delivery address updated');
  };

  const handleAdd = () => {
    if (!newAddress.trim()) {
      showAlert('Error', 'Please enter an address');
      return;
    }
    handleUpdatePrimary(newAddress.trim());
    setNewLabel('');
    setNewAddress('');
    setShowAdd(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Delivery Addresses</Text>

        {savedAddress ? (
          <View style={[styles.addressCard, styles.addressCardDefault]}>
            <View style={styles.addressIcon}>
              <MaterialIcons name="home" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.addressLabel}>Primary Address</Text>
                <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>Default</Text></View>
              </View>
              <Text style={styles.addressText} numberOfLines={2}>{savedAddress}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="location-off" size={36} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>No address saved</Text>
            <Text style={styles.emptySubtitle}>Add your delivery address below or enable location permissions for auto-detection.</Text>
          </View>
        )}

        {showAdd ? (
          <View style={styles.addForm}>
            <View style={styles.field}>
              <Text style={styles.label}>Label (optional)</Text>
              <TextInput style={styles.input} value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Home, Office" placeholderTextColor={theme.textMuted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Address *</Text>
              <TextInput style={styles.input} value={newAddress} onChangeText={setNewAddress} placeholder="Full delivery address" placeholderTextColor={theme.textMuted} multiline />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowAdd(false)} style={[styles.formBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.formBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAdd} style={[styles.formBtn, { backgroundColor: theme.primary, flex: 2 }]}>
                <Text style={[styles.formBtnText, { color: '#FFF' }]}>Save Address</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => { setShowAdd(true); Haptics.selectionAsync(); }} style={styles.addBtn}>
            <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
            <Text style={styles.addBtnText}>{savedAddress ? 'Update Address' : 'Add Address'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  addressCardDefault: { borderColor: theme.primary, backgroundColor: theme.primaryFaint },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  addressText: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  defaultBadge: { backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  emptyState: { alignItems: 'center', paddingVertical: 32, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.primary, marginTop: 8 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  addForm: { padding: 16, backgroundColor: theme.backgroundSecondary, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: theme.border },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  formBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  formBtnText: { fontSize: 14, fontWeight: '600' },
});
