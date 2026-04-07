import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text } from 'react-native';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

function getActiveOrderStatus(orders: any[]): string | null {
  // Find the most recent active order status
  const activeOrder = orders.find(o => !['delivered', 'cancelled'].includes(o.status));
  return activeOrder?.status || null;
}

function getOrderStatusIcon(status: string | null): string {
  switch (status) {
    case 'pending': return 'hourglass-top';
    case 'confirmed': return 'search';
    case 'preparing': return 'restaurant';
    case 'on_the_way': return 'delivery-dining';
    default: return 'receipt-long';
  }
}

export default function CustomerTabLayout() {
  const insets = useSafeAreaInsets();
  const { cartCount, customerOrders } = useApp();
  const activeStatus = getActiveOrderStatus(customerOrders);
  const activeOrderCount = customerOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color, size }) => <MaterialIcons name="search" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => (
        <View>
          <MaterialIcons name={getOrderStatusIcon(activeStatus)} size={size} color={activeStatus ? theme.primary : color} />
          {activeOrderCount > 0 ? (
            <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: theme.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>{activeOrderCount}</Text>
            </View>
          ) : null}
        </View>
      ) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <MaterialIcons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
