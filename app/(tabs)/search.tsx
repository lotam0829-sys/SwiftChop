import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { DbMenuItem, DbRestaurant, fetchAllMenuItems } from '../../services/supabaseData';

type SortOption = 'relevance' | 'distance' | 'rating' | 'delivery_fee' | 'delivery_time';

const sortOptions: { key: SortOption; label: string; icon: string }[] = [
  { key: 'relevance', label: 'Relevance', icon: 'auto-awesome' },
  { key: 'distance', label: 'Distance', icon: 'near-me' },
  { key: 'rating', label: 'Rating', icon: 'star' },
  { key: 'delivery_fee', label: 'Delivery Fee', icon: 'delivery-dining' },
  { key: 'delivery_time', label: 'Delivery Time', icon: 'access-time' },
];

const priceRanges = [
  { key: 'any', label: 'Any' },
  { key: 'budget', label: 'Under \u20A62,000', max: 2000 },
  { key: 'mid', label: '\u20A62,000 - \u20A65,000', min: 2000, max: 5000 },
  { key: 'premium', label: 'Over \u20A65,000', min: 5000 },
];

const cuisineTypes = [
  'Nigerian', 'Continental', 'Chinese', 'Indian', 'Italian',
  'Fast Food', 'Seafood', 'BBQ & Grill', 'Healthy', 'Desserts',
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restaurants, userLocation, isFavorite, toggleFavorite } = useApp();

  const [query, setQuery] = useState('');
  const [allMenuItems, setAllMenuItems] = useState<DbMenuItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [priceRange, setPriceRange] = useState('any');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);

  // Pending filter state (applied only on "Apply")
  const [pendingSortBy, setPendingSortBy] = useState<SortOption>('relevance');
  const [pendingPriceRange, setPendingPriceRange] = useState('any');
  const [pendingCuisines, setPendingCuisines] = useState<string[]>([]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortBy !== 'relevance') count++;
    if (priceRange !== 'any') count++;
    if (selectedCuisines.length > 0) count++;
    return count;
  }, [sortBy, priceRange, selectedCuisines]);

  useEffect(() => {
    fetchAllMenuItems().then(({ data }) => setAllMenuItems(data));
  }, []);

  const getDistanceKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const getRestaurantDistance = useCallback((r: DbRestaurant): number | null => {
    if (!userLocation) return null;
    const lat = (r as any).latitude;
    const lng = (r as any).longitude;
    if (!lat || !lng) return null;
    return getDistanceKm(userLocation.latitude, userLocation.longitude, lat, lng);
  }, [userLocation, getDistanceKm]);

  const getEstimatedDeliveryMinutes = useCallback((r: DbRestaurant): number | null => {
    const d = getRestaurantDistance(r);
    if (d === null) return null;
    return Math.round(10 + d * 3);
  }, [getRestaurantDistance]);

  const getDistanceLabel = useCallback((r: DbRestaurant): string | null => {
    const d = getRestaurantDistance(r);
    if (d === null) return null;
    return d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
  }, [getRestaurantDistance]);

  const getDeliveryTimeLabel = useCallback((r: DbRestaurant): string | null => {
    const d = getRestaurantDistance(r);
    if (d === null) return null;
    const minTime = Math.round(10 + d * 3);
    const maxTime = Math.round(minTime + 10);
    return `${minTime}-${maxTime} min`;
  }, [getRestaurantDistance]);

  // Build search items (restaurants + dishes)
  const allItems = useMemo(() => {
    const items: {
      type: 'restaurant' | 'dish';
      id: string;
      name: string;
      subtitle: string;
      imageKey: string;
      restaurantId: string;
      restaurant?: DbRestaurant;
      price?: number;
    }[] = [];

    restaurants.forEach(r => {
      items.push({
        type: 'restaurant',
        id: r.id,
        name: r.name,
        subtitle: `${r.cuisine} \u00B7 ${r.rating} \u2605`,
        imageKey: r.image_key,
        restaurantId: r.id,
        restaurant: r,
      });
    });

    allMenuItems.forEach(item => {
      const rest = restaurants.find(r => r.id === item.restaurant_id);
      if (rest) {
        items.push({
          type: 'dish',
          id: item.id,
          name: item.name,
          subtitle: `${rest.name} \u00B7 \u20A6${item.price.toLocaleString()}`,
          imageKey: item.image_key,
          restaurantId: rest.id,
          restaurant: rest,
          price: item.price,
        });
      }
    });

    return items;
  }, [restaurants, allMenuItems]);

  // Filtered + sorted results
  const filtered = useMemo(() => {
    let results = query.trim()
      ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()) || i.subtitle.toLowerCase().includes(query.toLowerCase()))
      : [];

    // Cuisine filter
    if (selectedCuisines.length > 0 && results.length > 0) {
      results = results.filter(i => {
        if (!i.restaurant) return false;
        return selectedCuisines.some(c => i.restaurant!.cuisine.toLowerCase().includes(c.toLowerCase()));
      });
    }

    // Price range filter (applies to dishes, restaurants always pass)
    if (priceRange !== 'any' && results.length > 0) {
      const range = priceRanges.find(p => p.key === priceRange);
      if (range) {
        results = results.filter(i => {
          if (i.type === 'restaurant') return true;
          if (!i.price) return false;
          const min = (range as any).min || 0;
          const max = (range as any).max || Infinity;
          return i.price >= min && i.price <= max;
        });
      }
    }

    // Sorting
    if (sortBy !== 'relevance' && results.length > 0) {
      results = [...results].sort((a, b) => {
        const rA = a.restaurant;
        const rB = b.restaurant;
        if (!rA || !rB) return 0;

        switch (sortBy) {
          case 'distance': {
            const dA = getRestaurantDistance(rA);
            const dB = getRestaurantDistance(rB);
            if (dA === null) return 1;
            if (dB === null) return -1;
            return dA - dB;
          }
          case 'rating':
            return (rB.rating || 0) - (rA.rating || 0);
          case 'delivery_fee':
            return (rA.delivery_fee || 0) - (rB.delivery_fee || 0);
          case 'delivery_time': {
            const tA = getEstimatedDeliveryMinutes(rA);
            const tB = getEstimatedDeliveryMinutes(rB);
            if (tA === null) return 1;
            if (tB === null) return -1;
            return tA - tB;
          }
          default:
            return 0;
        }
      });
    }

    return results;
  }, [query, allItems, sortBy, priceRange, selectedCuisines, getRestaurantDistance, getEstimatedDeliveryMinutes]);

  // Popular dishes when no query
  const popular = useMemo(() => allItems.filter(i => i.type === 'dish').slice(0, 8), [allItems]);

  // Nearby restaurants when no query
  const nearbyRestaurants = useMemo(() => {
    if (!userLocation) return restaurants.slice(0, 6);
    return [...restaurants].sort((a, b) => {
      const dA = getRestaurantDistance(a);
      const dB = getRestaurantDistance(b);
      if (dA === null) return 1;
      if (dB === null) return -1;
      return dA - dB;
    }).slice(0, 6);
  }, [restaurants, userLocation, getRestaurantDistance]);

  const openFilters = useCallback(() => {
    setPendingSortBy(sortBy);
    setPendingPriceRange(priceRange);
    setPendingCuisines([...selectedCuisines]);
    setShowFilters(true);
  }, [sortBy, priceRange, selectedCuisines]);

  const applyFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSortBy(pendingSortBy);
    setPriceRange(pendingPriceRange);
    setSelectedCuisines(pendingCuisines);
    setShowFilters(false);
  }, [pendingSortBy, pendingPriceRange, pendingCuisines]);

  const resetFilters = useCallback(() => {
    Haptics.selectionAsync();
    setPendingSortBy('relevance');
    setPendingPriceRange('any');
    setPendingCuisines([]);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSortBy('relevance');
    setPriceRange('any');
    setSelectedCuisines([]);
  }, []);

  const toggleCuisine = useCallback((cuisine: string) => {
    Haptics.selectionAsync();
    setPendingCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    );
  }, []);

  const getItemImage = (imageKey: string) => {
    if (imageKey && imageKey.startsWith('http')) return { uri: imageKey };
    return getImage(imageKey);
  };

  const renderSearchResult = ({ item }: { item: typeof allItems[0] }) => {
    const dist = item.restaurant ? getDistanceLabel(item.restaurant) : null;
    const delivTime = item.restaurant ? getDeliveryTimeLabel(item.restaurant) : null;

    return (
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${item.restaurantId}`); }}
        style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
      >
        <Image source={getItemImage(item.imageKey)} style={styles.resultImage} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.typeBadge, item.type === 'restaurant' ? { backgroundColor: theme.primaryFaint } : { backgroundColor: theme.infoLight }]}>
              <MaterialIcons name={item.type === 'restaurant' ? 'storefront' : 'restaurant'} size={11} color={item.type === 'restaurant' ? theme.primary : theme.info} />
              <Text style={[styles.typeLabel, { color: item.type === 'restaurant' ? theme.primary : theme.info }]}>
                {item.type === 'restaurant' ? 'Restaurant' : 'Dish'}
              </Text>
            </View>
          </View>
          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.resultMeta}>
            {item.restaurant ? (
              <>
                <MaterialIcons name="star" size={13} color="#FCD34D" />
                <Text style={styles.resultMetaText}>{item.restaurant.rating}</Text>
              </>
            ) : null}
            {dist ? (
              <>
                <View style={styles.dot} />
                <MaterialIcons name="near-me" size={12} color={theme.primary} />
                <Text style={[styles.resultMetaText, { color: theme.primary }]}>{dist}</Text>
              </>
            ) : null}
            {delivTime ? (
              <>
                <View style={styles.dot} />
                <MaterialIcons name="access-time" size={12} color={theme.textMuted} />
                <Text style={styles.resultMetaText}>{delivTime}</Text>
              </>
            ) : null}
            {item.price ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.resultPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
              </>
            ) : null}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderNearbyRestaurant = (r: DbRestaurant) => {
    const dist = getDistanceLabel(r);
    const delivTime = getDeliveryTimeLabel(r);
    return (
      <Pressable
        key={r.id}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }}
        style={styles.nearbyCard}
      >
        <View style={styles.nearbyImgWrap}>
          <Image source={getImage(r.image_key)} style={styles.nearbyImg} contentFit="cover" />
          <Pressable
            onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleFavorite(r.id); }}
            style={styles.nearbyHeart}
            hitSlop={8}
          >
            <MaterialIcons name={isFavorite(r.id) ? 'favorite' : 'favorite-border'} size={16} color={isFavorite(r.id) ? '#EF4444' : 'rgba(255,255,255,0.85)'} />
          </Pressable>
        </View>
        <View style={styles.nearbyInfo}>
          <Text style={styles.nearbyName} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.nearbyCuisine} numberOfLines={1}>{r.cuisine}</Text>
          <View style={styles.nearbyMeta}>
            <MaterialIcons name="star" size={12} color="#FCD34D" />
            <Text style={styles.nearbyMetaText}>{r.rating}</Text>
            {dist ? (
              <>
                <View style={styles.dot} />
                <Text style={[styles.nearbyMetaText, { color: theme.primary }]}>{dist}</Text>
              </>
            ) : null}
            {delivTime ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.nearbyMetaText}>{delivTime}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants or dishes..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={openFilters} style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}>
          <MaterialIcons name="tune" size={22} color={activeFilterCount > 0 ? '#FFF' : theme.textPrimary} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Active filter chips */}
      {activeFilterCount > 0 ? (
        <View style={styles.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {sortBy !== 'relevance' ? (
              <Pressable
                onPress={() => setSortBy('relevance')}
                style={styles.activeChip}
              >
                <MaterialIcons name={sortOptions.find(s => s.key === sortBy)?.icon as any} size={14} color={theme.primary} />
                <Text style={styles.activeChipText}>{sortOptions.find(s => s.key === sortBy)?.label}</Text>
                <MaterialIcons name="close" size={14} color={theme.primary} />
              </Pressable>
            ) : null}
            {priceRange !== 'any' ? (
              <Pressable
                onPress={() => setPriceRange('any')}
                style={styles.activeChip}
              >
                <MaterialIcons name="payments" size={14} color={theme.primary} />
                <Text style={styles.activeChipText}>{priceRanges.find(p => p.key === priceRange)?.label}</Text>
                <MaterialIcons name="close" size={14} color={theme.primary} />
              </Pressable>
            ) : null}
            {selectedCuisines.map(c => (
              <Pressable
                key={c}
                onPress={() => setSelectedCuisines(prev => prev.filter(x => x !== c))}
                style={styles.activeChip}
              >
                <Text style={styles.activeChipText}>{c}</Text>
                <MaterialIcons name="close" size={14} color={theme.primary} />
              </Pressable>
            ))}
            <Pressable onPress={clearAllFilters} style={styles.clearAllChip}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      {/* Content */}
      <View style={{ flex: 1 }}>
        {query.trim() ? (
          <FlashList
            data={filtered}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            estimatedItemSize={80}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
            ListHeaderComponent={
              <Text style={styles.resultCount}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}{activeFilterCount > 0 ? ' (filtered)' : ''}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptySubtitle}>
                  {activeFilterCount > 0 ? 'Try adjusting your filters or search term' : 'Try a different search term'}
                </Text>
                {activeFilterCount > 0 ? (
                  <Pressable onPress={clearAllFilters} style={styles.clearFiltersBtn}>
                    <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            renderItem={renderSearchResult}
            ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            {/* Quick Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
              {['Nigerian', 'Fast Food', 'Healthy', 'Seafood', 'BBQ & Grill'].map(cuisine => (
                <Pressable
                  key={cuisine}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCuisines(prev =>
                      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
                    );
                    setQuery(cuisine);
                  }}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>{cuisine}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Nearby Restaurants */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="near-me" size={18} color={theme.primary} />
                <Text style={styles.sectionTitle}>Nearby Restaurants</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                {nearbyRestaurants.map(renderNearbyRestaurant)}
              </ScrollView>
            </View>

            {/* Popular Dishes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="local-fire-department" size={18} color="#EF4444" />
                <Text style={styles.sectionTitle}>Popular Dishes</Text>
              </View>
              <View style={styles.popularGrid}>
                {popular.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${item.restaurantId}`); }}
                    style={styles.popularCard}
                  >
                    <Image source={getItemImage(item.imageKey)} style={styles.popularImg} contentFit="cover" />
                    <View style={styles.popularInfo}>
                      <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.popularSub} numberOfLines={1}>{item.subtitle}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters & Sort</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={8}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* Sort By */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sort By</Text>
                <View style={styles.sortGrid}>
                  {sortOptions.map(opt => {
                    const isActive = pendingSortBy === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => { Haptics.selectionAsync(); setPendingSortBy(opt.key); }}
                        style={[styles.sortChip, isActive && styles.sortChipActive]}
                      >
                        <MaterialIcons name={opt.icon as any} size={18} color={isActive ? '#FFF' : theme.textSecondary} />
                        <Text style={[styles.sortChipText, isActive && { color: '#FFF' }]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Price Range</Text>
                <View style={styles.priceGrid}>
                  {priceRanges.map(range => {
                    const isActive = pendingPriceRange === range.key;
                    return (
                      <Pressable
                        key={range.key}
                        onPress={() => { Haptics.selectionAsync(); setPendingPriceRange(range.key); }}
                        style={[styles.priceChip, isActive && styles.priceChipActive]}
                      >
                        <Text style={[styles.priceChipText, isActive && { color: '#FFF' }]}>{range.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Cuisine Type */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Cuisine Type</Text>
                <View style={styles.cuisineGrid}>
                  {cuisineTypes.map(cuisine => {
                    const isActive = pendingCuisines.includes(cuisine);
                    return (
                      <Pressable
                        key={cuisine}
                        onPress={() => toggleCuisine(cuisine)}
                        style={[styles.cuisineChip, isActive && styles.cuisineChipActive]}
                      >
                        {isActive ? <MaterialIcons name="check" size={14} color="#FFF" /> : null}
                        <Text style={[styles.cuisineChipText, isActive && { color: '#FFF' }]}>{cuisine}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Bottom actions */}
            <View style={styles.modalActions}>
              <Pressable onPress={resetFilters} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  // Search header
  searchHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },
  filterBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: theme.primary },
  filterCount: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 }, android: { elevation: 2 } }) },
  filterCountText: { fontSize: 10, fontWeight: '700', color: theme.primary },

  // Active filter chips
  activeFiltersRow: { marginBottom: 8 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.primaryFaint, borderWidth: 1, borderColor: theme.primaryMuted },
  activeChipText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  clearAllChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.errorLight },
  clearAllText: { fontSize: 12, fontWeight: '600', color: theme.error },

  // Result count
  resultCount: { fontSize: 13, color: theme.textSecondary, fontWeight: '500', marginBottom: 8, marginTop: 8 },

  // Result card
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  resultImage: { width: 60, height: 60, borderRadius: 14 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 3 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  resultMetaText: { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
  resultPrice: { fontSize: 12, fontWeight: '700', color: theme.primary },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: theme.textMuted },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
  clearFiltersBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primaryFaint },
  clearFiltersBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },

  // Quick filter chips
  quickFilters: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: theme.backgroundSecondary },
  quickChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Section
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },

  // Nearby cards
  nearbyCard: { width: 160, borderRadius: 14, backgroundColor: '#FFF', overflow: 'hidden', ...theme.shadow.small },
  nearbyImgWrap: { position: 'relative' },
  nearbyImg: { width: 160, height: 100, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  nearbyHeart: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  nearbyInfo: { padding: 10 },
  nearbyName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  nearbyCuisine: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  nearbyMetaText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },

  // Popular grid
  popularGrid: { paddingHorizontal: 16, gap: 10 },
  popularCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  popularImg: { width: 52, height: 52, borderRadius: 12 },
  popularInfo: { flex: 1 },
  popularName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  popularSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },

  // Filter sections
  filterSection: { paddingHorizontal: 20, marginBottom: 24 },
  filterSectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },

  // Sort chips
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  sortChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  sortChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Price chips
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  priceChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  priceChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Cuisine chips
  cuisineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cuisineChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  cuisineChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  cuisineChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  resetBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  applyBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
