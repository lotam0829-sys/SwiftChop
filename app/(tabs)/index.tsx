import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { foodCategories } from '../../services/mockData';
import { getImage } from '../../constants/images';
import { DbRestaurant } from '../../services/supabaseData';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile, restaurants, loadingRestaurants, cartCount } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');

  const featured = restaurants.filter(r => r.is_featured);
  const filtered = activeCategory === 'all'
    ? restaurants.filter(r => r.is_open)
    : restaurants.filter(r => r.is_open);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.locationRow}>
              <MaterialIcons name="location-on" size={18} color={theme.primary} />
              <Text style={styles.locationLabel}>Deliver to</Text>
              <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.textSecondary} />
            </View>
            <Text style={styles.locationText}>{userProfile?.address || 'Victoria Island, Lagos'}</Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/cart'); }}
            style={styles.cartBtn}
          >
            <MaterialIcons name="shopping-bag" size={24} color={theme.textPrimary} />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>Hey, {userProfile?.username?.split(' ')[0] || 'there'} 👋</Text>
          <Text style={styles.greetingSub}>What are you craving today?</Text>
        </View>

        {/* Search bar */}
        <Pressable onPress={() => router.push('/(tabs)/search')} style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={theme.textMuted} />
          <Text style={styles.searchPlaceholder}>Search restaurants or dishes...</Text>
        </Pressable>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
          {foodCategories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat.id); }}
              style={[styles.categoryChip, activeCategory === cat.id && { backgroundColor: theme.primary }]}
            >
              <MaterialIcons name={cat.icon as any} size={18} color={activeCategory === cat.id ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.categoryText, activeCategory === cat.id && { color: '#FFF' }]}>{cat.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loadingRestaurants ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Featured Banner */}
            {featured.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
                  {featured.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }}
                      style={styles.featuredCard}
                    >
                      <Image source={getImage(r.image_key)} style={styles.featuredImage} contentFit="cover" />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.featuredGradient} />
                      <View style={styles.featuredInfo}>
                        <View style={styles.featuredBadge}>
                          <MaterialIcons name="star" size={12} color="#FCD34D" />
                          <Text style={styles.featuredRating}>{r.rating}</Text>
                        </View>
                        <Text style={styles.featuredName}>{r.name}</Text>
                        <Text style={styles.featuredMeta}>{r.cuisine} · {r.delivery_time}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* All Restaurants */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { paddingHorizontal: 16 }]}>
                {activeCategory === 'all' ? 'Near You' : `${foodCategories.find(c => c.id === activeCategory)?.name || ''} Restaurants`}
              </Text>
              <View style={styles.restaurantList}>
                {filtered.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${r.id}`); }}
                    style={styles.restaurantCard}
                  >
                    <Image source={getImage(r.image_key)} style={styles.restaurantImage} contentFit="cover" />
                    {!r.is_open ? (
                      <View style={styles.closedOverlay}>
                        <Text style={styles.closedText}>Closed</Text>
                      </View>
                    ) : null}
                    <View style={styles.restaurantInfo}>
                      <View style={styles.restaurantRow}>
                        <Text style={styles.restaurantName} numberOfLines={1}>{r.name}</Text>
                        <View style={styles.ratingBadge}>
                          <MaterialIcons name="star" size={14} color="#FCD34D" />
                          <Text style={styles.ratingText}>{r.rating}</Text>
                        </View>
                      </View>
                      <Text style={styles.restaurantCuisine}>{r.cuisine}</Text>
                      <View style={styles.restaurantMeta}>
                        <MaterialIcons name="access-time" size={14} color={theme.textMuted} />
                        <Text style={styles.metaText}>{r.delivery_time}</Text>
                        <View style={styles.metaDot} />
                        <MaterialIcons name="delivery-dining" size={14} color={theme.textMuted} />
                        <Text style={styles.metaText}>₦{r.delivery_fee.toLocaleString()}</Text>
                        <View style={styles.metaDot} />
                        <Text style={styles.metaText}>Min ₦{r.min_order.toLocaleString()}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  locationText: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 2 },
  cartBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: theme.primary, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  greetingSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 16 },
  greeting: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  greetingSub: { fontSize: 15, color: theme.textSecondary, marginTop: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 50, borderRadius: 14, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  searchPlaceholder: { fontSize: 15, color: theme.textMuted },
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
});
