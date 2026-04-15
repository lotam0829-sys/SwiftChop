import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getImage } from '../constants/images';
import { DbMenuItem } from '../services/supabaseData';
import { isBogoActive, getBogoTimeRemaining } from '../constants/timeUtils';

type DealItem = DbMenuItem & {
  restaurantName: string;
  restaurantId: string;
  bogo_description: string;
  bogo_end: string | null;
};

export default function DealsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restaurants, allMenuItems, loadingAllMenuItems, addToCart } = useApp();
  const [activeFilter, setActiveFilter] = useState('all');

  const allDeals: DealItem[] = useMemo(() => {
    return allMenuItems
      .filter((item: any) => item.is_bogo && isBogoActive(item.bogo_start, item.bogo_end))
      .map((item: any) => {
        const rest = restaurants.find(r => r.id === item.restaurant_id);
        return {
          ...item,
          restaurantName: rest?.name || 'Restaurant',
          restaurantId: item.restaurant_id,
          bogo_description: item.bogo_description || 'Buy 1, Get 1 FREE!',
          bogo_end: item.bogo_end || null,
        };
      });
  }, [allMenuItems, restaurants]);

  const categories = useMemo(() => {
    const cats = new Set(allDeals.map(d => d.category));
    return ['all', ...Array.from(cats)];
  }, [allDeals]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return allDeals;
    return allDeals.filter(d => d.category === activeFilter);
  }, [allDeals, activeFilter]);

  const getItemImage = (imageKey: string) => {
    if (imageKey && imageKey.startsWith('http')) return { uri: imageKey };
    return getImage(imageKey);
  };

  const handleAddToCart = (item: DealItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart(
      {
        id: item.id,
        restaurant_id: item.restaurant_id,
        name: item.name,
        description: item.description,
        price: item.price,
        image_key: item.image_key,
        is_available: true,
        is_popular: false,
        category: item.category,
        created_at: '',
      },
      item.restaurantId,
      item.restaurantName
    );
  };

  const renderDeal = ({ item }: { item: DealItem }) => {
    const timeRemaining = item.bogo_end ? getBogoTimeRemaining(item.bogo_end) : null;
    return (
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/restaurant/${item.restaurantId}`);
        }}
        style={styles.dealCard}
      >
        <View style={styles.dealImageWrap}>
          <Image source={getItemImage(item.image_key)} style={styles.dealImage} contentFit="cover" />
          <View style={styles.bogoBadge}>
            <MaterialIcons name="local-offer" size={12} color="#FFF" />
            <Text style={styles.bogoText}>BOGO</Text>
          </View>
        </View>
        <View style={styles.dealInfo}>
          <Text style={styles.dealName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.dealDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.dealBogoRow}>
            <MaterialIcons name="celebration" size={14} color="#E65100" />
            <Text style={styles.dealBogoDesc}>{item.bogo_description}</Text>
          </View>
          {timeRemaining && timeRemaining !== 'Expired' ? (
            <View style={styles.dealTimerRow}>
              <MaterialIcons name="timer" size={13} color="#D97706" />
              <Text style={styles.dealTimerText}>{timeRemaining}</Text>
            </View>
          ) : null}
          <View style={styles.dealFooter}>
            <View>
              <View style={styles.dealPriceRow}>
                <Text style={styles.dealPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
                <Text style={styles.dealFreeLabel}>+ 1 FREE</Text>
              </View>
              <Text style={styles.dealRestaurant}>{item.restaurantName}</Text>
            </View>
            <Pressable onPress={() => handleAddToCart(item)} style={styles.addDealBtn}>
              <MaterialIcons name="add" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Deals & Benefits</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero banner */}
      <View style={styles.heroBanner}>
        <View style={styles.heroIconWrap}>
          <MaterialIcons name="local-offer" size={32} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Buy One Get One FREE</Text>
          <Text style={styles.heroSubtitle}>Get double the food at no extra cost. Limited time offers from your favourite restaurants.</Text>
        </View>
      </View>

      {/* Category filter */}
      {categories.length > 1 ? (
        <View style={styles.filterRow}>
          {categories.map(cat => (
            <Pressable
              key={cat}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(cat); }}
              style={[styles.filterPill, activeFilter === cat && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, activeFilter === cat && styles.filterTextActive]}>
                {cat === 'all' ? 'All Deals' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loadingAllMenuItems ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          estimatedItemSize={260}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={renderDeal}
          numColumns={2}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="local-offer" size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>No deals available</Text>
              <Text style={styles.emptySubtitle}>Restaurants create BOGO offers from their menu. Check back soon for new offers.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  heroBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 18, borderRadius: 18, backgroundColor: '#FF6B00', marginBottom: 16 },
  heroIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  filterPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterTextActive: { color: '#FFF' },
  dealCard: { flex: 1, marginHorizontal: 4, borderRadius: 16, backgroundColor: '#FFF', overflow: 'hidden', borderWidth: 1, borderColor: theme.borderLight, ...theme.shadow.small },
  dealImageWrap: { position: 'relative', height: 120 },
  dealImage: { width: '100%', height: '100%' },
  bogoBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E65100', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  bogoText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  dealInfo: { padding: 12 },
  dealName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  dealDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 3, lineHeight: 16 },
  dealBogoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FFF3E0' },
  dealBogoDesc: { fontSize: 11, fontWeight: '700', color: '#E65100', flex: 1 },
  dealFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  dealPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dealPrice: { fontSize: 16, fontWeight: '700', color: theme.primary },
  dealFreeLabel: { fontSize: 10, fontWeight: '800', color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  dealRestaurant: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  addDealBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  dealTimerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FEF3C7' },
  dealTimerText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 20 },
});
