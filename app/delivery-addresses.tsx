import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAlert } from '@/template';

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  icon: string;
}

export default function DeliveryAddressesScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [addresses, setAddresses] = useState<SavedAddress[]>([
    { id: '1', label: 'Home', address: '5 Adeola Hopewell St, Victoria Island, Lagos', icon: 'home' },
    { id: '2', label: 'Office', address: '15 Broad St, Lagos Island, Lagos', icon: 'work' },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim() || !newAddress.trim()) {
      showAlert('Error', 'Please fill in both label and address');
      return;
    }
    setAddresses(prev => [...prev, { id: Date.now().toString(), label: newLabel.trim(), address: newAddress.trim(), icon: 'place' }]);
    setNewLabel('');
    setNewAddress('');
    setShowAdd(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = (id: string) => {
    showAlert('Delete Address', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { setAddresses(prev => prev.filter(a => a.id !== id)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {addresses.map((addr) => (
          <View key={addr.id} style={styles.addressCard}>
            <View style={styles.addressIcon}>
              <MaterialIcons name={addr.icon as any} size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>{addr.label}</Text>
              <Text style={styles.addressText} numberOfLines={2}>{addr.address}</Text>
            </View>
            <Pressable onPress={() => handleDelete(addr.id)} hitSlop={12}>
              <MaterialIcons name="delete-outline" size={20} color={theme.error} />
            </Pressable>
          </View>
        ))}

        {showAdd ? (
          <View style={styles.addForm}>
            <View style={styles.field}>
              <Text style={styles.label}>Label</Text>
              <TextInput style={styles.input} value={newLabel} onChangeText={setNewLabel} placeholder="e.g. Home, Office" placeholderTextColor={theme.textMuted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
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
            <Text style={styles.addBtnText}>Add New Address</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  addressText: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.primary, marginTop: 8 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  addForm: { padding: 16, backgroundColor: theme.backgroundSecondary, borderRadius: 14, marginTop: 8, borderWidth: 1, borderColor: theme.border },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  formBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  formBtnText: { fontSize: 14, fontWeight: '600' },
});
