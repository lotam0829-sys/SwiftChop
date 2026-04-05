import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useAuth } from '@/template';
import {
  DbRestaurant, DbMenuItem, DbOrder, DbUserProfile,
  fetchRestaurants, fetchMenuItems, fetchAllMenuItems,
  fetchCustomerOrders, fetchRestaurantOrders,
  createOrder, updateOrderStatus as updateOrderStatusDb,
  fetchUserProfile, updateUserProfile as updateProfileDb,
  fetchOwnerRestaurant, createRestaurantForOwner,
  insertMenuItem, updateMenuItem, deleteMenuItemById,
  dispatchToShipday, fetchOrderById,
} from '../services/supabaseData';
import { foodCategories } from '../services/mockData';

// Re-export for backward compatibility
export { foodCategories };

export interface CartItem {
  menuItem: DbMenuItem;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

interface AppContextType {
  // Auth (from template)
  isLoading: boolean;
  isAuthenticated: boolean;
  userProfile: DbUserProfile | null;
  refreshProfile: () => Promise<void>;

  // Restaurants
  restaurants: DbRestaurant[];
  loadingRestaurants: boolean;
  refreshRestaurants: () => Promise<void>;

  // Menu
  getMenuItems: (restaurantId: string) => Promise<DbMenuItem[]>;

  // Cart
  cart: CartItem[];
  addToCart: (item: DbMenuItem, restaurantId: string, restaurantName: string) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;

  // Customer orders
  customerOrders: DbOrder[];
  loadingOrders: boolean;
  placeOrder: (deliveryAddress: string, note?: string, paymentMethod?: string) => Promise<DbOrder | null>;
  refreshCustomerOrders: () => Promise<void>;
  refreshOrder: (orderId: string) => Promise<DbOrder | null>;

  // Restaurant owner
  ownerRestaurant: DbRestaurant | null;
  restaurantOrders: DbOrder[];
  restaurantMenuItems: DbMenuItem[];
  loadingRestaurantData: boolean;
  refreshRestaurantData: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  addMenuItem: (item: Omit<DbMenuItem, 'id' | 'created_at'>) => Promise<void>;
  deleteMenuItemAction: (itemId: string) => Promise<void>;
  toggleMenuItemAvailability: (itemId: string) => Promise<void>;

  // Profile updates
  updateProfile: (updates: Partial<DbUserProfile>) => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [userProfile, setUserProfile] = useState<DbUserProfile | null>(null);
  const [restaurants, setRestaurants] = useState<DbRestaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<DbOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Restaurant owner state
  const [ownerRestaurant, setOwnerRestaurant] = useState<DbRestaurant | null>(null);
  const [restaurantOrders, setRestaurantOrders] = useState<DbOrder[]>([]);
  const [restaurantMenuItems, setRestaurantMenuItems] = useState<DbMenuItem[]>([]);
  const [loadingRestaurantData, setLoadingRestaurantData] = useState(false);

  const isAuthenticated = !!user;
  const isLoading = authLoading;

  // Load user profile when auth user changes
  useEffect(() => {
    if (user?.id) {
      loadProfileAndSetup(user.id);
    } else {
      setUserProfile(null);
      setOwnerRestaurant(null);
      setRestaurantOrders([]);
      setRestaurantMenuItems([]);
      setCustomerOrders([]);
    }
  }, [user?.id]);

  // Load restaurants on mount
  useEffect(() => {
    refreshRestaurants();
  }, []);

  // Load cart from storage
  useEffect(() => {
    AsyncStorage.getItem('swiftchop_cart').then(data => {
      if (data) {
        try { setCart(JSON.parse(data)); } catch {}
      }
    });
  }, []);

  // Persist cart
  useEffect(() => {
    AsyncStorage.setItem('swiftchop_cart', JSON.stringify(cart));
  }, [cart]);

  // Load role-specific data when profile loads
  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role === 'customer') {
      refreshCustomerOrders();
    } else if (userProfile.role === 'restaurant') {
      refreshRestaurantData();
    }
  }, [userProfile?.id, userProfile?.role]);

  const loadProfileAndSetup = async (userId: string) => {
    const { data } = await fetchUserProfile(userId);
    if (data) {
      setUserProfile(data);
      // Auto-create restaurant entry if restaurant owner and none exists
      if (data.role === 'restaurant' && data.restaurant_name) {
        const { data: existing } = await fetchOwnerRestaurant(userId);
        if (!existing) {
          await createRestaurantForOwner(userId, data.restaurant_name);
        }
      }
    }
  };

  const loadProfile = async (userId: string) => {
    const { data } = await fetchUserProfile(userId);
    if (data) setUserProfile(data);
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  const refreshRestaurants = async () => {
    setLoadingRestaurants(true);
    const { data } = await fetchRestaurants();
    setRestaurants(data);
    setLoadingRestaurants(false);
  };

  const getMenuItems = async (restaurantId: string): Promise<DbMenuItem[]> => {
    const { data } = await fetchMenuItems(restaurantId);
    return data;
  };

  // Cart
  const addToCart = (item: DbMenuItem, restaurantId: string, restaurantName: string) => {
    if (cart.length > 0 && cart[0].restaurantId !== restaurantId) {
      Alert.alert(
        'Different Restaurant',
        'Your cart has items from another restaurant. Clear cart and add this item?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear & Add', style: 'destructive', onPress: () => setCart([{ menuItem: item, quantity: 1, restaurantId, restaurantName }]) },
        ]
      );
      return;
    }
    const idx = cart.findIndex(ci => ci.menuItem.id === item.id);
    if (idx >= 0) {
      const updated = [...cart];
      updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
      setCart(updated);
    } else {
      setCart([...cart, { menuItem: item, quantity: 1, restaurantId, restaurantName }]);
    }
  };

  const removeFromCart = (itemId: string) => setCart(cart.filter(ci => ci.menuItem.id !== itemId));

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) { removeFromCart(itemId); return; }
    setCart(cart.map(ci => ci.menuItem.id === itemId ? { ...ci, quantity } : ci));
  };

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  // Customer orders
  const refreshCustomerOrders = async () => {
    if (!user?.id) return;
    setLoadingOrders(true);
    const { data } = await fetchCustomerOrders(user.id);
    setCustomerOrders(data);
    setLoadingOrders(false);
  };

  // Refresh a single order (for polling on tracking screen)
  const refreshOrder = async (orderId: string): Promise<DbOrder | null> => {
    const { data } = await fetchOrderById(orderId);
    if (data) {
      // Update in customer orders list
      setCustomerOrders(prev => prev.map(o => o.id === orderId ? data : o));
      // Update in restaurant orders list
      setRestaurantOrders(prev => prev.map(o => o.id === orderId ? data : o));
    }
    return data;
  };

  const placeOrder = async (deliveryAddress: string, note?: string, paymentMethod?: string): Promise<DbOrder | null> => {
    if (!user?.id || cart.length === 0) return null;

    const restaurantId = cart[0].restaurantId;
    const restaurantName = cart[0].restaurantName;
    const restaurant = restaurants.find(r => r.id === restaurantId);

    const orderNumber = `SC-${Date.now().toString(36).toUpperCase()}`;
    const deliveryFee = restaurant?.delivery_fee || 1500;
    const serviceFee = 200;
    const total = cartTotal + deliveryFee + serviceFee;

    const { data, error } = await createOrder(
      {
        order_number: orderNumber,
        customer_id: user.id,
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
        restaurant_image_key: restaurant?.image_key || 'heroJollof',
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        total,
        status: 'confirmed',
        delivery_address: deliveryAddress,
        delivery_note: note,
        payment_method: paymentMethod || 'card',
        estimated_delivery: restaurant?.delivery_time || '25-40 min',
        customer_name: userProfile?.username || user.email?.split('@')[0],
        customer_phone: userProfile?.phone,
      },
      cart.map(ci => ({
        name: ci.menuItem.name,
        quantity: ci.quantity,
        price: ci.menuItem.price,
        menu_item_id: ci.menuItem.id,
      }))
    );

    if (data) {
      setCart([]);
      // Add to local state immediately
      const orderWithItems: DbOrder = {
        ...data,
        order_items: cart.map(ci => ({
          id: '',
          order_id: data.id,
          menu_item_id: ci.menuItem.id,
          name: ci.menuItem.name,
          quantity: ci.quantity,
          price: ci.menuItem.price,
        })),
      };
      setCustomerOrders(prev => [orderWithItems, ...prev]);

      // Dispatch to Shipday in background (non-blocking)
      dispatchToShipday(data.id).then(({ data: shipdayResult, error: shipdayError }) => {
        if (shipdayError) {
          console.log('Shipday dispatch note:', shipdayError);
        } else if (shipdayResult) {
          console.log('Shipday dispatch success:', shipdayResult);
          // Update local order with tracking URL
          if (shipdayResult.trackingUrl) {
            setCustomerOrders(prev =>
              prev.map(o => o.id === data.id
                ? { ...o, shipday_tracking_url: shipdayResult.trackingUrl, shipday_order_id: shipdayResult.shipdayOrderId }
                : o
              )
            );
          }
        }
      });

      return orderWithItems;
    }
    if (error) Alert.alert('Order Error', error);
    return null;
  };

  // Restaurant owner
  const refreshRestaurantData = async () => {
    if (!user?.id) return;
    setLoadingRestaurantData(true);
    
    // Fetch owner's restaurant
    const { data: restData } = await fetchOwnerRestaurant(user.id);
    if (restData) {
      setOwnerRestaurant(restData);
      // Fetch orders and menu for this restaurant
      const [ordersResult, menuResult] = await Promise.all([
        fetchRestaurantOrders(restData.id),
        fetchMenuItems(restData.id),
      ]);
      setRestaurantOrders(ordersResult.data);
      setRestaurantMenuItems(menuResult.data);
    }
    setLoadingRestaurantData(false);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await updateOrderStatusDb(orderId, status);
    setRestaurantOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    setCustomerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const addMenuItem = async (item: Omit<DbMenuItem, 'id' | 'created_at'>) => {
    const { data } = await insertMenuItem(item);
    if (data) setRestaurantMenuItems(prev => [data, ...prev]);
  };

  const deleteMenuItemAction = async (itemId: string) => {
    await deleteMenuItemById(itemId);
    setRestaurantMenuItems(prev => prev.filter(i => i.id !== itemId));
  };

  const toggleMenuItemAvailability = async (itemId: string) => {
    const item = restaurantMenuItems.find(i => i.id === itemId);
    if (!item) return;
    const newAvailability = !item.is_available;
    await updateMenuItem(itemId, { is_available: newAvailability } as any);
    setRestaurantMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: newAvailability } : i));
  };

  const updateProfile = async (updates: Partial<DbUserProfile>) => {
    if (!user?.id) return;
    await updateProfileDb(user.id, updates);
    setUserProfile(prev => prev ? { ...prev, ...updates } : prev);
  };

  return (
    <AppContext.Provider value={{
      isLoading, isAuthenticated, userProfile, refreshProfile,
      restaurants, loadingRestaurants, refreshRestaurants,
      getMenuItems,
      cart, addToCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount,
      customerOrders, loadingOrders, placeOrder, refreshCustomerOrders, refreshOrder,
      ownerRestaurant, restaurantOrders, restaurantMenuItems, loadingRestaurantData,
      refreshRestaurantData, updateOrderStatus,
      addMenuItem, deleteMenuItemAction, toggleMenuItemAvailability,
      updateProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
}
