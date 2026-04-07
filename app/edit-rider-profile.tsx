import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { updateUserProfile } from '../services/supabaseData';

const vehicleTypes = [
  { key: 'bike', label: 'Bicycle', icon: 'pedal-bike' },
  { key: 'motorcycle', label: 'Motorcycle', icon: 'two-wheeler' },
  { key: 'car', label: 'Car', icon: 'directions-car' },
  { key: 'tricycle', label: 'Tricycle', icon: 'electric-rickshaw' },
];

export default function EditRiderProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, refreshProfile } = useApp();
  const { showAlert } = useAlert();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userProfile?.id) return;
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('user_profiles')
          .select('username, phone, vehicle_type, avatar_url')
          .eq('id', userProfile.id)
          .single();
        if (data) {
          setFullName(data.username || '');
          setPhone(data.phone || '');
          setVehicleType(data.vehicle_type || '');
          setAvatarUri(data.avatar_url || null);
        }
      } catch (err) {
        console.log('Load profile error:', err);
      } finally {
        setLoadingProfile(false);
      }
    };
    load();
  }, [userProfile?.id]);

  const handlePickPhoto = async () => {
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
    if (!userProfile?.id) return;
    if (!fullName.trim()) { showAlert('Required', 'Please enter your full name'); return; }
    if (!phone.trim()) { showAlert('Required', 'Please enter your phone number'); return; }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      let finalAvatarUrl = avatarUri;

      // Upload new avatar if selected
      if (newAvatarLocal) {
        const resp = await fetch(newAvatarLocal);
        const blob = await resp.blob();
        const arr = await new Response(blob).arrayBuffer();
        const { error: uploadErr } = await supabase.storage
          .from('avatar-photos')
          .upload(`${userProfile.id}/avatar.jpg`, arr, { contentType: 'image/jpeg', upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatar-photos').getPublicUrl(`${userProfile.id}/avatar.jpg`);
          finalAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`; // Cache bust
        }
      }

      await updateUserProfile(userProfile.id, {
        username: fullName.trim(),
        phone: phone.trim(),
        vehicle_type: vehicleType,
        avatar_url: finalAvatarUrl,
      } as any);

      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Saved', 'Your profile has been updated successfully.');
      router.back();
    } catch (err) {
      console.error('Save profile error:', err);
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  const displayAvatar = newAvatarLocal || avatarUri;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={handlePickPhoto} style={styles.avatarWrap}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="person" size={40} color="#10B981" />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <MaterialIcons name="camera-alt" size={18} color="#FFF" />
              </View>
            </Pressable>
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
          </View>

          {/* Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={20} color="#6B7280" style={{ marginRight: 10 }} />
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor="#6B7280" />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="phone" size={20} color="#6B7280" style={{ marginRight: 10 }} />
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234 801 234 5678" placeholderTextColor="#6B7280" keyboardType="phone-pad" />
              </View>
              <Text style={styles.inputHint}>Use the same phone number you registered on Shipday Drive</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vehicle Type</Text>
              <View style={styles.vehicleRow}>
                {vehicleTypes.map(v => (
                  <Pressable
                    key={v.key}
                    onPress={() => { Haptics.selectionAsync(); setVehicleType(v.key); }}
                    style={[styles.vehicleOption, vehicleType === v.key && styles.vehicleOptionActive]}
                  >
                    <MaterialIcons name={v.icon as any} size={22} color={vehicleType === v.key ? '#FFF' : '#9CA3AF'} />
                    <Text style={[styles.vehicleLabel, vehicleType === v.key && { color: '#FFF' }]}>{v.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

          </View>

          {/* Important Note — below form, above save */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardIcon}>
              <MaterialIcons name="info-outline" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoCardTitle}>Important Note</Text>
              <Text style={styles.infoText}>
                If you change your phone number, make sure to also update it in the Shipday Drive app so payment matching continues to work.
              </Text>
            </View>
          </View>

          {/* Save button */}
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#10B981' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10B981' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D0D0D' },
  changePhotoText: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  form: { paddingHorizontal: 20, gap: 16 },
  inputGroup: {},
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#E5E7EB', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: '#1A1A1A' },
  input: { flex: 1, fontSize: 15, color: '#FFF' },
  inputHint: { fontSize: 12, color: '#6B7280', marginTop: 6, paddingLeft: 4 },
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vehicleOption: { flex: 1, minWidth: '45%', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1A1A1A', borderWidth: 1.5, borderColor: '#2A2A2A' },
  vehicleOptionActive: { backgroundColor: '#059669', borderColor: '#059669' },
  vehicleLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', marginHorizontal: 20, marginTop: 8 },
  infoCardIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: '#93C5FD', marginBottom: 4 },
  infoText: { fontSize: 12, color: '#93C5FD', lineHeight: 18 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 14, backgroundColor: '#059669' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
