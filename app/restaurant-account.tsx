import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { updateRestaurant } from '../services/supabaseData';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function RestaurantAccountScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, ownerRestaurant, updateProfile, refreshRestaurantData } = useApp();
  const { showAlert } = useAlert();

  // Personal info
  const [username, setUsername] = useState(userProfile?.username || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');

  // Restaurant storefront
  const [restaurantName, setRestaurantName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Location state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  useEffect(() => {
    if (ownerRestaurant) {
      setRestaurantName(ownerRestaurant.name || '');
      setCuisine(ownerRestaurant.cuisine || '');
      setDescription(ownerRestaurant.description || '');
      setAddress(ownerRestaurant.address || '');
      setRestaurantPhone((ownerRestaurant as any).phone || '');
      setLatitude((ownerRestaurant as any).latitude || null);
      setLongitude((ownerRestaurant as any).longitude || null);
    }
    if (userProfile) {
      setAvatarUri(userProfile.avatar_url || null);
    }
  }, [ownerRestaurant, userProfile]);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Location permission is needed to detect your restaurant position. Please enable it in Settings.');
        setDetectingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);

      // Reverse geocode to get a readable address
      const results = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        const detected = parts.join(', ');
        setLocationAddress(detected);
        if (!address.trim()) setAddress(detected);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Location Detected', `Coordinates set: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
    } catch (err) {
      console.error('Location detection error:', err);
      showAlert('Error', 'Could not detect your location. Please try again or enter coordinates manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim()) {
      showAlert('Address Required', 'Enter your restaurant address first, then tap this button to find its coordinates.');
      return;
    }
    setDetectingLocation(true);
    try {
      const results = await Location.geocodeAsync(address.trim());
      if (results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Coordinates Found', `Location set to ${results[0].latitude.toFixed(5)}, ${results[0].longitude.toFixed(5)}`);
      } else {
        showAlert('Not Found', 'Could not find coordinates for this address. Try using the auto-detect button instead.');
      }
    } catch (err) {
      showAlert('Error', 'Geocoding failed. Try using auto-detect instead.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets.length > 0) {
        setNewAvatarLocal(result.assets[0].uri);
      }
    } catch (err) {
      showAlert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!restaurantName.trim()) {
      showAlert('Required', 'Restaurant name is required');
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();

      // Upload avatar if changed
      let finalAvatarUrl = avatarUri;
      if (newAvatarLocal && userProfile?.id) {
        const resp = await fetch(newAvatarLocal);
        const blob = await resp.blob();
        const arr = await new Response(blob).arrayBuffer();
        const { error: uploadErr } = await supabase.storage
          .from('avatar-photos')
          .upload(`${userProfile.id}/avatar.jpg`, arr, { contentType: 'image/jpeg', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatar-photos').getPublicUrl(`${userProfile.id}/avatar.jpg`);
          finalAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      }

      // Update personal profile
      await updateProfile({
        username: username.trim(),
        phone: phone.trim(),
        avatar_url: finalAvatarUrl,
      } as any);

      // Update restaurant record
      if (ownerRestaurant?.id) {
        const restUpdates: any = {
          name: restaurantName.trim(),
          cuisine: cuisine.trim(),
          description: description.trim(),
          address: address.trim(),
          phone: restaurantPhone.trim(),
        };
        if (latitude !== null) restUpdates.latitude = latitude;
        if (longitude !== null) restUpdates.longitude = longitude;
        await updateRestaurant(ownerRestaurant.id, restUpdates);
        await refreshRestaurantData();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Saved', 'Restaurant profile updated successfully');
    } catch (err) {
      console.error('Save error:', err);
      showAlert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = newAvatarLocal || avatarUri;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>Restaurant Profile</Text>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handlePickAvatar} style={styles.avatarWrap}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="storefront" size={32} color={theme.primary} />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <MaterialIcons name="camera-alt" size={16} color="#FFF" />
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>Tap to change profile photo</Text>
          </View>

          {/* Storefront Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="storefront" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Storefront Details</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Restaurant Name *</Text>
              <TextInput style={styles.input} value={restaurantName} onChangeText={setRestaurantName} placeholder="Your restaurant name" placeholderTextColor="#666" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Cuisine Type</Text>
              <TextInput style={styles.input} value={cuisine} onChangeText={setCuisine} placeholder="e.g. Nigerian, Continental" placeholderTextColor="#666" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top', paddingTop: 14 }]} value={description} onChangeText={setDescription} placeholder="Tell customers about your food and restaurant..." placeholderTextColor="#666" multiline />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Restaurant address" placeholderTextColor="#666" />
            </View>

            {/* Location Picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Restaurant Location (GPS)</Text>
              <Text style={styles.locationHint}>
                Accurate coordinates enable distance-based delivery fees for customers.
              </Text>

              {latitude !== null && longitude !== null ? (
                <View style={styles.coordsDisplay}>
                  <MaterialIcons name="location-on" size={20} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordsText}>
                      {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </Text>
                    {locationAddress ? (
                      <Text style={styles.coordsAddress} numberOfLines={1}>{locationAddress}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="check-circle" size={18} color="#10B981" />
                </View>
              ) : (
                <View style={styles.coordsMissing}>
                  <MaterialIcons name="location-off" size={18} color="#F59E0B" />
                  <Text style={styles.coordsMissingText}>No location set — delivery fees will use a default estimate.</Text>
                </View>
              )}

              <View style={styles.locationActions}>
                <Pressable
                  onPress={handleDetectLocation}
                  disabled={detectingLocation}
                  style={({ pressed }) => [styles.locationBtn, styles.locationBtnPrimary, pressed && { opacity: 0.85 }, detectingLocation && { opacity: 0.6 }]}
                >
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialIcons name="my-location" size={18} color="#FFF" />
                  )}
                  <Text style={styles.locationBtnPrimaryText}>
                    {detectingLocation ? 'Detecting...' : 'Auto-Detect'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleGeocodeAddress}
                  disabled={detectingLocation || !address.trim()}
                  style={({ pressed }) => [styles.locationBtn, styles.locationBtnSecondary, pressed && { opacity: 0.85 }, (!address.trim() || detectingLocation) && { opacity: 0.4 }]}
                >
                  <MaterialIcons name="search" size={18} color={theme.primary} />
                  <Text style={styles.locationBtnSecondaryText}>From Address</Text>
                </Pressable>
              </View>

              {/* Manual coordinate entry */}
              <View style={styles.manualCoords}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <TextInput
                    style={styles.coordInput}
                    value={latitude !== null ? latitude.toString() : ''}
                    onChangeText={t => { const n = parseFloat(t); setLatitude(isNaN(n) ? null : n); }}
                    placeholder="e.g. 6.5244"
                    placeholderTextColor="#555"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordLabel}>Longitude</Text>
                  <TextInput
                    style={styles.coordInput}
                    value={longitude !== null ? longitude.toString() : ''}
                    onChangeText={t => { const n = parseFloat(t); setLongitude(isNaN(n) ? null : n); }}
                    placeholder="e.g. 3.3792"
                    placeholderTextColor="#555"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput style={styles.input} value={restaurantPhone} onChangeText={setRestaurantPhone} placeholder="+234 800 000 0000" placeholderTextColor="#666" keyboardType="phone-pad" />
            </View>
          </View>

          {/* Personal Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>Owner Details</Text>
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
              <Text style={styles.label}>Owner Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" placeholderTextColor="#666" keyboardType="phone-pad" />
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <PrimaryButton label={saving ? 'Saving...' : 'Save All Changes'} onPress={handleSave} loading={saving} variant="primary" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', paddingHorizontal: 16, marginBottom: 12 },
  avatarSection: { alignItems: 'center', paddingVertical: 16 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: theme.primary },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.primary },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D0D0D' },
  avatarHint: { fontSize: 12, color: '#666', marginTop: 8 },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  field: { marginTop: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  disabledInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  disabledText: { fontSize: 15, color: '#666' },
  // Location styles
  locationHint: { fontSize: 12, color: '#888', lineHeight: 17, marginBottom: 12 },
  coordsDisplay: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 12 },
  coordsText: { fontSize: 14, fontWeight: '600', color: '#10B981' },
  coordsAddress: { fontSize: 12, color: '#999', marginTop: 2 },
  coordsMissing: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: 12 },
  coordsMissingText: { flex: 1, fontSize: 12, color: '#D97706', lineHeight: 17 },
  locationActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  locationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  locationBtnPrimary: { backgroundColor: '#10B981' },
  locationBtnPrimaryText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  locationBtnSecondary: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: theme.primary },
  locationBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  manualCoords: { flexDirection: 'row', gap: 10 },
  coordLabel: { fontSize: 11, fontWeight: '600', color: '#888', marginBottom: 6 },
  coordInput: { backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
});
