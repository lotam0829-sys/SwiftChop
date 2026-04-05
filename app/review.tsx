import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { submitReview, fetchReviewByOrderId } from '../services/supabaseData';
import { useAuth } from '@/template';
import PrimaryButton from '../components/ui/PrimaryButton';

type SentimentType = 'disliked' | 'liked' | 'loved';

const sentiments: { key: SentimentType; icon: string; label: string; color: string; bg: string }[] = [
  { key: 'disliked', icon: 'thumb-down', label: 'Disliked', color: '#6B7280', bg: '#F3F4F6' },
  { key: 'liked', icon: 'thumb-up', label: 'Liked', color: '#6B7280', bg: '#F3F4F6' },
  { key: 'loved', icon: 'favorite', label: 'Loved', color: '#111827', bg: '#F3F4F6' },
];

const sentimentToRating: Record<SentimentType, number> = {
  disliked: 2,
  liked: 4,
  loved: 5,
};

const positiveTags = ['Great value', 'Consistent', 'Great packaging', 'Excellent quality', 'Flavourful', 'Fresh ingredients', 'Fast delivery', 'Good portions'];
const negativeTags = ['Slow delivery', 'Cold food', 'Wrong order', 'Bad packaging', 'Overpriced', 'Small portions'];

export default function ReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId, restaurantId, restaurantName } = useLocalSearchParams<{
    orderId: string;
    restaurantId: string;
    restaurantName: string;
  }>();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshRestaurants } = useApp();

  const [sentiment, setSentiment] = useState<SentimentType | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchReviewByOrderId(orderId).then(({ data }) => {
        if (data) {
          setAlreadyReviewed(true);
          setReviewText(data.review_text || '');
          // Map rating back to sentiment
          if (data.rating <= 2) setSentiment('disliked');
          else if (data.rating <= 4) setSentiment('liked');
          else setSentiment('loved');
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const toggleTag = (tag: string) => {
    if (alreadyReviewed) return;
    Haptics.selectionAsync();
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSelectSentiment = (s: SentimentType) => {
    if (alreadyReviewed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSentiment(s);
    setSelectedTags([]);
  };

  const currentTags = sentiment === 'disliked' ? negativeTags : positiveTags;
  const tagPrompt = sentiment === 'disliked'
    ? 'What went wrong?'
    : sentiment === 'liked'
      ? 'What did you like?'
      : 'What made it great?';

  const handleSubmit = async () => {
    if (!sentiment) {
      showAlert('Rating Required', 'Please select how you felt about this order');
      return;
    }
    if (!user?.id || !orderId || !restaurantId) {
      showAlert('Error', 'Missing order information');
      return;
    }

    const rating = sentimentToRating[sentiment];
    const tagText = selectedTags.length > 0 ? selectedTags.join(', ') + '. ' : '';
    const fullText = (tagText + reviewText.trim()).trim() || undefined;

    setSubmitting(true);
    const { data, error } = await submitReview({
      order_id: orderId,
      customer_id: user.id,
      restaurant_id: restaurantId,
      rating,
      review_text: fullText,
    });
    setSubmitting(false);

    if (error) {
      if (error.includes('duplicate') || error.includes('unique')) {
        showAlert('Already Reviewed', 'You have already submitted a review for this order');
      } else {
        showAlert('Error', error);
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await refreshRestaurants();
    showAlert('Thank You!', 'Your review has been submitted successfully', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Close button */}
        <View style={styles.closeRow}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color={theme.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text style={styles.title}>Review This Store</Text>
          <Text style={styles.subtitle}>How would you rate {restaurantName || 'this restaurant'}?</Text>

          {/* Sentiment icons */}
          <View style={styles.sentimentRow}>
            {sentiments.map((s) => {
              const isSelected = sentiment === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => handleSelectSentiment(s.key)}
                  style={styles.sentimentItem}
                >
                  <View style={[styles.sentimentIconWrap, isSelected && styles.sentimentIconActive]}>
                    <MaterialIcons
                      name={s.icon as any}
                      size={32}
                      color={isSelected ? '#111827' : '#9CA3AF'}
                    />
                  </View>
                  <Text style={[styles.sentimentLabel, isSelected && styles.sentimentLabelActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Selected sentiment display */}
          {sentiment ? (
            <View style={styles.sentimentResult}>
              <Text style={styles.sentimentResultText}>
                {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
              </Text>
            </View>
          ) : null}

          {/* Category Tags */}
          {sentiment ? (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsPrompt}>{tagPrompt}</Text>
              <View style={styles.tagsRow}>
                {currentTags.map((tag) => {
                  const isActive = selectedTags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleTag(tag)}
                      style={[styles.tag, isActive && styles.tagActive]}
                    >
                      <Text style={[styles.tagText, isActive && styles.tagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Divider */}
          {sentiment ? <View style={styles.divider} /> : null}

          {/* Review Text */}
          {sentiment ? (
            <View style={styles.textSection}>
              <Text style={styles.textLabel}>Leave a review</Text>
              <TextInput
                style={styles.textInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Write a review, it's helpful to include details about taste, quality, and portions."
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={500}
                editable={!alreadyReviewed}
              />
              <Text style={styles.charCount}>{reviewText.length}/500</Text>
            </View>
          ) : null}

          {alreadyReviewed ? (
            <View style={styles.alreadyDoneCard}>
              <MaterialIcons name="check-circle" size={24} color={theme.success} />
              <Text style={styles.alreadyDoneText}>You have already reviewed this order. Thank you for your feedback!</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Fixed bottom submit button */}
        {!alreadyReviewed ? (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              onPress={handleSubmit}
              style={[styles.submitBtn, !sentiment && { opacity: 0.5 }]}
              disabled={!sentiment || submitting}
            >
              <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: theme.textMuted },
  closeRow: { paddingHorizontal: 16, paddingVertical: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 15, color: theme.textSecondary, marginTop: 6, marginBottom: 28 },

  // Sentiments
  sentimentRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 20 },
  sentimentItem: { alignItems: 'center', gap: 8 },
  sentimentIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sentimentIconActive: { backgroundColor: '#FEF3C7' },
  sentimentLabel: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  sentimentLabelActive: { color: '#111827', fontWeight: '700' },

  sentimentResult: { alignItems: 'center', marginBottom: 20 },
  sentimentResultText: { fontSize: 20, fontWeight: '800', color: theme.textPrimary },

  // Tags
  tagsSection: { marginBottom: 8 },
  tagsPrompt: { fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#F3F4F6' },
  tagActive: { backgroundColor: theme.primaryFaint, borderColor: theme.textPrimary },
  tagText: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  tagTextActive: { fontWeight: '700', color: theme.textPrimary },

  divider: { height: 1, backgroundColor: theme.border, marginVertical: 24 },

  // Review text
  textSection: { marginBottom: 16 },
  textLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  textInput: { backgroundColor: '#F7F7F8', borderRadius: 14, padding: 16, fontSize: 15, color: theme.textPrimary, minHeight: 130, textAlignVertical: 'top', lineHeight: 22 },
  charCount: { fontSize: 12, color: theme.textMuted, textAlign: 'right', marginTop: 6 },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.borderLight },
  submitBtn: { backgroundColor: '#DC2626', borderRadius: 16, paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },

  alreadyDoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: theme.successLight, marginTop: 16 },
  alreadyDoneText: { flex: 1, fontSize: 14, color: '#065F46', lineHeight: 20 },
});
