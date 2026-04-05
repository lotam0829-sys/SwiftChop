import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { DbMenuItem, fetchAllMenuItems } from '../../services/supabaseData';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restaurants } = useApp();
  const [query, setQuery] = useState('');
  const [allMenuItems, setAllMenuItems] = useState<DbMenuItem[]>([]);

  useEffect(() => {
    fetchAllMenuItems().then(({ data }) => setAllMenuItems(data));
  }, []);

  const allItems = useMemo(() => {
    const items: { type: 'restaurant' | 'dish'; id: string; name: string; subtitle: string; imageKey: string; restaurantId: string; price?: number }[] = [];
    restaurants.forEach(r => {
      items.push({ type: 'restaurant', id: r.id, name: r.name, subtitle: `${r.cuisine} · ${r.rating} ★`, imageKey: r.image_key, restaurantId: r.id });
    });
    allMenuItems.forEach(item => {
      const rest = restaurants.find(r => r.id === item.restaurant_id);
      if (rest) {
        items.push({ type: 'dish', id: item.id, name: item.name, subtitle: `${rest.name} · ₦${item.price.toLocaleString()}`, imageKey: item.image_key, restaurantId: rest.id, price: item.price });
      }
    });
    return items;
  }, [restaurants, allMenuItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allItems.filter(i => i.name.toLowerCase().includes(q) || i.subtitle.toLowerCase().includes(q));
  }, [query, allItems]);

  const popular = useMemo(() => allItems.filter(i => i.type === 'dish').slice(0, 8), [allItems]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
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
            <Pressable onPress={() => setQuery('')}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {query.trim() ? (
          <FlashList
            data={filtered}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
            ListHeaderComponent={<Text style={styles.resultCount}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</Text>}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptySubtitle}>Try a different search term</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${item.restaurantId}`); }}
                style={styles.resultItem}
              >
                <Image source={getImage(item.imageKey)} style={styles.resultImage} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name={item.type === 'restaurant' ? 'storefront' : 'restaurant'} size={14} color={theme.primary} />
                    <Text style={styles.resultType}>{item.type === 'restaurant' ? 'Restaurant' : 'Dish'}</Text>
                  </View>
                  <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          />
        ) : (
          <FlashList
            data={popular}
            keyExtractor={(item) => item.id}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
            ListHeaderComponent={<Text style={styles.sectionTitle}>Popular Dishes</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/restaurant/${item.restaurantId}`); }}
                style={styles.resultItem}
              >
                <Image source={getImage(item.imageKey)} style={styles.resultImage} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  searchHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 14, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: theme.textPrimary },
  resultCount: { fontSize: 13, color: theme.textSecondary, fontWeight: '500', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 16, marginTop: 8 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  resultImage: { width: 56, height: 56, borderRadius: 12 },
  resultType: { fontSize: 11, fontWeight: '600', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginTop: 2 },
  resultSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
});
