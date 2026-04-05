import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { config } from '../constants/config';

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16, alignItems: 'center' }}
    >
      <Text style={styles.pageTitle}>About SwiftChop</Text>

      <View style={styles.logoWrap}>
        <MaterialIcons name="bolt" size={36} color="#FFF" />
      </View>
      <Text style={styles.appName}>Swift<Text style={{ color: theme.primary }}>Chop</Text></Text>
      <Text style={styles.tagline}>{config.tagline}</Text>
      <Text style={styles.version}>Version 1.0.0 (Build 1)</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Our Mission</Text>
        <Text style={styles.cardText}>
          SwiftChop is building the fastest, most reliable food delivery network across Nigeria. We connect hungry customers with amazing local restaurants through AI-powered recommendations and lightning-fast delivery.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connect With Us</Text>
        {[
          { icon: 'email', label: config.supportEmail, onPress: () => Linking.openURL(`mailto:${config.supportEmail}`) },
          { icon: 'phone', label: config.supportPhone, onPress: () => Linking.openURL(`tel:${config.supportPhone}`) },
          { icon: 'language', label: 'www.swiftchop.ng', onPress: () => {} },
        ].map((item, idx) => (
          <Pressable key={idx} onPress={item.onPress} style={styles.contactRow}>
            <MaterialIcons name={item.icon as any} size={20} color={theme.primary} />
            <Text style={styles.contactLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.copyright}>{"\u00A9"} 2026 SwiftChop. All rights reserved.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20, alignSelf: 'flex-start' },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.backgroundDark, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName: { fontSize: 32, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 },
  tagline: { fontSize: 15, color: theme.textSecondary, marginBottom: 4 },
  version: { fontSize: 13, color: theme.textMuted, marginBottom: 28 },
  card: { width: '100%', backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.border },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 },
  cardText: { fontSize: 14, color: theme.textSecondary, lineHeight: 22 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  contactLabel: { fontSize: 15, color: theme.textPrimary, fontWeight: '500' },
  copyright: { fontSize: 12, color: theme.textMuted, marginTop: 16 },
});
