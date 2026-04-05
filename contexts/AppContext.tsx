import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  User, MenuItem, CartItem, Order,
  restaurants as allRestaurants,
  sampleCustomerOrders,
  sampleRestaurantOrders,
} from '../services/mockData';

interface AppContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string, role: 'customer' | 'restaurant') => boolean;
  signup: (data: { name: string; email: string; phone: string; password: string; role: 'customer' | 'restaurant'; restaurantName?: string }) => boolean;
  loginWithGoogle: (role: 'customer' | 'restaurant') => void;
  logout: () => void;
  approveRestaurant: () => void;
  cart: CartItem[];
  addToCart: (item: MenuItem, restaurantId: string, restaurantName: string) => void;
  removeFromCart: (itemId: string) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  customerOrders: Order[];
  placeOrder: (deliveryAddress: string) => Order;
  restaurantOrders: Order[];
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  restaurantMenuItems: MenuItem[];
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  deleteMenuItem: (itemId: string) => void;
  toggleMenuItemAvailability: (itemId: string) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>(sampleCustomerOrders);
  const [restaurantOrders, setRestaurantOrders] = useState<Order[]>(sampleRestaurantOrders);
  const [restaurantMenuItems, setRestaurantMenuItems] = useState<MenuItem[]>([]);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [userData, cartData, ordersData] = await Promise.all([
          AsyncStorage.getItem('swiftchop_user'),
          AsyncStorage.getItem('swiftchop_cart'),
          AsyncStorage.getItem('swiftchop_orders'),
        ]);
        if (userData) {
          const parsed = JSON.parse(userData);
          setUser(parsed);
          setIsAuthenticated(true);
          if (parsed.role === 'restaurant') {
            const menuData = await AsyncStorage.getItem('swiftchop_menu');
            if (menuData) setRestaurantMenuItems(JSON.parse(menuData));
          }
        }
        if (cartData) setCart(JSON.parse(cartData));
        if (ordersData) setCustomerOrders(JSON.parse(ordersData));
      } catch (e) { /* ignore */ }
      setIsLoading(false);
    })();
  }, []);

  // Persist user
  useEffect(() => {
    if (user) AsyncStorage.setItem('swiftchop_user', JSON.stringify(user));
    else AsyncStorage.removeItem('swiftchop_user');
  }, [user]);

  // Persist cart
  useEffect(() => {
    AsyncStorage.setItem('swiftchop_cart', JSON.stringify(cart));
  }, [cart]);

  // Persist orders
  useEffect(() => {
    AsyncStorage.setItem('swiftchop_orders', JSON.stringify(customerOrders));
  }, [customerOrders]);

  // Persist menu
  useEffect(() => {
    AsyncStorage.setItem('swiftchop_menu', JSON.stringify(restaurantMenuItems));
  }, [restaurantMenuItems]);

  const login = (email: string, password: string, role: 'customer' | 'restaurant'): boolean => {
    if (!email || !password) return false;
    const newUser: User = {
      id: `user_${Date.now()}`,
      name: email.split('@')[0].replace(/[^a-zA-Z]/g, ' '),
      email,
      phone: '+234 800 000 0000',
      role,
      address: 'Victoria Island, Lagos',
      isApproved: role === 'customer' ? true : false,
      restaurantName: role === 'restaurant' ? 'My Restaurant' : undefined,
    };
    setUser(newUser);
    setIsAuthenticated(true);
    if (role === 'restaurant') {
      const defaultItems = allRestaurants[0].categories.flatMap(c => c.items);
      setRestaurantMenuItems(defaultItems);
    }
    return true;
  };

  const signup = (data: { name: string; email: string; phone: string; password: string; role: 'customer' | 'restaurant'; restaurantName?: string }): boolean => {
    if (!data.name || !data.email || !data.password) return false;
    const newUser: User = {
      id: `user_${Date.now()}`,
      name: data.name,
      email: data.email,
      phone: data.phone || '+234 800 000 0000',
      role: data.role,
      address: 'Lagos, Nigeria',
      isApproved: data.role === 'customer',
      restaurantName: data.restaurantName,
    };
    setUser(newUser);
    setIsAuthenticated(true);
    if (data.role === 'restaurant') {
      const defaultItems = allRestaurants[0].categories.flatMap(c => c.items);
      setRestaurantMenuItems(defaultItems);
    }
    return true;
  };

  const loginWithGoogle = (role: 'customer' | 'restaurant') => {
    const newUser: User = {
      id: `google_${Date.now()}`,
      name: role === 'customer' ? 'Adaeze Okonkwo' : 'Chef Emeka',
      email: role === 'customer' ? 'adaeze@gmail.com' : 'chef.emeka@gmail.com',
      phone: '+234 812 345 6789',
      role,
      address: 'Lekki, Lagos',
      isApproved: role === 'customer',
      restaurantName: role === 'restaurant' ? "Emeka's Kitchen" : undefined,
    };
    setUser(newUser);
    setIsAuthenticated(true);
    if (role === 'restaurant') {
      const defaultItems = allRestaurants[0].categories.flatMap(c => c.items);
      setRestaurantMenuItems(defaultItems);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setCart([]);
    AsyncStorage.multiRemove(['swiftchop_user', 'swiftchop_cart', 'swiftchop_menu']);
  };

  const approveRestaurant = () => {
    if (user) {
      setUser({ ...user, isApproved: true });
    }
  };

  // Cart
  const addToCart = (item: MenuItem, restaurantId: string, restaurantName: string) => {
    if (cart.length > 0 && cart[0].restaurantId !== restaurantId) {
      Alert.alert(
        'Different Restaurant',
        'Your cart has items from another restaurant. Clear cart and add this item?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            style: 'destructive',
            onPress: () => setCart([{ menuItem: item, quantity: 1, restaurantId, restaurantName }]),
          },
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

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(ci => ci.menuItem.id !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(cart.map(ci => ci.menuItem.id === itemId ? { ...ci, quantity } : ci));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0);
  const cartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  // Orders
  const placeOrder = (deliveryAddress: string): Order => {
    const order: Order = {
      id: `ORD-${Date.now()}`,
      restaurantId: cart[0]?.restaurantId || '1',
      restaurantName: cart[0]?.restaurantName || 'Restaurant',
      restaurantImageKey: 'heroJollof',
      items: cart.map(ci => ({ name: ci.menuItem.name, quantity: ci.quantity, price: ci.menuItem.price })),
      subtotal: cartTotal,
      deliveryFee: 1500,
      serviceFee: 200,
      total: cartTotal + 1500 + 200,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      estimatedDelivery: '25-40 min',
      deliveryAddress,
      customerName: user?.name,
      customerPhone: user?.phone,
    };
    setCustomerOrders(prev => [order, ...prev]);
    setRestaurantOrders(prev => [order, ...prev]);
    setCart([]);
    return order;
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setRestaurantOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    setCustomerOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  // Menu management
  const addMenuItem = (item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = { ...item, id: `menu_${Date.now()}` };
    setRestaurantMenuItems(prev => [newItem, ...prev]);
  };

  const deleteMenuItem = (itemId: string) => {
    setRestaurantMenuItems(prev => prev.filter(i => i.id !== itemId));
  };

  const toggleMenuItemAvailability = (itemId: string) => {
    setRestaurantMenuItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, isAvailable: !i.isAvailable } : i
    ));
  };

  return (
    <AppContext.Provider value={{
      isLoading, isAuthenticated, user,
      login, signup, loginWithGoogle, logout, approveRestaurant,
      cart, addToCart, removeFromCart, updateCartQuantity, clearCart, cartTotal, cartCount,
      customerOrders, placeOrder,
      restaurantOrders, updateOrderStatus,
      restaurantMenuItems, addMenuItem, deleteMenuItem, toggleMenuItemAvailability,
    }}>
      {children}
    </AppContext.Provider>
  );
}
