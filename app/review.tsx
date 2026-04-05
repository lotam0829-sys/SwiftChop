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

const ratingLabels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
const ratingEmojis = ['', '😞', '😕', '😐', '😊', '🤩'];

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

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchReviewByOrderId(orderId).then(({ data }) => {
        if (data) {
          setAlreadyReviewed(true);
          setRating(data.rating);
          setReviewText(data.review_text || '');
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      showAlert('Rating Required', 'Please select a star rating');
      return;
    }
    if (!user?.id || !orderId || !restaurantId) {
      showAlert('Error', 'Missing order information');
      return;
    }

    setSubmitting(true);
    const { data, error } = await submitReview({
      order_id: orderId,
      customer_id: user.id,
      restaurant_id: restaurantId,
      rating,
      review_text: reviewText.trim() || undefined,
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="close" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Rate Your Order</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Restaurant name */}
          <View style={styles.restaurantInfo}>
            <View style={styles.restaurantIcon}>
              <MaterialIcons name="storefront" size={28} color={theme.primary} />
            </View>
            <Text style={styles.restaurantNameText}>{restaurantName || 'Restaurant'}</Text>
            {alreadyReviewed ? (
              <View style={styles.reviewedBadge}>
                <MaterialIcons name="check-circle" size={14} color={theme.success} />
                <Text style={styles.reviewedText}>Already reviewed</Text>
              </View>
            ) : null}
          </View>

          {/* Star Rating */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingPrompt}>How was your experience?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => {
                    if (!alreadyReviewed) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setRating(star);
                    }
                  }}
                  style={styles.starBtn}
                >
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={44}
                    color={star <= rating ? '#FCD34D' : theme.border}
                  />
                </Pressable>
              ))}
            </View>
            {rating > 0 ? (
              <View style={styles.ratingLabel}>
                <Text style={styles.ratingEmoji}>{ratingEmojis[rating]}</Text>
                <Text style={styles.ratingLabelText}>{ratingLabels[rating]}</Text>
              </View>
            ) : null}
          </View>

          {/* Review Text */}
          <View style={styles.textSection}>
            <Text style={styles.textLabel}>Write a review (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Share your experience with other customers..."
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={500}
              editable={!alreadyReviewed}
            />
            <Text style={styles.charCount}>{reviewText.length}/500</Text>
          </View>

          {/* Quick Tags */}
          {!alreadyReviewed ? (
            <View style={styles.quickTags}>
              <Text style={styles.quickTagsLabel}>Quick feedback</Text>
              <View style={styles.tagsRow}>
                {['Delicious food', 'Fast delivery', 'Great packaging', 'Good portions', 'Fresh ingredients', 'Worth the price'].map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      Haptics.selectionAsync();
                      if (reviewText.includes(tag)) {
                        setReviewText(reviewText.replace(tag, '').replace(/\s{2,}/g, ' ').trim());
                      } else {
                        setReviewText(prev => prev ? `${prev}. ${tag}` : tag);
                      }
                    }}
                    style={[styles.tag, reviewText.includes(tag) && styles.tagActive]}
                  >
                    <Text style={[styles.tagText, reviewText.includes(tag) && styles.tagTextActive]}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ height: 24 }} />
          {!alreadyReviewed ? (
            <PrimaryButton
              label={submitting ? 'Submitting...' : 'Submit Review'}
              onPress={handleSubmit}
              loading={submitting}
              variant="dark"
            />
          ) : (
            <View style={styles.alreadyDoneCard}>
              <MaterialIcons name="check-circle" size={24} color={theme.success} />
              <Text style={styles.alreadyDoneText}>You have already reviewed this order. Thank you for your feedback!</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: theme.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  restaurantInfo: { alignItems: 'center', paddingVertical: 24 },
  restaurantIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  restaurantNameText: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  reviewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.successLight },
  reviewedText: { fontSize: 13, fontWeight: '600', color: theme.success },
  ratingSection: { alignItems: 'center', paddingVertical: 20 },
  ratingPrompt: { fontSize: 16, fontWeight: '600', color: theme.textSecondary, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  ratingEmoji: { fontSize: 24 },
  ratingLabelText: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  textSection: { marginTop: 8 },
  textLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 10 },
  textInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 16, fontSize: 15, color: theme.textPrimary, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.border, lineHeight: 22 },
  charCount: { fontSize: 12, color: theme.textMuted, textAlign: 'right', marginTop: 6 },
  quickTags: { marginTop: 20 },
  quickTagsLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  tagActive: { backgroundColor: theme.primaryFaint, borderColor: theme.primary },
  tagText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
  tagTextActive: { color: theme.primary, fontWeight: '600' },
  alreadyDoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, backgroundColor: theme.successLight },
  alreadyDoneText: { flex: 1, fontSize: 14, color: '#065F46', lineHeight: 20 },
});
