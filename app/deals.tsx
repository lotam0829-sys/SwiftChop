import React, { useState, useEffect, useMemo } from 'react';
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
import { DbMenuItem, fetchAllMenuItems } from '../services/supabaseData';

// Mock BOGO data to supplement real BOGO items
const MOCK_BOGO_ITEMS: Array<{
  id: string;
  name: string;
  description: string;
  price: number;
  image_key: string;
  restaurant_name: string;
  restaurant_id: string;
  category: string;
  is_bogo: boolean;
  bogo_description: string;
}> = [
  {
    id: 'mock-bogo-1',
    name: 'Jollof Rice & Chicken',
    description: 'Smoky party jollof rice with a perfectly grilled chicken thigh. A Nigerian classic.',
    price: 3500,
    image_key: 'heroJollof',
    restaurant_name: 'Mama Nkechi Kitchen',
    restaurant_id: 'mock-rest-1',
    category: 'nigerian',
    is_bogo: true,
    bogo_description: 'Buy 1 plate, get 1 FREE!',
  },
  {
    id: 'mock-bogo-2',
    name: 'Peppered Suya',
    description: 'Spicy grilled beef suya with onions, tomatoes, and extra yaji pepper.',
    price: 2500,
    image_key: 'foodSuya',
    restaurant_name: 'Suya Spot Lagos',
    restaurant_id: 'mock-rest-2',
    category: 'grilled',
    is_bogo: true,
    bogo_description: 'Get 2 skewers for the price of 1!',
  },
  {
    id: 'mock-bogo-3',
    name: 'Fried Rice Special',
    description: 'Nigerian-style fried rice with mixed vegetables, shrimp, and grilled plantain.',
    price: 4000,
    image_key: 'foodFriedrice',
    restaurant_name: 'ChopChop Express',
    restaurant_id: 'mock-rest-3',
    category: 'rice',
    is_bogo: true,
    bogo_description: 'Buy 1, get 1 FREE for a friend!',
  },
  {
    id: 'mock-bogo-4',
    name: 'Egusi Soup & Pounded Yam',
    description: 'Rich melon seed soup with assorted meat and fresh pounded yam.',
    price: 5000,
    image_key: 'foodEgusi',
    restaurant_name: 'Iya Basira Place',
    restaurant_id: 'mock-rest-4',
    category: 'soups',
    is_bogo: true,
    bogo_description: 'Order 1 bowl, get another FREE!',
  },
  {
    id: 'mock-bogo-5',
    name: 'Moi Moi Deluxe',
    description: 'Steamed bean pudding with boiled egg, fish, and corned beef.',
    price: 1500,
    image_key: 'foodMoimoi',
    restaurant_name: 'Mama Nkechi Kitchen',
    restaurant_id: 'mock-rest-1',
    category: 'snacks',
    is_bogo: true,
    bogo_description: 'Buy 2, get 2 FREE!',
  },
  {
    id: 'mock-bogo-6',
    name: 'Pepper Soup (Goat Meat)',
    description: 'Fiery goat meat pepper soup with aromatic spices. Perfect for any occasion.',
    price: 3000,
    image_key: 'foodPepperSoup',
    restaurant_name: 'Iya Basira Place',
    restaurant_id: 'mock-rest-4',
    category: 'soups',
    is_bogo: true,
    bogo_description: 'Buy 1 bowl, get 1 FREE!',
  },
];

type DealItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_key: string;
  restaurant_name: string;
  restaurant_id: string;
  category: string;
  bogo_description: string;
  is_mock: boolean;
};

export default function DealsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restaurants, addToCart } = useApp();
  const [loading, setLoading] = useState(true);
  const [allDeals, setAllDeals] = useState<DealItem[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      // Fetch real BOGO items from DB
      const { data: realItems } = await fetchAllMenuItems();
      const realBogo: DealItem[] = (realItems || [])
        .filter((item: any) => item.is_bogo)
        .map((item: any) => {
          const rest = restaurants.find(r => r.id === item.restaurant_id);
          return {
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            image_key: item.image_key,
            restaurant_name: rest?.name || 'Restaurant',
            restaurant_id: item.restaurant_id,
            category: item.category,
            bogo_description: item.bogo_description || 'Buy 1, Get 1 FREE!',
            is_mock: false,
          };
        });

      // Combine real BOGO items with mock data
      const mockDeals: DealItem[] = MOCK_BOGO_ITEMS.map(m => ({
        ...m,
        is_mock: true,
      }));

      setAllDeals([...realBogo, ...mockDeals]);
    } catch (err) {
      console.log('Failed to load deals:', err);
      // Fallback to mock data only
      setAllDeals(MOCK_BOGO_ITEMS.map(m => ({ ...m, is_mock: true })));
    } finally {
      setLoading(false);
    }
  };

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
    if (item.is_mock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
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
      item.restaurant_id,
      item.restaurant_name
    );
  };

  const renderDeal = ({ item }: { item: DealItem }) => (
    <Pressable
      onPress={() => {
        if (!item.is_mock) {
          router.push(`/restaurant/${item.restaurant_id}`);
        }
      }}
      style={styles.dealCard}
    >
      <View style={styles.dealImageWrap}>
        <Image source={getItemImage(item.image_key)} style={styles.dealImage} contentFit="cover" />
        <View style={styles.bogoBadge}>
          <MaterialIcons name="local-offer" size={12} color="#FFF" />
          <Text style={styles.bogoText}>BOGO</Text>
        </View>
        {item.is_mock ? (
          <View style={styles.sampleBadge}>
            <Text style={styles.sampleText}>Sample</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.dealInfo}>
        <Text style={styles.dealName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.dealDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.dealBogoRow}>
          <MaterialIcons name="celebration" size={14} color="#E65100" />
          <Text style={styles.dealBogoDesc}>{item.bogo_description}</Text>
        </View>
        <View style={styles.dealFooter}>
          <View>
            <View style={styles.dealPriceRow}>
              <Text style={styles.dealPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
              <Text style={styles.dealFreeLabel}>+ 1 FREE</Text>
            </View>
            <Text style={styles.dealRestaurant}>{item.restaurant_name}</Text>
          </View>
          <Pressable onPress={() => handleAddToCart(item)} style={[styles.addDealBtn, item.is_mock && { opacity: 0.5 }]}>
            <MaterialIcons name="add" size={20} color="#FFF" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

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

      {loading ? (
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
              <Text style={styles.emptySubtitle}>Check back soon for new offers</Text>
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
  sampleBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sampleText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
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
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
});
