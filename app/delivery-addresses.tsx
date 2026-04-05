import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';

export default function DeliveryAddressesScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { userProfile, updateProfile, userLocation, requestLocation } = useApp();
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const savedAddress = userProfile?.address;

  // Auto-detect address from GPS on mount
  useEffect(() => {
    if (userLocation) {
      reverseGeocode(userLocation.latitude, userLocation.longitude);
    }
  }, [userLocation]);

  const reverseGeocode = async (lat: number, lng: number) => {
    setLoadingGeo(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        setDetectedAddress(parts.join(', '));
      }
    } catch (err) {
      console.log('Geocode error:', err);
    } finally {
      setLoadingGeo(false);
    }
  };

  const handleUseDetected = async () => {
    if (!detectedAddress) return;
    await updateProfile({ address: detectedAddress });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Updated', 'Delivery address set to your current location');
  };

  const handleRefreshLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await requestLocation();
  };

  const handleSaveManual = async () => {
    if (!manualAddress.trim()) {
      showAlert('Error', 'Please enter an address');
      return;
    }
    await updateProfile({ address: manualAddress.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Updated', 'Delivery address updated');
    setManualAddress('');
    setShowManualEdit(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Delivery Addresses</Text>

        {/* Current saved address */}
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
        ) : null}

        {/* GPS-detected address */}
        {loadingGeo ? (
          <View style={styles.detectingCard}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.detectingText}>Detecting your location...</Text>
          </View>
        ) : detectedAddress ? (
          <View style={styles.detectedCard}>
            <View style={styles.detectedHeader}>
              <MaterialIcons name="my-location" size={18} color={theme.success} />
              <Text style={styles.detectedLabel}>Detected from GPS</Text>
            </View>
            <Text style={styles.detectedAddress}>{detectedAddress}</Text>
            {detectedAddress !== savedAddress ? (
              <Pressable onPress={handleUseDetected} style={styles.useDetectedBtn}>
                <MaterialIcons name="check" size={18} color="#FFF" />
                <Text style={styles.useDetectedText}>Use This Address</Text>
              </Pressable>
            ) : (
              <View style={styles.matchBadge}>
                <MaterialIcons name="check-circle" size={14} color={theme.success} />
                <Text style={styles.matchText}>Matches your saved address</Text>
              </View>
            )}
          </View>
        ) : !userLocation ? (
          <View style={styles.noLocationCard}>
            <MaterialIcons name="location-off" size={28} color={theme.textMuted} />
            <Text style={styles.noLocationTitle}>Location not available</Text>
            <Text style={styles.noLocationText}>Enable location permissions to auto-detect your delivery address.</Text>
            <Pressable onPress={handleRefreshLocation} style={styles.enableLocationBtn}>
              <MaterialIcons name="my-location" size={18} color={theme.primary} />
              <Text style={styles.enableLocationText}>Enable Location</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Refresh location button */}
        {userLocation ? (
          <Pressable onPress={handleRefreshLocation} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={18} color={theme.primary} />
            <Text style={styles.refreshText}>Refresh Location</Text>
          </Pressable>
        ) : null}

        {/* Manual edit option */}
        {showManualEdit ? (
          <View style={styles.manualForm}>
            <Text style={styles.manualLabel}>Enter address manually</Text>
            <TextInput
              style={styles.input}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="Full delivery address"
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Pressable onPress={() => setShowManualEdit(false)} style={[styles.formBtn, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.formBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveManual} style={[styles.formBtn, { backgroundColor: theme.primary, flex: 2 }]}>
                <Text style={[styles.formBtnText, { color: '#FFF' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => { setShowManualEdit(true); setManualAddress(savedAddress || ''); Haptics.selectionAsync(); }} style={styles.editManualBtn}>
            <MaterialIcons name="edit" size={18} color={theme.textSecondary} />
            <Text style={styles.editManualText}>Edit address manually</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  addressCardDefault: { borderColor: theme.primary, backgroundColor: theme.primaryFaint },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  addressText: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  defaultBadge: { backgroundColor: theme.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  detectingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 16 },
  detectingText: { fontSize: 14, color: theme.textSecondary },
  detectedCard: { padding: 16, borderRadius: 14, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 16 },
  detectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  detectedLabel: { fontSize: 13, fontWeight: '600', color: theme.success },
  detectedAddress: { fontSize: 14, color: theme.textPrimary, lineHeight: 20, marginBottom: 12 },
  useDetectedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.success, paddingVertical: 12, borderRadius: 12 },
  useDetectedText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  matchBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  matchText: { fontSize: 13, color: theme.success, fontWeight: '500' },
  noLocationCard: { alignItems: 'center', padding: 24, borderRadius: 14, backgroundColor: theme.backgroundSecondary, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  noLocationTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginTop: 10, marginBottom: 4 },
  noLocationText: { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  enableLocationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primaryFaint },
  enableLocationText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginBottom: 16 },
  refreshText: { fontSize: 14, fontWeight: '500', color: theme.primary },
  editManualBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginTop: 4 },
  editManualText: { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
  manualForm: { padding: 16, backgroundColor: theme.backgroundSecondary, borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: theme.border },
  manualLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border, minHeight: 48 },
  formBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  formBtnText: { fontSize: 14, fontWeight: '600' },
});
