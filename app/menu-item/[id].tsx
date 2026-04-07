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
import { DbMenuItem, fetchMenuItems, fetchRestaurantById } from '../../services/supabaseData';
import { isBogoActive, getBogoTimeRemaining } from '../../constants/timeUtils';
import { config } from '../../constants/config';

export default function MenuItemDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, restaurantId, restaurantName } = useLocalSearchParams<{ id: string; restaurantId: string; restaurantName: string }>();
  const { addToCart, cart, cartCount, cartTotal } = useApp();

  const [item, setItem] = useState<DbMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [restaurant, setRestaurant] = useState<any>(null);

  useEffect(() => {
    if (!id || !restaurantId) return;
    setLoading(true);
    Promise.all([
      fetchMenuItems(restaurantId),
      fetchRestaurantById(restaurantId),
    ]).then(([menuResult, restResult]) => {
      const found = menuResult.data.find(m => m.id === id);
      setItem(found || null);
      setRestaurant(restResult.data);
      setLoading(false);
    });
  }, [id, restaurantId]);

  const inCart = cart.find(ci => ci.menuItem.id === id);
  const isBogo = item && (item as any).is_bogo && isBogoActive((item as any).bogo_start, (item as any).bogo_end);
  const bogoRemaining = isBogo ? getBogoTimeRemaining((item as any).bogo_end) : null;
  const itemTotal = item ? item.price * quantity : 0;

  const getItemImage = (imageKey: string) => {
    if (imageKey && imageKey.startsWith('http')) return { uri: imageKey };
    return getImage(imageKey);
  };

  const handleAddToCart = () => {
    if (!item || !restaurantId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    for (let i = 0; i < quantity; i++) {
      addToCart(item, restaurantId, restaurantName || restaurant?.name || '');
    }
    router.back();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFF' }}>
        <MaterialIcons name="error-outline" size={48} color={theme.textMuted} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 }}>Item not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero image */}
        <View style={styles.hero}>
          <Image source={getItemImage(item.image_key)} style={styles.heroImage} contentFit="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.heroOverlay, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            {cartCount > 0 ? (
              <Pressable onPress={() => router.push('/cart')} style={styles.backBtn}>
                <MaterialIcons name="shopping-bag" size={22} color="#FFF" />
                <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
              </Pressable>
            ) : <View style={{ width: 42 }} />}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Badges row */}
          <View style={styles.badgesRow}>
            {item.is_popular ? (
              <View style={styles.popularBadge}>
                <MaterialIcons name="local-fire-department" size={14} color={theme.primary} />
                <Text style={styles.popularText}>Popular</Text>
              </View>
            ) : null}
            {isBogo ? (
              <View style={styles.bogoBadge}>
                <MaterialIcons name="local-offer" size={13} color="#FFF" />
                <Text style={styles.bogoText}>Buy One Get One FREE</Text>
              </View>
            ) : null}
            {!item.is_available ? (
              <View style={styles.unavailBadge}>
                <MaterialIcons name="block" size={13} color="#FFF" />
                <Text style={styles.unavailText}>Unavailable</Text>
              </View>
            ) : null}
          </View>

          {/* Name and price */}
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.itemPrice}>{config.currency}{item.price.toLocaleString()}</Text>
            {isBogo ? <Text style={styles.bogoFreeLabel}>+ 1 FREE</Text> : null}
            {bogoRemaining && bogoRemaining !== 'Expired' ? (
              <Text style={styles.bogoTimeLeft}>{bogoRemaining}</Text>
            ) : null}
          </View>

          {/* Restaurant info */}
          {restaurant ? (
            <View style={styles.restaurantRow}>
              <MaterialIcons name="storefront" size={16} color={theme.textMuted} />
              <Text style={styles.restaurantText}>{restaurant.name}</Text>
            </View>
          ) : null}

          {/* Description */}
          {item.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>Description</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </View>
          ) : null}

          {/* Category */}
          <View style={styles.detailsSection}>
            <Text style={styles.detailsTitle}>Details</Text>
            <View style={styles.detailRow}>
              <MaterialIcons name="category" size={16} color={theme.textMuted} />
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{item.category.charAt(0).toUpperCase() + item.category.slice(1)}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="check-circle" size={16} color={item.is_available ? theme.success : theme.error} />
              <Text style={styles.detailLabel}>Availability</Text>
              <Text style={[styles.detailValue, { color: item.is_available ? theme.success : theme.error }]}>
                {item.is_available ? 'Available' : 'Currently Unavailable'}
              </Text>
            </View>
            {inCart ? (
              <View style={styles.detailRow}>
                <MaterialIcons name="shopping-cart" size={16} color={theme.primary} />
                <Text style={styles.detailLabel}>In Your Cart</Text>
                <Text style={[styles.detailValue, { color: theme.primary }]}>{inCart.quantity} item{inCart.quantity > 1 ? 's' : ''}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      {item.is_available ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {/* Quantity selector */}
          <View style={styles.qtyRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setQuantity(Math.max(1, quantity - 1)); }}
              style={[styles.qtyBtn, quantity <= 1 && { opacity: 0.4 }]}
              disabled={quantity <= 1}
            >
              <MaterialIcons name="remove" size={20} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setQuantity(quantity + 1); }}
              style={[styles.qtyBtn, { backgroundColor: theme.primary }]}
            >
              <MaterialIcons name="add" size={20} color="#FFF" />
            </Pressable>
          </View>
          <Pressable
            onPress={handleAddToCart}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <MaterialIcons name="add-shopping-cart" size={20} color="#FFF" />
            <Text style={styles.addBtnText}>Add to Cart</Text>
            <Text style={styles.addBtnPrice}>{config.currency}{itemTotal.toLocaleString()}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.unavailableBar}>
            <MaterialIcons name="block" size={20} color="#FFF" />
            <Text style={styles.unavailableBarText}>This item is currently unavailable</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  hero: { height: 300, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: theme.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  content: { padding: 20 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  popularBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.primaryFaint },
  popularText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  bogoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E65100' },
  bogoText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  unavailBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.error },
  unavailText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  itemName: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12 },
  itemPrice: { fontSize: 22, fontWeight: '700', color: theme.primary },
  bogoFreeLabel: { fontSize: 13, fontWeight: '800', color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bogoTimeLeft: { fontSize: 11, fontWeight: '700', color: '#D97706', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  restaurantText: { fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  descSection: { marginBottom: 20 },
  descTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  descText: { fontSize: 15, color: theme.textSecondary, lineHeight: 24 },
  detailsSection: { marginBottom: 16 },
  detailsTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  detailLabel: { flex: 1, fontSize: 14, color: theme.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  bottomBar: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, minWidth: 24, textAlign: 'center' },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.backgroundDark, borderRadius: 16, paddingVertical: 16 },
  addBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  addBtnPrice: { fontSize: 14, fontWeight: '600', color: theme.primary },
  unavailableBar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#999', borderRadius: 16, paddingVertical: 16 },
  unavailableBarText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
