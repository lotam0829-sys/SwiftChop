import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

// ---- Types ----

export interface DbRestaurant {
  id: string;
  owner_id: string | null;
  name: string;
  image_key: string;
  cuisine: string;
  rating: number;
  review_count: number;
  delivery_time: string;
  delivery_fee: number;
  min_order: number;
  address: string;
  is_open: boolean;
  is_featured: boolean;
  description: string;
  created_at: string;
}

export interface DbMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  image_key: string;
  is_available: boolean;
  is_popular: boolean;
  category: string;
  created_at: string;
}

export interface DbOrder {
  id: string;
  order_number: string;
  customer_id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image_key: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  status: string;
  delivery_address: string;
  delivery_note: string | null;
  payment_method: string;
  estimated_delivery: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
  order_items?: DbOrderItem[];
  // Shipday fields
  shipday_order_id?: number | null;
  shipday_tracking_url?: string | null;
  shipday_carrier_name?: string | null;
  shipday_carrier_phone?: string | null;
  shipday_eta?: string | null;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  quantity: number;
  price: number;
}

export interface DbUserProfile {
  id: string;
  email: string;
  username: string | null;
  role: string;
  phone: string | null;
  address: string | null;
  is_approved: boolean;
  restaurant_name: string | null;
  avatar_url: string | null;
}

// ---- Restaurants ----

export async function fetchRestaurants(): Promise<{ data: DbRestaurant[]; error: string | null }> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('rating', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchRestaurantById(id: string): Promise<{ data: DbRestaurant | null; error: string | null }> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---- Menu Items ----

export async function fetchMenuItems(restaurantId: string): Promise<{ data: DbMenuItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('is_popular', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchAllMenuItems(): Promise<{ data: DbMenuItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('is_popular', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function insertMenuItem(item: Omit<DbMenuItem, 'id' | 'created_at'>): Promise<{ data: DbMenuItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert(item)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateMenuItem(id: string, updates: Partial<DbMenuItem>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('menu_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message || null };
}

export async function deleteMenuItemById(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id);
  return { error: error?.message || null };
}

// ---- Orders ----

export async function fetchCustomerOrders(customerId: string): Promise<{ data: DbOrder[]; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function fetchRestaurantOrders(restaurantId: string): Promise<{ data: DbOrder[]; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}

export async function createOrder(order: {
  order_number: string;
  customer_id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image_key: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  status: string;
  delivery_address: string;
  delivery_note?: string;
  payment_method?: string;
  estimated_delivery: string;
  customer_name?: string;
  customer_phone?: string;
}, items: { menu_item_id?: string; name: string; quantity: number; price: number }[]): Promise<{ data: DbOrder | null; error: string | null }> {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();
  if (orderError) return { data: null, error: orderError.message };

  if (items.length > 0 && orderData) {
    const orderItems = items.map(i => ({ ...i, order_id: orderData.id }));
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);
    if (itemsError) return { data: orderData, error: itemsError.message };
  }

  return { data: orderData, error: null };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  return { error: error?.message || null };
}

// ---- Shipday Integration ----

export async function dispatchToShipday(orderId: string): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('create-shipday-order', {
    body: { orderId },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const textContent = await error.context?.text();
        errorMessage = textContent || error.message;
      } catch {
        errorMessage = error.message || 'Failed to dispatch order';
      }
    }
    return { data: null, error: `Shipday: ${errorMessage}` };
  }

  return { data, error: null };
}

export async function fetchOrderById(orderId: string): Promise<{ data: DbOrder | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ---- User Profile ----

export async function fetchUserProfile(userId: string): Promise<{ data: DbUserProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateUserProfile(userId: string, updates: Partial<DbUserProfile>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);
  return { error: error?.message || null };
}

// ---- Restaurant for owner ----

export async function fetchOwnerRestaurant(ownerId: string): Promise<{ data: DbRestaurant | null; error: string | null }> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('owner_id', ownerId)
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function createRestaurantForOwner(ownerId: string, name: string): Promise<{ data: DbRestaurant | null; error: string | null }> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      owner_id: ownerId,
      name,
      cuisine: 'Nigerian',
      description: `Welcome to ${name}`,
      address: 'Lagos, Nigeria',
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function updateRestaurant(id: string, updates: Partial<DbRestaurant>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('restaurants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message || null };
}
