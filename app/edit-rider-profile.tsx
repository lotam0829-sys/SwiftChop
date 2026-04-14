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
  { key: 'motorcycle', label: 'Dispatch Bike', icon: 'two-wheeler' },
  { key: 'tricycle', label: 'Tricycle', icon: 'electric-rickshaw' },
  { key: 'car', label: 'Car', icon: 'directions-car' },
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

      if (newAvatarLocal) {
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveHeaderBtn, saving && { opacity: 0.5 }]}>
            {saving ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Text style={styles.saveHeaderBtnText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
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
                <MaterialIcons name="camera-alt" size={16} color="#FFF" />
              </View>
            </Pressable>
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
          </View>

          {/* Personal Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>

            <View style={styles.fieldCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="badge" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor="#6B7280"
                  />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name="phone" size={20} color="#6B7280" />
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+234 801 234 5678"
                    placeholderTextColor="#6B7280"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Vehicle Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="two-wheeler" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Vehicle Type</Text>
            </View>

            <View style={styles.vehicleGrid}>
              {vehicleTypes.map(v => (
                <Pressable
                  key={v.key}
                  onPress={() => { Haptics.selectionAsync(); setVehicleType(v.key); }}
                  style={[styles.vehicleOption, vehicleType === v.key && styles.vehicleOptionActive]}
                >
                  <View style={[styles.vehicleIconWrap, vehicleType === v.key && styles.vehicleIconWrapActive]}>
                    <MaterialIcons name={v.icon as any} size={24} color={vehicleType === v.key ? '#FFF' : '#9CA3AF'} />
                  </View>
                  <Text style={[styles.vehicleLabel, vehicleType === v.key && styles.vehicleLabelActive]}>{v.label}</Text>
                  {vehicleType === v.key ? (
                    <View style={styles.vehicleCheck}>
                      <MaterialIcons name="check-circle" size={16} color="#10B981" />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <MaterialIcons name="info-outline" size={18} color="#3B82F6" />
                <Text style={styles.infoCardTitle}>Important Note</Text>
              </View>
              <Text style={styles.infoText}>
                If you change your phone number, make sure to also update it in the Shipday Drive app so delivery assignment and payment matching continue to work correctly.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
          >
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
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  saveHeaderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  saveHeaderBtnText: { fontSize: 14, fontWeight: '700', color: '#10B981' },

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#10B981',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#10B981',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
  changePhotoText: { fontSize: 13, color: '#6B7280', marginTop: 8 },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Field Card
  fieldCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  input: { flex: 1, fontSize: 15, color: '#FFF' },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 16,
  },

  // Vehicle Grid
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vehicleOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  vehicleOptionActive: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: '#10B981',
  },
  vehicleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconWrapActive: {
    backgroundColor: '#059669',
  },
  vehicleLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', flex: 1 },
  vehicleLabelActive: { color: '#FFF' },
  vehicleCheck: { marginLeft: 'auto' },

  // Info Card
  infoCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: '#93C5FD' },
  infoText: { fontSize: 13, color: '#93C5FD', lineHeight: 19 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#059669',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
