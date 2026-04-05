import React, { useState, useMemo, useEffect } from 'react';
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
import { isBogoActive, formatBogoDuration, getBogoTimeRemaining, BOGO_DURATION_PRESETS, formatNigerianDateTime, NIGERIA_TIMEZONE } from '../../constants/timeUtils';

const DEFAULT_CATEGORIES = ['nigerian', 'rice', 'grilled', 'soups', 'snacks', 'drinks'];

export default function RestaurantMenuScreen() {
  const insets = useSafeAreaInsets();
  const { restaurantMenuItems, addMenuItem, deleteMenuItemAction, toggleMenuItemAvailability, ownerRestaurant, refreshRestaurantData } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingItem, setEditingItem] = useState<DbMenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPopular, setNewPopular] = useState(false);
  const [newBogo, setNewBogo] = useState(false);
  const [bogoStart, setBogoStart] = useState<Date | null>(null);
  const [bogoEnd, setBogoEnd] = useState<Date | null>(null);
  const [selectedBogoPreset, setSelectedBogoPreset] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Custom categories
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCatName, setNewCatName] = useState('');

  // Load custom categories from restaurant
  useEffect(() => {
    if (ownerRestaurant) {
      const custom = (ownerRestaurant as any).custom_categories;
      if (custom && Array.isArray(custom) && custom.length > 0) {
        setCategories(custom);
      }
    }
  }, [ownerRestaurant]);

  // Also include categories from existing menu items
  const allCategories = useMemo(() => {
    const fromItems = restaurantMenuItems.map(i => i.category).filter(Boolean);
    const merged = [...new Set([...categories, ...fromItems])];
    return merged;
  }, [categories, restaurantMenuItems]);

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
    setNewCategory(allCategories[0] || 'nigerian');
    setNewPopular(false);
    setNewBogo(false);
    setBogoStart(null);
    setBogoEnd(null);
    setSelectedBogoPreset(null);
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

  const saveCategories = async (cats: string[]) => {
    setCategories(cats);
    if (ownerRestaurant) {
      const supabase = getSupabaseClient();
      await supabase.from('restaurants').update({ custom_categories: cats, updated_at: new Date().toISOString() }).eq('id', ownerRestaurant.id);
    }
  };

  const handleAddCategory = () => {
    const name = newCatName.trim().toLowerCase();
    if (!name) return;
    if (allCategories.includes(name)) {
      showAlert('Exists', 'This category already exists.');
      return;
    }
    const updated = [...categories, name];
    saveCategories(updated);
    setNewCatName('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRemoveCategory = (cat: string) => {
    const itemsInCat = restaurantMenuItems.filter(i => i.category === cat).length;
    if (itemsInCat > 0) {
      showAlert('Cannot Remove', `This category has ${itemsInCat} items. Remove or re-categorize them first.`);
      return;
    }
    const updated = categories.filter(c => c !== cat);
    saveCategories(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      is_bogo: newBogo && bogoEnd !== null,
      bogo_start: newBogo && bogoStart ? bogoStart.toISOString() : null,
      bogo_end: newBogo && bogoEnd ? bogoEnd.toISOString() : null,
      category: newCategory || allCategories[0] || 'nigerian',
    } as any);
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
      is_bogo: newBogo && bogoEnd !== null,
      bogo_start: newBogo && bogoStart ? bogoStart.toISOString() : null,
      bogo_end: newBogo && bogoEnd ? bogoEnd.toISOString() : null,
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
    setNewBogo((item as any).is_bogo || false);
    // Restore BOGO dates if they exist
    const itemBogoStart = (item as any).bogo_start;
    const itemBogoEnd = (item as any).bogo_end;
    setBogoStart(itemBogoStart ? new Date(itemBogoStart) : null);
    setBogoEnd(itemBogoEnd ? new Date(itemBogoEnd) : null);
    setSelectedBogoPreset(null);
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

  const renderItem = ({ item }: { item: DbMenuItem }) => {
    const itemBogoActive = (item as any).is_bogo && isBogoActive((item as any).bogo_start, (item as any).bogo_end);
    const bogoRemaining = (item as any).is_bogo ? getBogoTimeRemaining((item as any).bogo_end) : null;
    const bogoExpired = (item as any).is_bogo && (item as any).bogo_end && !isBogoActive((item as any).bogo_start, (item as any).bogo_end);

    return (
      <View style={[styles.menuItem, !item.is_available && { opacity: 0.6 }]}>
        <Image source={getItemImage(item.image_key)} style={styles.itemImage} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            {item.is_popular ? <MaterialIcons name="local-fire-department" size={14} color={theme.primary} /> : null}
            {(item as any).is_bogo ? (
              <View style={[styles.bogoTag, bogoExpired && { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.bogoTagText, bogoExpired && { color: '#EF4444' }]}>{bogoExpired ? 'BOGO Expired' : 'BOGO'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={styles.itemPrice}>{"\u20A6"}{item.price.toLocaleString()}</Text>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{item.category}</Text>
            </View>
          </View>
          {itemBogoActive && bogoRemaining ? (
            <Text style={styles.bogoRemainingText}>{bogoRemaining}</Text>
          ) : null}
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
  };

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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allCategories.map((cat) => (
                  <Pressable key={cat} onPress={() => { Haptics.selectionAsync(); setNewCategory(cat); }} style={[styles.categoryPill, newCategory === cat && styles.categoryPillActive]}>
                    <Text style={[styles.categoryPillText, newCategory === cat && { color: '#FFF' }]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
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
            <View style={styles.formGroup}>
              <Pressable onPress={() => setNewBogo(!newBogo)} style={styles.popularToggle}>
                <View style={[styles.popCheckbox, newBogo && { backgroundColor: '#E65100', borderColor: '#E65100' }]}>
                  {newBogo ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
                </View>
                <Text style={styles.popularLabel}>Buy One Get One Free (BOGO)</Text>
                <MaterialIcons name="local-offer" size={18} color={newBogo ? '#E65100' : '#666'} />
              </Pressable>
              {newBogo ? (
                <View style={styles.bogoDurationSection}>
                  <Text style={styles.bogoDurationTitle}>Offer Duration *</Text>
                  <Text style={styles.bogoDurationHint}>Set how long this BOGO offer runs. It will automatically expire when the time is up.</Text>
                  <View style={styles.bogoPresetsRow}>
                    {BOGO_DURATION_PRESETS.map((preset) => {
                      const isSelected = selectedBogoPreset === preset.label;
                      return (
                        <Pressable
                          key={preset.label}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedBogoPreset(preset.label);
                            const now = new Date();
                            setBogoStart(now);
                            setBogoEnd(preset.getEnd());
                          }}
                          style={[styles.bogoPreset, isSelected && styles.bogoPresetActive]}
                        >
                          <Text style={[styles.bogoPresetText, isSelected && { color: '#FFF' }]}>{preset.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {bogoEnd ? (
                    <View style={styles.bogoDurationInfo}>
                      <MaterialIcons name="schedule" size={16} color="#E65100" />
                      <Text style={styles.bogoDurationInfoText}>
                        {formatBogoDuration(
                          bogoStart?.toISOString() || null,
                          bogoEnd?.toISOString() || null
                        )}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.bogoDurationWarning}>
                      <MaterialIcons name="warning" size={16} color="#F59E0B" />
                      <Text style={styles.bogoDurationWarningText}>Please select a duration for your BOGO offer</Text>
                    </View>
                  )}
                </View>
              ) : null}
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

      {/* Category filter pills */}
      <View style={{ marginBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
          <Pressable onPress={() => setActiveFilter('all')} style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}>
            <Text style={[styles.filterPillText, activeFilter === 'all' && { color: '#FFF' }]}>All</Text>
          </Pressable>
          {allCategories.map(cat => (
            <Pressable key={cat} onPress={() => { Haptics.selectionAsync(); setActiveFilter(cat); }} style={[styles.filterPill, activeFilter === cat && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, activeFilter === cat && { color: '#FFF' }]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => { Haptics.selectionAsync(); setShowCategoryManager(true); }} style={styles.managePill}>
            <MaterialIcons name="tune" size={16} color={theme.primary} />
            <Text style={styles.managePillText}>Manage</Text>
          </Pressable>
        </ScrollView>
      </View>

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

      {/* Category Manager Modal */}
      <Modal visible={showCategoryManager} animationType="slide" transparent>
        <View style={styles.catModalOverlay}>
          <View style={[styles.catModalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.catModalHeader}>
              <Text style={styles.catModalTitle}>Manage Categories</Text>
              <Pressable onPress={() => setShowCategoryManager(false)}>
                <MaterialIcons name="close" size={24} color="#FFF" />
              </Pressable>
            </View>

            <Text style={styles.catModalSub}>Create custom categories for your menu items. Categories help customers find dishes faster.</Text>

            {/* Add new category */}
            <View style={styles.addCatRow}>
              <TextInput
                style={styles.addCatInput}
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="New category name"
                placeholderTextColor="#666"
                autoCapitalize="words"
              />
              <Pressable onPress={handleAddCategory} style={styles.addCatBtn}>
                <MaterialIcons name="add" size={20} color="#FFF" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {allCategories.map((cat) => {
                const count = restaurantMenuItems.filter(i => i.category === cat).length;
                return (
                  <View key={cat} style={styles.catRow}>
                    <View style={styles.catPillPreview}>
                      <Text style={styles.catPillPreviewText}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                    </View>
                    <Text style={styles.catCount}>{count} item{count !== 1 ? 's' : ''}</Text>
                    <Pressable onPress={() => handleRemoveCategory(cat)} style={styles.catRemoveBtn}>
                      <MaterialIcons name="close" size={16} color={count > 0 ? '#555' : '#EF4444'} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
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
  addBtnHeader: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, height: 46, borderRadius: 12, backgroundColor: '#1A1A1A', paddingHorizontal: 14, gap: 10, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A' },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },

  // Category filter pills
  filterPill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  filterPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: '#999' },
  managePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,107,0,0.4)', backgroundColor: 'rgba(255,107,0,0.08)' },
  managePillText: { fontSize: 13, fontWeight: '600', color: theme.primary },

  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  itemImage: { width: 64, height: 64, borderRadius: 10 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#FFF', flex: 1 },
  itemDesc: { fontSize: 12, color: '#999', marginTop: 2 },
  itemPrice: { fontSize: 15, fontWeight: '700', color: theme.primary },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(255,107,0,0.1)' },
  categoryTagText: { fontSize: 10, fontWeight: '600', color: theme.primary, textTransform: 'capitalize' },
  bogoTag: { backgroundColor: '#FFF3E0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bogoTagText: { fontSize: 9, fontWeight: '800', color: '#E65100' },
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

  // Category pills in form
  categoryPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  categoryPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: '#999' },

  popularToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  popCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  popularLabel: { flex: 1, fontSize: 15, color: '#CCC', fontWeight: '500' },

  // Category manager modal
  catModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  catModalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingHorizontal: 20 },
  catModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catModalTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  catModalSub: { fontSize: 13, color: '#999', lineHeight: 19, marginBottom: 20 },
  addCatRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  addCatInput: { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#FFF', borderWidth: 1, borderColor: '#2A2A2A' },
  addCatBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  catPillPreview: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,107,0,0.12)' },
  catPillPreviewText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  catCount: { flex: 1, fontSize: 13, color: '#999' },
  catRemoveBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  // BOGO duration
  bogoDurationSection: { marginTop: 10, marginLeft: 36, gap: 10 },
  bogoDurationTitle: { fontSize: 14, fontWeight: '700', color: '#CCC' },
  bogoDurationHint: { fontSize: 12, color: '#999', lineHeight: 17 },
  bogoPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bogoPreset: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#3A3A3A' },
  bogoPresetActive: { backgroundColor: '#E65100', borderColor: '#E65100' },
  bogoPresetText: { fontSize: 13, fontWeight: '600', color: '#CCC' },
  bogoDurationInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(230,81,0,0.1)', borderWidth: 1, borderColor: 'rgba(230,81,0,0.25)' },
  bogoDurationInfoText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#E65100' },
  bogoDurationWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  bogoDurationWarningText: { flex: 1, fontSize: 12, fontWeight: '500', color: '#F59E0B' },
  bogoRemainingText: { fontSize: 11, fontWeight: '600', color: '#E65100', marginTop: 4 },
});
