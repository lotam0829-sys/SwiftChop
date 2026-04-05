import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useAlert } from '@/template';
import { useAuth } from '@/template';
import { getImage } from '../../constants/images';
import { DbMenuItem, updateMenuItem } from '../../services/supabaseData';
import { getSupabaseClient } from '@/template';
import PrimaryButton from '../../components/ui/PrimaryButton';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export default function RestaurantMenuScreen() {
  const insets = useSafeAreaInsets();
  const { restaurantMenuItems, addMenuItem, deleteMenuItemAction, toggleMenuItemAvailability, ownerRestaurant, refreshRestaurantData } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('nigerian');
  const [newPopular, setNewPopular] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const categories = ['nigerian', 'rice', 'grilled', 'soups', 'snacks', 'drinks'];

  const filtered = useMemo(() => {
    let items = restaurantMenuItems;
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (activeFilter !== 'all') items = items.filter(i => i.category === activeFilter);
    return items;
  }, [restaurantMenuItems, search, activeFilter]);

  const resetForm = () => {
    setNewName('');
    setNewDesc('');
    setNewPrice('');
    setNewCategory('nigerian');
    setNewPopular(false);
    setSelectedImageUri(null);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Please allow access to your photo library to upload menu images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      showAlert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImageUri || !user?.id) return null;
    setUploadingImage(true);
    try {
      const supabase = getSupabaseClient();
      const fileExt = 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const base64 = await FileSystem.readAsStringAsync(selectedImageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('Image upload error:', err);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice.trim()) {
      showAlert('Missing Info', 'Please enter item name and price');
      return;
    }
    if (!ownerRestaurant) {
      showAlert('Error', 'No restaurant linked to your account');
      return;
    }
    setAddLoading(true);

    let imageKey = 'heroJollof';
    if (selectedImageUri) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        imageKey = uploadedUrl;
      }
    }

    await addMenuItem({
      restaurant_id: ownerRestaurant.id,
      name: newName.trim(),
      description: newDesc.trim(),
      price: parseInt(newPrice) || 0,
      image_key: imageKey,
      is_available: true,
      is_popular: newPopular,
      category: newCategory,
    });
    setAddLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    setShowAddModal(false);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!newName.trim() || !newPrice.trim()) {
      showAlert('Missing Info', 'Please enter item name and price');
      return;
    }
    setAddLoading(true);

    let imageKey = editingItem.image_key;
    if (selectedImageUri) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        imageKey = uploadedUrl;
      }
    }

    await updateMenuItem(editingItem.id, {
      name: newName.trim(),
      description: newDesc.trim(),
      price: parseInt(newPrice) || 0,
      image_key: imageKey,
      is_popular: newPopular,
      category: newCategory,
    } as any);

    await refreshRestaurantData();
    setAddLoading(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    setShowEditModal(false);
    setEditingItem(null);
  };

  const handleDelete = (item: DbMenuItem) => {
    showAlert('Delete Item', `Remove "${item.name}" from menu?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); deleteMenuItemAction(item.id); } },
    ]);
  };

  const handleEdit = (item: DbMenuItem) => {
    setEditingItem(item);
    setNewName(item.name);
    setNewDesc(item.description);
    setNewPrice(item.price.toString());
    setNewCategory(item.category);
    setNewPopular(item.is_popular);
    setSelectedImageUri(null);
    setShowEditModal(true);
  };

  const getItemImage = (imageKey: string) => {
    if (imageKey && imageKey.startsWith('http')) {
      return { uri: imageKey };
    }
    return getImage(imageKey);
  };

  const availableCount = restaurantMenuItems.filter(i => i.is_available).length;
  const unavailableCount = restaurantMenuItems.length - availableCount;

  const renderItem = ({ item }: { item: DbMenuItem }) => (
    <View style={[styles.menuItem, !item.is_available && { opacity: 0.6 }]}>
      <Image source={getItemImage(item.image_key)} style={styles.itemImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {item.is_popular ? <MaterialIcons name="local-fire-department" size={14} color={theme.primary} /> : null}
        </View>
        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text style={styles.itemPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
          <View style={[styles.categoryTag, { backgroundColor: 'rgba(255,107,0,0.1)' }]}>
            <Text style={styles.categoryTagText}>{item.category}</Text>
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <Pressable onPress={() => handleEdit(item)} style={styles.editBtn}>
          <MaterialIcons name="edit" size={18} color="#3B82F6" />
        </Pressable>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); toggleMenuItemAvailability(item.id); }}
          style={[styles.toggleBtn, item.is_available && styles.toggleBtnActive]}
        >
          <MaterialIcons name={item.is_available ? 'visibility' : 'visibility-off'} size={18} color={item.is_available ? '#10B981' : '#999'} />
        </Pressable>
        <Pressable onPress={() => handleDelete(item)} style={styles.deleteBtn}>
          <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );

  const renderFormModal = (visible: boolean, onClose: () => void, title: string, onSubmit: () => void, submitLabel: string) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Pressable onPress={() => { onClose(); resetForm(); }} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color="#FFF" />
              </Pressable>
            </View>

            {/* Image Picker */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Photo</Text>
              <Pressable onPress={handlePickImage} style={styles.imagePickerArea}>
                {selectedImageUri ? (
                  <Image source={{ uri: selectedImageUri }} style={styles.pickedImage} contentFit="cover" />
                ) : editingItem && editingItem.image_key ? (
                  <Image source={getItemImage(editingItem.image_key)} style={styles.pickedImage} contentFit="cover" />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <MaterialIcons name="add-a-photo" size={32} color={theme.primary} />
                    <Text style={styles.imagePickerText}>Tap to add photo</Text>
                  </View>
                )}
                {(selectedImageUri || (editingItem && editingItem.image_key)) ? (
                  <View style={styles.imageOverlayBtn}>
                    <MaterialIcons name="camera-alt" size={18} color="#FFF" />
                  </View>
                ) : null}
              </Pressable>
              {uploadingImage ? <Text style={styles.uploadHint}>Uploading image...</Text> : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Item Name *</Text>
              <TextInput style={styles.formInput} placeholder="e.g. Jollof Rice & Chicken" placeholderTextColor="#666" value={newName} onChangeText={setNewName} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, { minHeight: 80 }]} placeholder="Describe this dish..." placeholderTextColor="#666" value={newDesc} onChangeText={setNewDesc} multiline />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Price ({"\u20A6"}) *</Text>
              <TextInput style={styles.formInput} placeholder="e.g. 3500" placeholderTextColor="#666" value={newPrice} onChangeText={setNewPrice} keyboardType="number-pad" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <Pressable key={cat} onPress={() => { Haptics.selectionAsync(); setNewCategory(cat); }} style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}>
                    <Text style={[styles.categoryChipText, newCategory === cat && { color: '#FFF' }]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Pressable onPress={() => setNewPopular(!newPopular)} style={styles.popularToggle}>
                <View style={[styles.popCheckbox, newPopular && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                  {newPopular ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
                </View>
                <Text style={styles.popularLabel}>Mark as Popular Item</Text>
                <MaterialIcons name="local-fire-department" size={18} color={newPopular ? theme.primary : '#666'} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <PrimaryButton label={addLoading ? (uploadingImage ? 'Uploading image...' : 'Saving...') : submitLabel} onPress={onSubmit} loading={addLoading} variant="primary" />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>{restaurantMenuItems.length} items {"\u00B7"} {availableCount} available {"\u00B7"} {unavailableCount} hidden</Text>
        </View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddModal(true); }} style={styles.addBtnHeader}>
          <MaterialIcons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color="#999" />
        <TextInput style={styles.searchInput} placeholder="Search menu items..." placeholderTextColor="#666" value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 14 }}>
        <Pressable onPress={() => setActiveFilter('all')} style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, activeFilter === 'all' && { color: '#FFF' }]}>All</Text>
        </Pressable>
        {categories.map(cat => (
          <Pressable key={cat} onPress={() => { Haptics.selectionAsync(); setActiveFilter(cat); }} style={[styles.filterChip, activeFilter === cat && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, activeFilter === cat && { color: '#FFF' }]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
          </Pressable>
        ))}
      </ScrollView>

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

      {renderFormModal(showAddModal, () => setShowAddModal(false), 'Add Menu Item', handleAdd, 'Add to Menu')}
      {renderFormModal(showEditModal, () => { setShowEditModal(false); setEditingItem(null); }, 'Edit Menu Item', handleSaveEdit, 'Save Changes')}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 13, color: '#999', marginTop: 4 },
  addBtnHeader: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: '#1A1A1A', paddingHorizontal: 14, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#999' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  itemImage: { width: 64, height: 64, borderRadius: 10 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#FFF', flex: 1 },
  itemDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: theme.primary },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  categoryTagText: { fontSize: 10, fontWeight: '600', color: theme.primary, textTransform: 'capitalize' },
  itemActions: { gap: 6 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  toggleBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 4 },
  modalContainer: { flex: 1, backgroundColor: '#0D0D0D' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  formGroup: { paddingHorizontal: 16, marginBottom: 20 },
  formLabel: { fontSize: 14, fontWeight: '600', color: '#CCC', marginBottom: 8 },
  formInput: { backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  imagePickerArea: { width: '100%', height: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A1A1A', borderWidth: 2, borderStyle: 'dashed', borderColor: '#2A2A2A', position: 'relative' },
  pickedImage: { width: '100%', height: '100%', borderRadius: 12 },
  imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePickerText: { fontSize: 14, color: '#999', fontWeight: '500' },
  imageOverlayBtn: { position: 'absolute', bottom: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  uploadHint: { fontSize: 12, color: theme.primary, marginTop: 6 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#999' },
  popularToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  popCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  popularLabel: { flex: 1, fontSize: 15, color: '#CCC', fontWeight: '500' },
});
