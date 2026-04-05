import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { foodCategories } from '../../services/mockData';
import { getImage } from '../../constants/images';
import { DbRestaurant } from '../../services/supabaseData';
import { getCuisineColor, parseCuisines } from '../../constants/config';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, restaurants, loadingRestaurants, cartCount, userLocation, requestLocation, favoriteRestaurants, isFavorite, toggleFavorite } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [isAtLocation, setIsAtLocation] = useState(true);

  // Reverse geocode user location for display
  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    const reverseGeocode = async () => {
      setLoadingLocation(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
        if (!cancelled && results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
          setLocationName(parts.slice(0, 2).join(', ') || r.city || r.region || null);
        }
      } catch (err) {
        console.log('Reverse geocode error:', err);
      } finally {
        if (!cancelled) setLoadingLocation(false);
      }
    };
    reverseGeocode();
    return () => { cancelled = true; };
  }, [userLocation?.latitude, userLocation?.longitude]);

  // Check if user is at their saved address
  useEffect(() => {
    if (!userLocation || !userProfile?.address) {
      setIsAtLocation(true);
      return;
    }
    if (locationName && userProfile.address) {
      const saved = userProfile.address.toLowerCase();
      const current = locationName.toLowerCase();
      const overlap = current.split(',').some(part => saved.includes(part.trim()));
      setIsAtLocation(overlap);
    }
  }, [locationName, userProfile?.address]);

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Dynamic delivery time based on distance — returns null if cannot calculate
  const getEstimatedDeliveryTime = (distKm: number | null): string | null => {
    if (distKm === null) return null;
    const minTime = Math.round(10 + distKm * 3);
    const maxTime = Math.round(minTime + 10);
    return `${minTime}-${maxTime} min`;
  };

  const sortedRestaurants = React.useMemo(() => {
    if (!userLocation) return restaurants;
    return [...restaurants].sort((a, b) => {
      const aLat = (a as any).latitude;
      const aLng = (a as any).longitude;
      const bLat = (b as any).latitude;
      const bLng = (b as any).longitude;
      if (!aLat || !aLng) return 1;
      if (!bLat || !bLng) return -1;
      const distA = getDistanceKm(userLocation.latitude, userLocation.longitude, aLat, aLng);
      const distB = getDistanceKm(userLocation.latitude, userLocation.longitude, bLat, bLng);
      return distA - distB;
    });
  }, [restaurants, userLocation]);

  const featured = sortedRestaurants.filter(r => r.is_featured);
  const filtered = activeCategory === 'all'
    ? sortedRestaurants.filter(r => r.is_open)
    : sortedRestaurants.filter(r => r.is_open);

  const getRestaurantDistance = (r: DbRestaurant): number | null => {
    if (!userLocation) return null;
    const lat = (r as any).latitude;
    const lng = (r as any).longitude;
    if (!lat || !lng) return null;
    return getDistanceKm(userLocation.latitude, userLocation.longitude, lat, lng);
  };

  const getDistanceLabel = (r: DbRestaurant): string | null => {
    const d = getRestaurantDistance(r);
    if (d === null) return null;
    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
  };

  const getDeliveryTimeLabel = (r: DbRestaurant): string | null => {
    const d = getRestaurantDistance(r);
    return getEstimatedDeliveryTime(d);
  };

  const displayAddress = locationName || userProfile?.address || 'Set your delivery address';

  const savedAddresses = [
    userProfile?.address ? { label: 'Saved Address', value: userProfile.address } : null,
    locationName ? { label: 'Current Location', value: locationName } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const handleRefreshLocation = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await requestLocation();
  }, [requestLocation]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setShowAddressPicker(true)} style={{ flex: 1 }}>
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={18} color={theme.primary} />
              <Text style={styles.locationLabel}>Deliver to</Text>
              {loadingLocation ? <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 4 }} /> : <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.textSecondary} />}
            </View>
            <Text style={styles.locationText} numberOfLines={1}>{displayAddress}</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/cart'); }} style={styles.cartBtn}>
            <MaterialIcons name="shopping-bag" size={24} color={theme.textPrimary} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Location mismatch banner */}
        {!isAtLocation && locationName ? (
          <View style={styles.locationBanner}>
            <MaterialIcons name="info" size={18} color="#D97706" />
            <Text style={styles.locationBannerText}>
              You appear to be at <Text style={{ fontWeight: '700' }}>{locationName}</Text>, which is different from your saved address. Delivery times shown are based on your current location.
            </Text>
          </View>
        ) : null}

        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Hey, {userProfile?.username?.split(' ')[0] || 'there'} {"\uD83D\uDC4B"}</Text>
          <Text style={styles.greetingSub}>What are you craving today?</Text>
        </View>

        {/* Search bar */}
        <Pressable onPress={() => router.push('/(tabs)/search')} style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={theme.textMuted} />
          <Text style={styles.searchPlaceholder}>Search restaurants or dishes...</Text>
        </Pressable>

        {/* Deals & Benefits Banner */}
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/deals'); }} style={styles.dealsBanner}>
          <View style={styles.dealsIconWrap}>
            <MaterialIcons name="local-offer" size={24} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dealsBannerTitle}>Deals & Benefits</Text>
            <Text style={styles.dealsBannerSub}>Buy One Get One FREE on select items</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#FFF" />
        </Pressable>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {foodCategories.map((cat) => (
            <Pressable key={cat.id} onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat.id); }} style={[styles.categoryChip, activeCategory === cat.id && { backgroundColor: theme.primary }]}>
              <MaterialIcons name={cat.icon as any} size={18} color={activeCategory === cat.id ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.categoryText, activeCategory === cat.id && { color: '#FFF' }]}>{cat.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loadingRestaurants ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Favorites Section */}
            {favoriteRestaurants.length > 0 ? (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 14 }}>
                  <MaterialIcons name="favorite" size={20} color="#EF4444" />
                  <Text style={styles.sectionTitle}>Your Favourites</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {favoriteRestaurants.map((r) => {
                    const dist = getDistanceLabel(r);
                    const delivTime = getDeliveryTimeLabel(r);
                    return (
                      <Pressable key={r.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }} style={styles.favCard}>
                        <View style={styles.favImageWrap}>
                          <Image source={getImage(r.image_key)} style={styles.favImage} contentFit="cover" />
                          <Pressable
                            onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFavorite(r.id); }}
                            style={styles.favHeartBtn}
                            hitSlop={8}
                          >
                            <MaterialIcons name="favorite" size={18} color="#EF4444" />
                          </Pressable>
                        </View>
                        <View style={styles.favInfo}>
                          <Text style={styles.favName} numberOfLines={1}>{r.name}</Text>
                          <View style={styles.cuisinePillsRow}>
                            {parseCuisines(r.cuisine).map((c, ci) => {
                              const cc = getCuisineColor(c);
                              return <View key={ci} style={[styles.cuisinePill, { backgroundColor: cc.bg }]}><Text style={[styles.cuisinePillText, { color: cc.text }]}>{c}</Text></View>;
                            })}
                          </View>
                          <View style={styles.favMeta}>
                            <MaterialIcons name="star" size={13} color="#FCD34D" />
                            <Text style={styles.favMetaText}>{r.rating}</Text>
                            {dist ? (
                              <>
                                <View style={styles.metaDot} />
                                <Text style={[styles.favMetaText, { color: theme.primary }]}>{dist}</Text>
                              </>
                            ) : null}
                            {delivTime ? (
                              <>
                                <View style={styles.metaDot} />
                                <Text style={styles.favMetaText}>{delivTime}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {featured.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {featured.map((r) => {
                    const dist = getDistanceLabel(r);
                    const delivTime = getDeliveryTimeLabel(r);
                    return (
                      <Pressable key={r.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }} style={styles.featuredCard}>
                        <Image source={getImage(r.image_key)} style={styles.featuredImage} contentFit="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.featuredGradient} />
                        <View style={styles.featuredInfo}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <View style={styles.featuredBadge}>
                              <MaterialIcons name="star" size={12} color="#FCD34D" />
                              <Text style={styles.featuredRating}>{r.rating}</Text>
                            </View>
                            {dist ? (
                              <View style={styles.featuredBadge}>
                                <MaterialIcons name="near-me" size={11} color="#60A5FA" />
                                <Text style={styles.featuredRating}>{dist}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.featuredName}>{r.name}</Text>
                          <Text style={styles.featuredMeta}>
                            {r.cuisine}
                            {delivTime ? ` \u00B7 ${delivTime}` : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>
                {activeCategory === 'all' ? 'Near You' : `${foodCategories.find(c => c.id === activeCategory)?.name || ''} Restaurants`}
              </Text>
              <View style={styles.restaurantList}>
                {filtered.map((r) => {
                  const dist = getDistanceLabel(r);
                  const delivTime = getDeliveryTimeLabel(r);
                  return (
                    <Pressable key={r.id} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }} style={styles.restaurantCard}>
                      <View>
                        <Image source={getImage(r.image_key)} style={styles.restaurantImage} contentFit="cover" />
                        {!r.is_open ? (
                          <View style={styles.closedOverlay}>
                            <Text style={styles.closedText}>Closed</Text>
                          </View>
                        ) : null}
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFavorite(r.id); }}
                          style={styles.heartBtn}
                          hitSlop={8}
                        >
                          <MaterialIcons name={isFavorite(r.id) ? 'favorite' : 'favorite-border'} size={22} color={isFavorite(r.id) ? '#EF4444' : 'rgba(255,255,255,0.85)'} />
                        </Pressable>
                      </View>
                      <View style={styles.restaurantInfo}>
                        <View style={styles.restaurantRow}>
                          <Text style={styles.restaurantName} numberOfLines={1}>{r.name}</Text>
                          <View style={styles.ratingBadge}>
                            <MaterialIcons name="star" size={14} color="#FCD34D" />
                            <Text style={styles.ratingText}>{r.rating}</Text>
                          </View>
                        </View>
                        <View style={styles.cuisinePillsRow}>
                          {parseCuisines(r.cuisine).map((c, ci) => {
                            const cc = getCuisineColor(c);
                            return <View key={ci} style={[styles.cuisinePill, { backgroundColor: cc.bg }]}><Text style={[styles.cuisinePillText, { color: cc.text }]}>{c}</Text></View>;
                          })}
                        </View>
                        <View style={styles.restaurantMeta}>
                          {delivTime ? (
                            <>
                              <MaterialIcons name="access-time" size={14} color={theme.textMuted} />
                              <Text style={styles.metaText}>{delivTime}</Text>
                              <View style={styles.metaDot} />
                            </>
                          ) : null}
                          <MaterialIcons name="delivery-dining" size={14} color={theme.textMuted} />
                          <Text style={styles.metaText}>{"\u20A6"}{r.delivery_fee.toLocaleString()}</Text>
                          {dist ? (
                            <>
                              <View style={styles.metaDot} />
                              <MaterialIcons name="near-me" size={13} color={theme.primary} />
                              <Text style={[styles.metaText, { color: theme.primary, fontWeight: '600' }]}>{dist}</Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                {filtered.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                    <Text style={styles.emptyTitle}>No restaurants found</Text>
                    <Text style={styles.emptySubtitle}>Try a different category</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Address picker modal */}
      <Modal visible={showAddressPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Address</Text>
              <Pressable onPress={() => setShowAddressPicker(false)}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <Pressable onPress={handleRefreshLocation} style={styles.useLocationBtn}>
              <MaterialIcons name="my-location" size={20} color={theme.primary} />
              <Text style={styles.useLocationText}>Use current location</Text>
            </Pressable>

            {savedAddresses.map((addr, idx) => (
              <Pressable key={idx} onPress={() => setShowAddressPicker(false)} style={styles.addressItem}>
                <View style={styles.addressIcon}>
                  <MaterialIcons name={addr.label === 'Current Location' ? 'gps-fixed' : 'home'} size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{addr.label}</Text>
                  <Text style={styles.addressValue} numberOfLines={2}>{addr.value}</Text>
                </View>
              </Pressable>
            ))}

            {savedAddresses.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <MaterialIcons name="location-off" size={36} color={theme.textMuted} />
                <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 8 }}>No saved addresses. Enable location to get started.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  locationText: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 2, maxWidth: 260 },
  cartBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: theme.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  locationBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  locationBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
  greetingSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  greetingSub: { fontSize: 15, color: theme.textSecondary, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  searchPlaceholder: { fontSize: 15, color: theme.textMuted },
  dealsBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 16, padding: 16, borderRadius: 16, backgroundColor: '#E65100' },
  dealsIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  dealsBannerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  dealsBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  categoriesRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: theme.backgroundSecondary },
  categoryText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 14, paddingHorizontal: 0 },
  featuredCard: { width: 280, height: 180, borderRadius: 16, overflow: 'hidden' },
  featuredImage: { width: '100%', height: '100%' },
  featuredGradient: { ...StyleSheet.absoluteFillObject },
  featuredInfo: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  featuredRating: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  featuredName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  featuredMeta: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  restaurantList: { paddingHorizontal: 16, gap: 16 },
  restaurantCard: { borderRadius: 16, backgroundColor: '#FFF', overflow: 'hidden', ...theme.shadow.medium },
  restaurantImage: { width: '100%', height: 160 },
  closedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', height: 160 },
  closedText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  restaurantInfo: { padding: 14 },
  restaurantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restaurantName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF9E6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  restaurantCuisine: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  restaurantMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  metaText: { fontSize: 12, color: theme.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
  // Favorites
  favCard: { width: 160, borderRadius: 14, backgroundColor: '#FFF', overflow: 'hidden', ...theme.shadow.small },
  favImageWrap: { position: 'relative' },
  favImage: { width: 160, height: 100, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  favHeartBtn: { position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  favInfo: { padding: 10 },
  favName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  favMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  favMetaText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  cuisinePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  cuisinePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  cuisinePillText: { fontSize: 10, fontWeight: '700' },
  // Heart button on restaurant cards
  heartBtn: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  useLocationBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  useLocationText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  addressItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  addressIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  addressLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  addressValue: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
});
