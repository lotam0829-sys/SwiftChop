import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { getImage } from '../../constants/images';
import { MenuItem } from '../../services/mockData';
import PrimaryButton from '../../components/ui/PrimaryButton';

export default function RestaurantMenuScreen() {
  const insets = useSafeAreaInsets();
  const { restaurantMenuItems, addMenuItem, deleteMenuItem, toggleMenuItemAvailability } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  // Add form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('nigerian');

  const filtered = search
    ? restaurantMenuItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : restaurantMenuItems;

  const handleAdd = () => {
    if (!newName.trim() || !newPrice.trim()) {
      Alert.alert('Missing Info', 'Please enter item name and price');
      return;
    }
    addMenuItem({
      name: newName,
      description: newDesc,
      price: parseInt(newPrice) || 0,
      imageKey: 'heroJollof',
      isAvailable: true,
      isPopular: false,
      category: newCategory,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewName(''); setNewDesc(''); setNewPrice(''); setNewCategory('nigerian');
    setShowAddModal(false);
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert('Delete Item', `Remove "${item.name}" from menu?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); deleteMenuItem(item.id); } },
    ]);
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View style={[styles.menuItem, !item.isAvailable && { opacity: 0.6 }]}>
      <Image source={getImage(item.imageKey)} style={styles.itemImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.itemPrice}>₦{item.price.toLocaleString()}</Text>
      </View>
      <View style={styles.itemActions}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); toggleMenuItemAvailability(item.id); }}
          style={[styles.toggleBtn, item.isAvailable && styles.toggleBtnActive]}
        >
          <MaterialIcons name={item.isAvailable ? 'visibility' : 'visibility-off'} size={18} color={item.isAvailable ? '#10B981' : '#999'} />
        </Pressable>
        <Pressable onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );

  const categories = ['nigerian', 'rice', 'grilled', 'soups', 'snacks', 'drinks'];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>{restaurantMenuItems.length} items · {restaurantMenuItems.filter(i => i.isAvailable).length} available</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddModal(true); }}
          style={styles.addBtn}
        >
          <MaterialIcons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu items..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        estimatedItemSize={88}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="restaurant-menu" size={48} color="#555" />
            <Text style={styles.emptyTitle}>No menu items</Text>
            <Text style={styles.emptySubtitle}>Tap + to add your first dish</Text>
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Menu Item</Text>
                <Pressable onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                  <MaterialIcons name="close" size={22} color="#FFF" />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Item Name</Text>
                <TextInput style={styles.formInput} placeholder="e.g. Jollof Rice & Chicken" placeholderTextColor="#666" value={newName} onChangeText={setNewName} />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput style={[styles.formInput, { minHeight: 80 }]} placeholder="Describe this dish..." placeholderTextColor="#666" value={newDesc} onChangeText={setNewDesc} multiline />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Price (₦)</Text>
                <TextInput style={styles.formInput} placeholder="e.g. 3500" placeholderTextColor="#666" value={newPrice} onChangeText={setNewPrice} keyboardType="number-pad" />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.categoryGrid}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => { Haptics.selectionAsync(); setNewCategory(cat); }}
                      style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                    >
                      <Text style={[styles.categoryChipText, newCategory === cat && { color: '#FFF' }]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                <PrimaryButton label="Add to Menu" onPress={handleAdd} variant="primary" />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: '#1A1A1A', paddingHorizontal: 14, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  itemImage: { width: 64, height: 64, borderRadius: 10 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  itemDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: theme.primary, marginTop: 4 },
  itemActions: { gap: 8 },
  toggleBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 4 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0D0D0D' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  formGroup: { paddingHorizontal: 16, marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  formInput: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#999' },
});
