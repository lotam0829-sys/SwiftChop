import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { useAuth } from '@/template';
import * as Notifications from 'expo-notifications';
import {
  DbRestaurant, DbMenuItem, DbOrder, DbUserProfile,
  fetchRestaurants, fetchMenuItems, fetchAllMenuItems,
  fetchCustomerOrders, fetchRestaurantOrders,
  createOrder, updateOrderStatus as updateOrderStatusDb,
  fetchUserProfile, updateUserProfile as updateProfileDb,
  fetchOwnerRestaurant, createRestaurantForOwner,
  insertMenuItem, updateMenuItem, deleteMenuItemById,
  dispatchToShipday, fetchOrderById, savePushToken,
  fetchFavorites, addFavorite as addFavoriteDb, removeFavorite as removeFavoriteDb,
} from '../services/supabaseData';
import { foodCategories } from '../services/mockData';
import { config, calculateDeliveryFee } from '../constants/config';
import * as Location from 'expo-location';

export { foodCategories };

export interface CartItem {
  menuItem: DbMenuItem;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

interface AppContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  userProfile: DbUserProfile | null;
  refreshProfile: () => Promise<void>;

  restaurants: DbRestaurant[];
  loadingRestaurants: boolean;
  refreshRestaurants: () => Promise<void>;

  getMenuItems: (restaurantId: string) => Promise<DbMenuItem[]>;

  cart: CartItem[];
  addToCart: (item: DbMenuItem, restaurantId: string, restaurantName: string) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;

  customerOrders: DbOrder[];
  loadingOrders: boolean;
  placeOrder: (deliveryAddress: string, note?: string, paymentMethod?: string, deliveryFee?: number) => Promise<DbOrder | null>;
  refreshCustomerOrders: () => Promise<void>;
  refreshOrder: (orderId: string) => Promise<DbOrder | null>;

  ownerRestaurant: DbRestaurant | null;
  restaurantOrders: DbOrder[];
  restaurantMenuItems: DbMenuItem[];
  loadingRestaurantData: boolean;
  refreshRestaurantData: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  addMenuItem: (item: Omit<DbMenuItem, 'id' | 'created_at'>) => Promise<void>;
  deleteMenuItemAction: (itemId: string) => Promise<void>;
  toggleMenuItemAvailability: (itemId: string) => Promise<void>;

  updateProfile: (updates: Partial<DbUserProfile>) => Promise<void>;
  reorder: (order: DbOrder) => Promise<boolean>;

  userLocation: { latitude: number; longitude: number } | null;
  requestLocation: () => Promise<void>;

  // Push notifications
  pushToken: string | null;

  // Favorites
  favoriteIds: string[];
  isFavorite: (restaurantId: string) => boolean;
  toggleFavorite: (restaurantId: string) => Promise<void>;
  favoriteRestaurants: DbRestaurant[];
  loadingFavorites: boolean;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useApp = () => useContext(AppContext);

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [userProfile, setUserProfile] = useState<DbUserProfile | null>(null);
  const [restaurants, setRestaurants] = useState<DbRestaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<DbOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [ownerRestaurant, setOwnerRestaurant] = useState<DbRestaurant | null>(null);
  const [restaurantOrders, setRestaurantOrders] = useState<DbOrder[]>([]);
  const [restaurantMenuItems, setRestaurantMenuItems] = useState<DbMenuItem[]>([]);
  const [loadingRestaurantData, setLoadingRestaurantData] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  const isAuthenticated = !!user;
  const isLoading = authLoading;

  // === PUSH NOTIFICATIONS ===
  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      // Navigation handled by the notification tap is done at the layout level
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Save push token to DB when user + token are both available
  useEffect(() => {
    if (user?.id && pushToken) {
      savePushToken(user.id, pushToken).then(({ error }) => {
        if (error) console.log('Failed to save push token:', error);
        else console.log('Push token saved to profile');
      });
    }
  }, [user?.id, pushToken]);

  const registerForPushNotifications = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('order-updates', {
          name: 'Order Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B00',
          sound: 'default',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Auto-detect from app.json
      });

      setPushToken(tokenData.data);
      console.log('Push token:', tokenData.data);
    } catch (err) {
      console.log('Push notification setup error:', err);
    }
  };

  // Load user profile when auth user changes
  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
    } else {
      setUserProfile(null);
      setOwnerRestaurant(null);
      setRestaurantOrders([]);
      setRestaurantMenuItems([]);
      setCustomerOrders([]);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshRestaurants();
    requestLocation();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('swiftchop_cart').then(data => {
      if (data) {
        try { setCart(JSON.parse(data)); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('swiftchop_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role === 'customer') {
      refreshCustomerOrders();
      loadFavorites();
    } else if (userProfile.role === 'restaurant') {
      refreshRestaurantData();
    }
  }, [userProfile?.id, userProfile?.role]);

  const loadProfile = async (userId: string) => {
    const { data } = await fetchUserProfile(userId);
    if (data) setUserProfile(data);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const { data } = await fetchUserProfile(user.id);
      if (data) setUserProfile(data);
    }
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

  const refreshCustomerOrders = async () => {
    if (!user?.id) return;
    setLoadingOrders(true);
    const { data } = await fetchCustomerOrders(user.id);
    setCustomerOrders(data);
    setLoadingOrders(false);
  };

  const refreshOrder = async (orderId: string): Promise<DbOrder | null> => {
    const { data } = await fetchOrderById(orderId);
    if (data) {
      setCustomerOrders(prev => prev.map(o => o.id === orderId ? data : o));
      setRestaurantOrders(prev => prev.map(o => o.id === orderId ? data : o));
    }
    return data;
  };

  const placeOrder = async (deliveryAddress: string, note?: string, paymentMethod?: string, deliveryFee?: number): Promise<DbOrder | null> => {
    if (!user?.id || cart.length === 0) return null;

    const restaurantId = cart[0].restaurantId;
    const restaurantName = cart[0].restaurantName;
    const restaurant = restaurants.find(r => r.id === restaurantId);

    const orderNumber = `SC-${Date.now().toString(36).toUpperCase()}`;
    const finalDeliveryFee = deliveryFee ?? calculateDeliveryFee();
    const serviceFee = config.serviceFee;
    const total = cartTotal + finalDeliveryFee + serviceFee;

    const { data, error } = await createOrder(
      {
        order_number: orderNumber,
        customer_id: user.id,
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
        restaurant_image_key: restaurant?.image_key || 'heroJollof',
        subtotal: cartTotal,
        delivery_fee: finalDeliveryFee,
        service_fee: serviceFee,
        total,
        status: 'pending',
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

      dispatchToShipday(data.id).then(({ data: shipdayResult, error: shipdayError }) => {
        if (shipdayError) {
          console.log('Shipday dispatch note:', shipdayError);
        } else if (shipdayResult) {
          console.log('Shipday dispatch success:', shipdayResult);
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

  const refreshRestaurantData = async () => {
    if (!user?.id) return;
    setLoadingRestaurantData(true);

    const { data: restData } = await fetchOwnerRestaurant(user.id);
    if (restData) {
      setOwnerRestaurant(restData);
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

  // === FAVORITES ===
  const loadFavorites = async () => {
    if (!user?.id) return;
    setLoadingFavorites(true);
    const { data } = await fetchFavorites(user.id);
    setFavoriteIds(data.map(f => f.restaurant_id));
    setLoadingFavorites(false);
  };

  const isFavorite = (restaurantId: string): boolean => favoriteIds.includes(restaurantId);

  const toggleFavorite = async (restaurantId: string) => {
    if (!user?.id) return;
    if (isFavorite(restaurantId)) {
      setFavoriteIds(prev => prev.filter(id => id !== restaurantId));
      await removeFavoriteDb(user.id, restaurantId);
    } else {
      setFavoriteIds(prev => [restaurantId, ...prev]);
      await addFavoriteDb(user.id, restaurantId);
    }
  };

  const favoriteRestaurants = React.useMemo(
    () => restaurants.filter(r => favoriteIds.includes(r.id)),
    [restaurants, favoriteIds]
  );

  const requestLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (err) {
      console.log('Location fetch error:', err);
    }
  };

  const updateProfile = async (updates: Partial<DbUserProfile>) => {
    if (!user?.id) return;
    await updateProfileDb(user.id, updates);
    setUserProfile(prev => prev ? { ...prev, ...updates } : prev);
  };

  const reorder = async (order: DbOrder): Promise<boolean> => {
    if (!order.order_items || order.order_items.length === 0) {
      Alert.alert('Cannot Reorder', 'No items found in this order.');
      return false;
    }

    const restaurantId = order.restaurant_id;
    const restaurantName = order.restaurant_name;

    // Fetch current menu to verify items are still available
    const { data: currentMenu } = await fetchMenuItems(restaurantId);

    const newCart: CartItem[] = [];
    const unavailableItems: string[] = [];

    for (const orderItem of order.order_items) {
      const menuItem = currentMenu.find(m => m.id === orderItem.menu_item_id);
      if (menuItem && menuItem.is_available) {
        newCart.push({
          menuItem,
          quantity: orderItem.quantity,
          restaurantId,
          restaurantName,
        });
      } else {
        unavailableItems.push(orderItem.name);
      }
    }

    if (newCart.length === 0) {
      Alert.alert('Items Unavailable', 'None of the items from this order are currently available.');
      return false;
    }

    if (cart.length > 0 && cart[0].restaurantId !== restaurantId) {
      return new Promise((resolve) => {
        Alert.alert(
          'Replace Cart?',
          'Your cart has items from a different restaurant. Replace with this order?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => {
                setCart(newCart);
                if (unavailableItems.length > 0) {
                  Alert.alert('Some Items Skipped', `These items are no longer available: ${unavailableItems.join(', ')}`);
                }
                resolve(true);
              },
            },
          ]
        );
      });
    }

    setCart(newCart);
    if (unavailableItems.length > 0) {
      Alert.alert('Some Items Skipped', `These items are no longer available: ${unavailableItems.join(', ')}`);
    }
    return true;
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
      updateProfile, reorder,
      userLocation, requestLocation,
      pushToken,
      favoriteIds, isFavorite, toggleFavorite, favoriteRestaurants, loadingFavorites,
    }}>
      {children}
    </AppContext.Provider>
  );
}
