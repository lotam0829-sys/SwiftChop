import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { updateRestaurant } from '../services/supabaseData';
import { deliveryPricing } from '../constants/config';

export default function RestaurantDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const { ownerRestaurant, refreshRestaurantData } = useApp();
  const { showAlert } = useAlert();

  const [minOrder, setMinOrder] = useState(String(ownerRestaurant?.min_order || 2000));
  const [deliveryTime, setDeliveryTime] = useState(ownerRestaurant?.delivery_time || '25-35 min');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!ownerRestaurant?.id) return;
    setSaving(true);
    const { error } = await updateRestaurant(ownerRestaurant.id, {
      min_order: parseInt(minOrder) || 2000,
      delivery_time: deliveryTime.trim(),
    } as any);
    if (error) {
      showAlert('Error', 'Failed to save. Please try again.');
    } else {
      await refreshRestaurantData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Saved', 'Delivery settings updated');
    }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Delivery fee explanation */}
          <View style={styles.feeCard}>
            <View style={styles.feeCardHeader}>
              <MaterialIcons name="delivery-dining" size={24} color={theme.primary} />
              <Text style={styles.feeCardTitle}>Delivery Fee Pricing</Text>
            </View>
            <Text style={styles.feeCardText}>
              Delivery fees are automatically calculated based on distance between your restaurant and the customer using Shipday.
            </Text>
            <View style={styles.formulaRow}>
              <View style={styles.formulaItem}>
                <Text style={styles.formulaLabel}>Base Fee</Text>
                <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.baseFee}</Text>
              </View>
              <Text style={styles.formulaOp}>+</Text>
              <View style={styles.formulaItem}>
                <Text style={styles.formulaLabel}>Per km</Text>
                <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.perKmRate}</Text>
              </View>
              <Text style={styles.formulaOp}>=</Text>
              <View style={styles.formulaItem}>
                <Text style={styles.formulaLabel}>Max</Text>
                <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.maxFee}</Text>
              </View>
            </View>
          </View>

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Settings</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Minimum Order Amount ({"\u20A6"})</Text>
              <TextInput
                style={styles.input}
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="2000"
                placeholderTextColor="#666"
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>Customers must meet this minimum before they can order from you.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Estimated Delivery Time</Text>
              <TextInput
                style={styles.input}
                value={deliveryTime}
                onChangeText={setDeliveryTime}
                placeholder="25-35 min"
                placeholderTextColor="#666"
              />
              <Text style={styles.hint}>This is shown to customers as an estimate. Actual time depends on distance and traffic.</Text>
            </View>
          </View>

          {/* Coverage info */}
          <View style={styles.coverageCard}>
            <MaterialIcons name="map" size={20} color="#999" />
            <View style={{ flex: 1 }}>
              <Text style={styles.coverageTitle}>Delivery Coverage</Text>
              <Text style={styles.coverageText}>Delivery availability is determined automatically by Shipday based on your restaurant location and available riders. No manual radius setup is needed.</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <Pressable onPress={handleSave} style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  feeCard: { marginHorizontal: 16, padding: 20, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24 },
  feeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  feeCardTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  feeCardText: { fontSize: 14, color: '#999', lineHeight: 20, marginBottom: 16 },
  formulaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  formulaItem: { alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  formulaLabel: { fontSize: 10, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  formulaValue: { fontSize: 18, fontWeight: '700', color: theme.primary },
  formulaOp: { fontSize: 18, fontWeight: '600', color: '#666' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  hint: { fontSize: 12, color: '#666', marginTop: 6, lineHeight: 17 },
  coverageCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  coverageTitle: { fontSize: 15, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  coverageText: { fontSize: 13, color: '#999', lineHeight: 19 },
  saveBtn: { backgroundColor: theme.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
