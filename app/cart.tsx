import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { getImage } from '../constants/images';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, updateCartQuantity, removeFromCart, clearCart, cartTotal, cartCount } = useApp();

  const deliveryFee = cart.length > 0 ? 1500 : 0;
  const serviceFee = cart.length > 0 ? 200 : 0;
  const total = cartTotal + deliveryFee + serviceFee;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cart ({cartCount})</Text>
        {cart.length > 0 && (
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); clearCart(); }}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {cart.length > 0 ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 200 }}
          >
            {/* Restaurant */}
            <View style={styles.restaurantRow}>
              <MaterialIcons name="storefront" size={18} color={theme.primary} />
              <Text style={styles.restaurantName}>{cart[0]?.restaurantName}</Text>
            </View>

            {/* Items */}
            {cart.map((ci) => (
              <View key={ci.menuItem.id} style={styles.cartItem}>
                <Image source={getImage(ci.menuItem.imageKey)} style={styles.itemImage} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{ci.menuItem.name}</Text>
                  <Text style={styles.itemPrice}>₦{(ci.menuItem.price * ci.quantity).toLocaleString()}</Text>
                </View>
                <View style={styles.qtyControl}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (ci.quantity === 1) removeFromCart(ci.menuItem.id);
                      else updateCartQuantity(ci.menuItem.id, ci.quantity - 1);
                    }}
                    style={styles.qtyBtn}
                  >
                    <MaterialIcons name={ci.quantity === 1 ? 'delete-outline' : 'remove'} size={18} color={ci.quantity === 1 ? theme.error : theme.textPrimary} />
                  </Pressable>
                  <Text style={styles.qtyText}>{ci.quantity}</Text>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateCartQuantity(ci.menuItem.id, ci.quantity + 1); }}
                    style={[styles.qtyBtn, { backgroundColor: theme.primary }]}
                  >
                    <MaterialIcons name="add" size={18} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₦{cartTotal.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery fee</Text>
                <Text style={styles.summaryValue}>₦{deliveryFee.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service fee</Text>
                <Text style={styles.summaryValue}>₦{serviceFee.toLocaleString()}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₦{total.toLocaleString()}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Checkout Button */}
          <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/checkout'); }}
              style={({ pressed }) => [styles.checkoutBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Text style={styles.checkoutBtnPrice}>₦{total.toLocaleString()}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Image source={require('../assets/images/empty-orders.jpg')} style={styles.emptyImage} contentFit="contain" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add some delicious meals from nearby restaurants</Text>
          <Pressable
            onPress={() => router.back()}
            style={styles.browseBtn}
          >
            <Text style={styles.browseBtnText}>Browse Restaurants</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  clearText: { fontSize: 14, fontWeight: '600', color: theme.error },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: theme.primaryFaint },
  restaurantName: { fontSize: 15, fontWeight: '600', color: theme.primary },
  cartItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.borderLight },
  itemImage: { width: 60, height: 60, borderRadius: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  itemPrice: { fontSize: 15, fontWeight: '700', color: theme.primary, marginTop: 4 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, minWidth: 20, textAlign: 'center' },
  summarySection: { padding: 16, marginTop: 8 },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: theme.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  totalRow: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  totalValue: { fontSize: 20, fontWeight: '700', color: theme.primary },
  checkoutBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: theme.border },
  checkoutBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.backgroundDark, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18 },
  checkoutBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  checkoutBtnPrice: { fontSize: 16, fontWeight: '700', color: theme.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyImage: { width: 180, height: 140, marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  browseBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.primary },
  browseBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
