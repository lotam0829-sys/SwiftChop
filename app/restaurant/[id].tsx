import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { DbMenuItem, DbRestaurant, DbReview, fetchRestaurantById, fetchMenuItems, fetchRestaurantReviews } from '../../services/supabaseData';

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart, cart, cartCount, cartTotal, userLocation } = useApp();

  const [restaurant, setRestaurant] = useState<DbRestaurant | null>(null);
  const [menuItems, setMenuItems] = useState<DbMenuItem[]>([]);
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);

  const categories = useMemo(() => {
    const cats: { id: string; name: string; items: DbMenuItem[] }[] = [];
    const catMap = new Map<string, DbMenuItem[]>();
    menuItems.forEach(item => {
      const cat = item.category || 'other';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)?.push(item);
    });
    const popularItems = menuItems.filter(i => i.is_popular);
    if (popularItems.length > 0) cats.push({ id: 'popular', name: 'Popular', items: popularItems });
    catMap.forEach((items, key) => {
      cats.push({ id: key, name: key.charAt(0).toUpperCase() + key.slice(1), items });
    });
    return cats;
  }, [menuItems]);

  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchRestaurantById(id),
      fetchMenuItems(id),
      fetchRestaurantReviews(id),
    ]).then(([restResult, menuResult, reviewsResult]) => {
      setRestaurant(restResult.data);
      setMenuItems(menuResult.data);
      setReviews(reviewsResult.data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories]);

  const activeItems = useMemo(() => {
    const cat = categories.find(c => c.id === activeCategory);
    return cat?.items || [];
  }, [categories, activeCategory]);

  const distanceKm = useMemo(() => {
    if (!userLocation || !restaurant) return null;
    const rLat = (restaurant as any).latitude;
    const rLng = (restaurant as any).longitude;
    if (!rLat || !rLng) return null;
    const R = 6371;
    const dLat = (rLat - userLocation.latitude) * Math.PI / 180;
    const dLon = (rLng - userLocation.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(rLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, [userLocation, restaurant]);

  const estimatedDeliveryTime = useMemo(() => {
    if (distanceKm !== null) {
      const minTime = Math.round(10 + distanceKm * 3);
      const maxTime = Math.round(minTime + 10);
      return `${minTime}-${maxTime} min`;
    }
    return null; // Don't show delivery time if distance cannot be calculated
  }, [distanceKm]);

  const distanceLabel = distanceKm !== null ? (distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`) : null;

  const getItemImage = (imageKey: string) => {
    if (imageKey && imageKey.startsWith('http')) {
      return { uri: imageKey };
    }
    return getImage(imageKey);
  };

  // Rating distribution
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist;
  }, [reviews]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return restaurant?.rating || 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews, restaurant]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  if (!restaurant) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Restaurant not found</Text></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: cartCount > 0 ? 100 : insets.bottom + 16 }}>
        <View style={styles.hero}>
          <Image source={getImage(restaurant.image_key)} style={styles.heroImage} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => router.push('/cart')} style={styles.backBtn}>
              <MaterialIcons name="shopping-bag" size={22} color="#FFF" />
              {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View> : null}
            </Pressable>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            <Text style={styles.heroCuisine}>{restaurant.cuisine}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Pressable onPress={() => { Haptics.selectionAsync(); setShowReviews(!showReviews); }} style={styles.infoItem}>
            <MaterialIcons name="star" size={18} color="#FCD34D" />
            <Text style={styles.infoValue}>{avgRating.toFixed(1)}</Text>
            <Text style={styles.infoLabel}>({reviews.length || restaurant.review_count})</Text>
          </Pressable>
          {estimatedDeliveryTime ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <MaterialIcons name="access-time" size={18} color={theme.textMuted} />
                <Text style={styles.infoValue}>{estimatedDeliveryTime}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <MaterialIcons name="delivery-dining" size={18} color={theme.textMuted} />
            <Text style={styles.infoValue}>{"\u20A6"}{restaurant.delivery_fee.toLocaleString()}</Text>
          </View>
          {distanceLabel ? (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <MaterialIcons name="near-me" size={16} color={theme.primary} />
                <Text style={[styles.infoValue, { color: theme.primary }]}>{distanceLabel}</Text>
              </View>
            </>
          ) : null}
        </View>

        {restaurant.address ? (
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color={theme.textMuted} />
            <Text style={styles.locationText}>{restaurant.address}</Text>
          </View>
        ) : null}

        <Text style={styles.description}>{restaurant.description}</Text>

        {/* Reviews Section (collapsible) */}
        {showReviews ? (
          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.reviewsSectionTitle}>Reviews ({reviews.length})</Text>
              <Pressable onPress={() => setShowReviews(false)}>
                <MaterialIcons name="keyboard-arrow-up" size={24} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Rating summary */}
            <View style={styles.ratingSummary}>
              <View style={styles.ratingSummaryLeft}>
                <Text style={styles.ratingBig}>{avgRating.toFixed(1)}</Text>
                <View style={styles.ratingStarsRow}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <MaterialIcons key={s} name={s <= Math.round(avgRating) ? 'star' : 'star-border'} size={16} color="#FCD34D" />
                  ))}
                </View>
                <Text style={styles.ratingCountText}>{reviews.length} reviews</Text>
              </View>
              <View style={styles.ratingSummaryRight}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = ratingDistribution[star - 1];
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <View key={star} style={styles.ratingBarRow}>
                      <Text style={styles.ratingBarLabel}>{star}</Text>
                      <MaterialIcons name="star" size={12} color="#FCD34D" />
                      <View style={styles.ratingBarBg}>
                        <View style={[styles.ratingBarFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.ratingBarCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Individual reviews */}
            {reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {reviews.slice(0, 10).map((review) => {
                  const date = new Date(review.created_at);
                  const dateStr = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <View key={review.id} style={styles.reviewCard}>
                      <View style={styles.reviewCardHeader}>
                        <View style={styles.reviewAvatar}>
                          <Text style={styles.reviewAvatarText}>
                            {(review.customer_name || 'C').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewerName}>{review.customer_name || 'Customer'}</Text>
                          <Text style={styles.reviewDate}>{dateStr}</Text>
                        </View>
                        <View style={styles.reviewRatingBadge}>
                          <MaterialIcons name="star" size={14} color="#FCD34D" />
                          <Text style={styles.reviewRatingText}>{review.rating}</Text>
                        </View>
                      </View>
                      {review.review_text ? (
                        <Text style={styles.reviewText}>{review.review_text}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noReviews}>
                <MaterialIcons name="rate-review" size={32} color={theme.textMuted} />
                <Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>
              </View>
            )}
          </View>
        ) : (
          <Pressable onPress={() => { Haptics.selectionAsync(); setShowReviews(true); }} style={styles.showReviewsBtn}>
            <MaterialIcons name="star" size={18} color={theme.primary} />
            <Text style={styles.showReviewsBtnText}>
              {reviews.length > 0 ? `See ${reviews.length} reviews` : 'No reviews yet'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={20} color={theme.primary} />
          </Pressable>
        )}

        {categories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {categories.map((cat) => (
              <Pressable key={cat.id} onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat.id); }} style={[styles.tab, activeCategory === cat.id && styles.tabActive]}>
                <Text style={[styles.tabText, activeCategory === cat.id && styles.tabTextActive]}>{cat.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.menuList}>
          {activeItems.map((item) => {
            const inCart = cart.find(ci => ci.menuItem.id === item.id);
            return (
              <View key={item.id} style={[styles.menuItem, !item.is_available && { opacity: 0.5 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  {item.is_popular ? (
                    <View style={styles.popularBadge}>
                      <MaterialIcons name="local-fire-department" size={12} color={theme.primary} />
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  ) : null}
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                  <Text style={styles.menuItemPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
                </View>
                <View>
                  <Image source={getItemImage(item.image_key)} style={styles.menuItemImage} contentFit="cover" />
                  {item.is_available ? (
                    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); addToCart(item, restaurant.id, restaurant.name); }} style={[styles.addBtnStyle, inCart ? styles.addBtnActive : null]}>
                      {inCart ? <Text style={styles.addBtnTextActive}>{inCart.quantity}</Text> : <MaterialIcons name="add" size={22} color="#FFF" />}
                    </Pressable>
                  ) : (
                    <View style={styles.unavailableBadge}><Text style={styles.unavailableText}>Unavailable</Text></View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {cartCount > 0 ? (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/cart'); }} style={styles.cartBarInner}>
            <View style={styles.cartBarLeft}>
              <View style={styles.cartCountBadge}><Text style={styles.cartCountText}>{cartCount}</Text></View>
              <Text style={styles.cartBarLabel}>View Cart</Text>
            </View>
            <Text style={styles.cartBarTotal}>{"\u20A6"}{cartTotal.toLocaleString()}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  hero: { height: 260, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: theme.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  heroBottom: { position: 'absolute', bottom: 20, left: 16 },
  heroName: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  heroCuisine: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 12, gap: 12, flexWrap: 'wrap' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoValue: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  infoLabel: { fontSize: 12, color: theme.textMuted },
  infoDivider: { width: 1, height: 20, backgroundColor: theme.border },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  locationText: { fontSize: 13, color: theme.textSecondary },
  description: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, paddingHorizontal: 16, marginBottom: 12 },

  // Reviews section
  showReviewsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primaryFaint, marginBottom: 16 },
  showReviewsBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  reviewsSection: { paddingHorizontal: 16, marginBottom: 16 },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reviewsSectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  ratingSummary: { flexDirection: 'row', gap: 20, marginBottom: 16, padding: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary },
  ratingSummaryLeft: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  ratingBig: { fontSize: 36, fontWeight: '700', color: theme.textPrimary },
  ratingStarsRow: { flexDirection: 'row', marginTop: 4 },
  ratingCountText: { fontSize: 12, color: theme.textMuted, marginTop: 4 },
  ratingSummaryRight: { flex: 1, gap: 4, justifyContent: 'center' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingBarLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, width: 12, textAlign: 'right' },
  ratingBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#FCD34D' },
  ratingBarCount: { fontSize: 11, color: theme.textMuted, width: 20, textAlign: 'right' },
  reviewsList: { gap: 12 },
  reviewCard: { padding: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.borderLight },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  reviewerName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  reviewDate: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  reviewRatingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FFF9E6' },
  reviewRatingText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  reviewText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  noReviews: { alignItems: 'center', paddingVertical: 24 },
  noReviewsText: { fontSize: 14, color: theme.textMuted, marginTop: 8 },

  tabsRow: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: theme.backgroundSecondary },
  tabActive: { backgroundColor: theme.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  tabTextActive: { color: '#FFF' },
  menuList: { paddingHorizontal: 16 },
  menuItem: { flexDirection: 'row', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  popularBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  popularText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  menuItemName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  menuItemDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 4, lineHeight: 18 },
  menuItemPrice: { fontSize: 16, fontWeight: '700', color: theme.primary, marginTop: 8 },
  menuItemImage: { width: 100, height: 100, borderRadius: 14 },
  addBtnStyle: { position: 'absolute', bottom: -6, right: -6, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', ...theme.shadow.medium },
  addBtnActive: { backgroundColor: theme.backgroundDark },
  addBtnTextActive: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  unavailableBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, alignItems: 'center' },
  unavailableText: { fontSize: 10, fontWeight: '600', color: '#FFF' },
  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.border },
  cartBarInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.backgroundDark, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16 },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartCountBadge: { backgroundColor: theme.primary, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cartCountText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  cartBarLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cartBarTotal: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
