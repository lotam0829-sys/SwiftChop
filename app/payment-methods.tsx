import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { fetchSavedCards, removeSavedCard, SavedCard } from '../services/supabaseData';

function getCardIcon(brand: string): string {
  const b = brand.toLowerCase();
  if (b.includes('visa')) return 'credit-card';
  if (b.includes('master')) return 'credit-card';
  if (b.includes('verve')) return 'credit-card';
  return 'credit-card';
}

function getCardGradient(brand: string): [string, string, string] {
  const b = brand.toLowerCase();
  if (b.includes('visa')) return ['#1A1A6C', '#2A2A8E', '#4747B5'];
  if (b.includes('master')) return ['#8B0000', '#CC0000', '#FF3333'];
  if (b.includes('verve')) return ['#006400', '#008000', '#00A600'];
  return ['#1A1A2E', '#16213E', '#0F3460'];
}

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const { userProfile, refreshProfile } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingCard, setRemovingCard] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await fetchSavedCards(user.id);
    setSavedCards(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleRemoveCard = (card: SavedCard) => {
    showAlert(
      'Remove Card',
      `Remove ${card.brand} ending in ${card.last4}? You can always add it back by making a new payment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setRemovingCard(card.signature);
            const { error } = await removeSavedCard(user.id, card.signature);
            if (error) {
              showAlert('Error', 'Failed to remove card. Please try again.');
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSavedCards(prev => prev.filter(c => c.signature !== card.signature));
              await refreshProfile();
            }
            setRemovingCard(null);
          },
        },
      ]
    );
  };

  const displayName = userProfile?.username || userProfile?.email?.split('@')[0] || 'YOUR NAME';
  const maskedName = displayName.toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16, paddingHorizontal: 16 }}
    >
      <Text style={styles.pageTitle}>Payment Methods</Text>

      {/* Saved Cards Section */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24, marginBottom: 24 }} />
      ) : savedCards.length > 0 ? (
        <View style={styles.savedCardsSection}>
          <View style={styles.savedCardsHeader}>
            <MaterialIcons name="credit-card" size={20} color={theme.primary} />
            <Text style={styles.savedCardsTitle}>Saved Cards</Text>
            <View style={styles.cardCountBadge}>
              <Text style={styles.cardCountText}>{savedCards.length}</Text>
            </View>
          </View>
          <Text style={styles.savedCardsSub}>Tap "Pay with saved card" at checkout for instant payment</Text>

          {savedCards.map((card, idx) => {
            const gradientColors = getCardGradient(card.brand);
            const isRemoving = removingCard === card.signature;
            return (
              <View key={card.signature || idx} style={styles.savedCardWrap}>
                <LinearGradient
                  colors={gradientColors}
                  style={styles.savedCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.savedCardTopRow}>
                    <View style={styles.savedCardChip}>
                      <MaterialIcons name="contactless" size={18} color="rgba(255,255,255,0.7)" />
                    </View>
                    <Text style={styles.savedCardBrand}>{card.brand || card.card_type}</Text>
                  </View>
                  <Text style={styles.savedCardNumber}>
                    {"\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  "}{card.last4}
                  </Text>
                  <View style={styles.savedCardBottomRow}>
                    <View>
                      <Text style={styles.savedCardSmallLabel}>CARDHOLDER</Text>
                      <Text style={styles.savedCardHolderName}>{maskedName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.savedCardSmallLabel}>EXPIRES</Text>
                      <Text style={styles.savedCardHolderName}>{card.exp_month}/{card.exp_year}</Text>
                    </View>
                  </View>
                  <View style={styles.savedCardBankRow}>
                    <Text style={styles.savedCardBankText}>{card.bank}</Text>
                  </View>
                </LinearGradient>
                <View style={styles.savedCardActions}>
                  <View style={styles.savedCardDefaultBadge}>
                    {idx === 0 ? (
                      <>
                        <MaterialIcons name="check-circle" size={14} color={theme.success} />
                        <Text style={styles.savedCardDefaultText}>Default</Text>
                      </>
                    ) : (
                      <Text style={[styles.savedCardDefaultText, { color: theme.textMuted }]}>Card {idx + 1}</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleRemoveCard(card)}
                    style={styles.removeCardBtn}
                    disabled={isRemoving}
                  >
                    {isRemoving ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                        <Text style={styles.removeCardText}>Remove</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.noCardsSection}>
          <LinearGradient
            colors={['#1A1A2E', '#16213E', '#0F3460']}
            style={styles.virtualCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.savedCardTopRow}>
              <View style={styles.savedCardChip}>
                <MaterialIcons name="contactless" size={22} color="rgba(255,255,255,0.7)" />
              </View>
              <Text style={styles.savedCardBrand}>Paystack</Text>
            </View>
            <Text style={styles.savedCardNumber}>{"\u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022  \u2022\u2022\u2022\u2022"}</Text>
            <View style={styles.savedCardBottomRow}>
              <View>
                <Text style={styles.savedCardSmallLabel}>CARDHOLDER</Text>
                <Text style={styles.savedCardHolderName}>{maskedName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.savedCardSmallLabel}>EXPIRES</Text>
                <Text style={styles.savedCardHolderName}>**/**</Text>
              </View>
            </View>
          </LinearGradient>
          <View style={styles.noCardsInfo}>
            <MaterialIcons name="add-card" size={24} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noCardsTitle}>No saved cards yet</Text>
              <Text style={styles.noCardsText}>Your card will be saved automatically after your first successful payment for faster checkout next time.</Text>
            </View>
          </View>
        </View>
      )}

      {/* Security info */}
      <View style={styles.securityCard}>
        <View style={[styles.securityIcon, { backgroundColor: '#E8F5E9' }]}>
          <MaterialIcons name="shield" size={24} color="#2E7D32" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.securityTitle}>Secure Payments</Text>
          <Text style={styles.securityText}>
            Your card details are tokenized and encrypted by Paystack. We never see or store your full card number.
          </Text>
        </View>
      </View>

      <View style={styles.howItWorksCard}>
        <Text style={styles.howTitle}>How saved cards work</Text>
        {[
          { icon: 'credit-card', text: 'Make your first payment via the Paystack checkout page' },
          { icon: 'save', text: 'Your card is automatically saved with a secure token' },
          { icon: 'touch-app', text: 'On future orders, select your saved card for one-tap payment' },
          { icon: 'lock', text: 'Card is charged instantly without re-entering details' },
        ].map((step, i) => (
          <View key={i} style={styles.howStep}>
            <View style={styles.howStepNum}>
              <Text style={styles.howStepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.howStepIcon}>
              <MaterialIcons name={step.icon as any} size={20} color={theme.primary} />
            </View>
            <Text style={styles.howStepText}>{step.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.acceptedCards}>
        <Text style={styles.acceptedTitle}>Accepted Cards</Text>
        <View style={styles.cardTypes}>
          {['Visa', 'Mastercard', 'Verve'].map(type => (
            <View key={type} style={styles.cardTypeBadge}>
              <MaterialIcons name="credit-card" size={16} color={theme.primary} />
              <Text style={styles.cardTypeText}>{type}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.securityNote}>
        <MaterialIcons name="lock" size={16} color={theme.success} />
        <Text style={styles.securityNoteText}>All payment information is encrypted end-to-end by Paystack, a PCI-DSS certified payment processor trusted by over 60,000 businesses in Nigeria.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 20 },
  // Saved Cards
  savedCardsSection: { marginBottom: 24 },
  savedCardsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  savedCardsTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  cardCountBadge: { backgroundColor: theme.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cardCountText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  savedCardsSub: { fontSize: 13, color: theme.textSecondary, marginBottom: 16, lineHeight: 18 },
  savedCardWrap: { marginBottom: 16 },
  savedCard: { borderRadius: 18, padding: 22, minHeight: 180, justifyContent: 'space-between' },
  savedCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  savedCardChip: { width: 36, height: 26, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  savedCardBrand: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 },
  savedCardNumber: { fontSize: 19, fontWeight: '600', color: '#FFF', letterSpacing: 2, marginBottom: 14 },
  savedCardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  savedCardSmallLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 3 },
  savedCardHolderName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  savedCardBankRow: { alignSelf: 'flex-start' },
  savedCardBankText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  savedCardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  savedCardDefaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedCardDefaultText: { fontSize: 13, fontWeight: '600', color: theme.success },
  removeCardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FEE2E2' },
  removeCardText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  // No cards
  noCardsSection: { marginBottom: 24 },
  virtualCard: { borderRadius: 18, padding: 24, minHeight: 180, justifyContent: 'space-between' },
  noCardsInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted },
  noCardsTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  noCardsText: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  // Security
  securityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18, borderRadius: 16, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 24 },
  securityIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  securityTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  securityText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  // How it works
  howItWorksCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: theme.border },
  howTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  howStepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  howStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  howStepIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  howStepText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  // Accepted cards
  acceptedCards: { marginBottom: 24 },
  acceptedTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  cardTypes: { flexDirection: 'row', gap: 10 },
  cardTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  cardTypeText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  securityNoteText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
});
