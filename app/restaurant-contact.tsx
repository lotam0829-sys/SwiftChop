import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { theme } from '../constants/theme';
import { config } from '../constants/config';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';

export default function RestaurantContactScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, ownerRestaurant } = useApp();
  const { showAlert } = useAlert();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim()) {
      showAlert('Missing Info', 'Please fill in both the subject and message fields.');
      return;
    }
    setSending(true);
    // Compose mailto link with pre-filled subject and body
    const emailBody = `Restaurant: ${ownerRestaurant?.name || 'N/A'}\nAccount: ${userProfile?.email || 'N/A'}\n\n${message.trim()}`;
    const mailUrl = `mailto:${config.supportEmail}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(emailBody)}`;
    try {
      await Linking.openURL(mailUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubject('');
      setMessage('');
    } catch {
      showAlert('Error', 'Could not open email client. Please email us at ' + config.supportEmail);
    }
    setSending(false);
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerCard}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="support-agent" size={32} color={theme.primary} />
            </View>
            <Text style={styles.headerTitle}>Contact Support</Text>
            <Text style={styles.headerSub}>Our team is available 24/7 to assist with any questions or issues</Text>
          </View>

          {/* Quick contact options */}
          <View style={styles.quickActions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`mailto:${config.supportEmail}`); }}
              style={styles.quickBtn}
            >
              <MaterialIcons name="email" size={22} color={theme.primary} />
              <Text style={styles.quickBtnLabel}>Email Us</Text>
              <Text style={styles.quickBtnSub}>{config.supportEmail}</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`tel:${config.supportPhone}`); }}
              style={styles.quickBtn}
            >
              <MaterialIcons name="phone" size={22} color={theme.primary} />
              <Text style={styles.quickBtnLabel}>Call Us</Text>
              <Text style={styles.quickBtnSub}>{config.supportPhone}</Text>
            </Pressable>
          </View>

          {/* Contact form */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Send a Message</Text>
            <Text style={styles.formSub}>Describe your issue and our team will respond within 24 hours</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Payment not received, Menu issue"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Message</Text>
              <TextInput
                style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your issue in detail..."
                placeholderTextColor="#666"
                multiline
              />
            </View>

            <Pressable onPress={handleSendMessage} style={[styles.sendBtn, sending && { opacity: 0.6 }]} disabled={sending}>
              <MaterialIcons name="send" size={20} color="#FFF" />
              <Text style={styles.sendBtnText}>{sending ? 'Opening Email...' : 'Send Message'}</Text>
            </Pressable>
          </View>

          {/* Response time */}
          <View style={styles.responseCard}>
            <MaterialIcons name="schedule" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.responseTitle}>Typical Response Time</Text>
              <Text style={styles.responseText}>We aim to respond to all queries within 2-4 hours during business hours, and within 24 hours on weekends.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  headerCard: { alignItems: 'center', marginHorizontal: 16, padding: 24, backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,107,0,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  headerSub: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  quickActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  quickBtn: { flex: 1, alignItems: 'center', padding: 16, backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', gap: 6 },
  quickBtnLabel: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  quickBtnSub: { fontSize: 11, color: '#999', textAlign: 'center' },
  formSection: { marginHorizontal: 16, padding: 20, backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20 },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  formSub: { fontSize: 13, color: '#999', marginBottom: 20, lineHeight: 18 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  input: { backgroundColor: '#0D0D0D', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 14, marginTop: 4 },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  responseCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, padding: 16, backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  responseTitle: { fontSize: 14, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  responseText: { fontSize: 13, color: '#999', lineHeight: 19 },
});
