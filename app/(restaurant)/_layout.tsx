import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text } from 'react-native';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

export default function RestaurantTabLayout() {
  const insets = useSafeAreaInsets();
  const { restaurantOrders } = useApp();
  const pendingCount = restaurantOrders.filter(o => o.status === 'pending').length;
  const activeCount = restaurantOrders.filter(o => ['confirmed', 'preparing'].includes(o.status)).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
          backgroundColor: theme.backgroundDark,
          borderTopWidth: 1,
          borderTopColor: '#2A2A2A',
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <View>
              <MaterialIcons name="receipt-long" size={size} color={color} />
              {pendingCount > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>{pendingCount}</Text>
                </View>
              ) : activeCount > 0 ? (
                <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: theme.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFF' }}>{activeCount}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="restaurant-menu" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
