import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, updateProfile } = useApp();
  const { showAlert } = useAlert();

  const [username, setUsername] = useState(userProfile?.username || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) { showAlert('Error', 'Please enter your name'); return; }
    setSaving(true);
    await updateProfile({ username: username.trim(), phone: phone.trim(), address: address.trim() });
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Saved', 'Profile updated successfully');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{username?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Display Name</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="person" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
            <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Your name" placeholderTextColor={theme.textMuted} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrap, styles.disabledWrap]}>
            <MaterialIcons name="email" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
            <Text style={styles.disabledText}>{userProfile?.email || 'Not set'}</Text>
            <MaterialIcons name="lock" size={16} color={theme.textMuted} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="phone" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Default Address</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="location-on" size={20} color={theme.textMuted} style={{ marginRight: 10 }} />
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Your delivery address" placeholderTextColor={theme.textMuted} />
          </View>
        </View>

        <View style={{ height: 24 }} />
        <PrimaryButton label="Save Changes" onPress={handleSave} loading={saving} variant="dark" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  avatarHint: { fontSize: 13, color: theme.primary, fontWeight: '600' },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, height: 52, backgroundColor: theme.backgroundSecondary },
  input: { flex: 1, fontSize: 15, color: theme.textPrimary },
  disabledWrap: { backgroundColor: '#F3F4F6' },
  disabledText: { flex: 1, fontSize: 15, color: theme.textMuted },
});
