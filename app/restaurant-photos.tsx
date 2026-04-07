import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { getImage } from '../constants/images';
import { getSupabaseClient } from '@/template';
import { updateRestaurant } from '../services/supabaseData';

const MAX_GALLERY = 6;

export default function RestaurantPhotosScreen() {
  const insets = useSafeAreaInsets();
  const { ownerRestaurant, refreshRestaurantData } = useApp();
  const { showAlert } = useAlert();

  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Load existing images from storage
  useEffect(() => {
    loadGallery();
  }, [ownerRestaurant?.id]);

  const loadGallery = async () => {
    if (!ownerRestaurant?.id) return;
    const supabase = getSupabaseClient();

    // Load cover image
    const coverKey = ownerRestaurant.image_key;
    if (coverKey && coverKey.startsWith('http')) {
      setCoverUrl(coverKey);
    }

    // Load gallery from storage
    try {
      const { data: files } = await supabase.storage
        .from('menu-images')
        .list(`gallery-${ownerRestaurant.id}`, { limit: MAX_GALLERY });
      if (files && files.length > 0) {
        const urls = files.map(f => {
          const { data } = supabase.storage.from('menu-images').getPublicUrl(`gallery-${ownerRestaurant.id}/${f.name}`);
          return `${data.publicUrl}?t=${Date.now()}`;
        });
        setGalleryImages(urls);
      }
    } catch (err) {
      console.log('Gallery load error:', err);
    }
  };

  const handleUploadCover = async () => {
    if (!ownerRestaurant?.id) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (result.canceled || !result.assets?.length) return;

      setCoverUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const supabase = getSupabaseClient();
      const uri = result.assets[0].uri;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const arr = await new Response(blob).arrayBuffer();

      const filePath = `cover-${ownerRestaurant.id}/cover.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(filePath, arr, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        showAlert('Upload Failed', 'Could not upload cover image. Please try again.');
        setCoverUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setCoverUrl(publicUrl);

      // Update restaurant record with new image URL
      await updateRestaurant(ownerRestaurant.id, { image_key: publicUrl } as any);
      await refreshRestaurantData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert('Updated', 'Cover image updated successfully');
    } catch (err) {
      console.error('Cover upload error:', err);
      showAlert('Error', 'Failed to upload cover image.');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleUploadGalleryPhoto = async () => {
    if (!ownerRestaurant?.id) return;
    if (galleryImages.length >= MAX_GALLERY) {
      showAlert('Limit Reached', `You can upload up to ${MAX_GALLERY} gallery photos. Delete some to add more.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets?.length) return;

      setGalleryUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const supabase = getSupabaseClient();
      const uri = result.assets[0].uri;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const arr = await new Response(blob).arrayBuffer();

      const fileName = `photo-${Date.now()}.jpg`;
      const filePath = `gallery-${ownerRestaurant.id}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('menu-images')
        .upload(filePath, arr, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        showAlert('Upload Failed', 'Could not upload photo.');
        setGalleryUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setGalleryImages(prev => [...prev, publicUrl]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error('Gallery upload error:', err);
      showAlert('Error', 'Failed to upload photo.');
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeleteGalleryPhoto = (index: number) => {
    showAlert('Delete Photo', 'Remove this photo from your gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Remove from local state
          setGalleryImages(prev => prev.filter((_, i) => i !== index));
          // Note: would need the file path to delete from storage
        },
      },
    ]);
  };

  const displayCover = coverUrl || (ownerRestaurant?.image_key ? (
    ownerRestaurant.image_key.startsWith('http') ? ownerRestaurant.image_key : null
  ) : null);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        {/* Cover Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <Text style={styles.sectionSub}>This is the main image customers see when browsing restaurants. Use a wide, appealing shot.</Text>

          <View style={styles.coverImageWrap}>
            {displayCover ? (
              <Image source={{ uri: displayCover }} style={styles.coverImage} contentFit="cover" transition={200} />
            ) : (
              <Image source={getImage(ownerRestaurant?.image_key || 'heroJollof')} style={styles.coverImage} contentFit="cover" transition={200} />
            )}
            <Pressable onPress={handleUploadCover} disabled={coverUploading} style={styles.changePhotoBtn}>
              {coverUploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="camera-alt" size={20} color="#FFF" />
                  <Text style={styles.changePhotoBtnText}>Change Cover</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={styles.specHint}>Recommended: 16:9 ratio, at least 1200px wide</Text>
        </View>

        {/* Gallery */}
        <View style={styles.section}>
          <View style={styles.galleryHeader}>
            <View>
              <Text style={styles.sectionTitle}>Photo Gallery</Text>
              <Text style={styles.sectionSub}>Add photos of your best dishes, interior, and ambiance.</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{galleryImages.length}/{MAX_GALLERY}</Text>
            </View>
          </View>

          <View style={styles.galleryGrid}>
            {galleryImages.map((url, idx) => (
              <Pressable
                key={idx}
                onLongPress={() => handleDeleteGalleryPhoto(idx)}
                style={styles.galleryItemFilled}
              >
                <Image source={{ uri: url }} style={styles.galleryImage} contentFit="cover" transition={200} />
                <Pressable onPress={() => handleDeleteGalleryPhoto(idx)} style={styles.deleteBtn}>
                  <MaterialIcons name="close" size={14} color="#FFF" />
                </Pressable>
              </Pressable>
            ))}
            {galleryImages.length < MAX_GALLERY ? (
              <Pressable onPress={handleUploadGalleryPhoto} disabled={galleryUploading} style={styles.galleryItem}>
                {galleryUploading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <MaterialIcons name="add-photo-alternate" size={28} color={theme.primary} />
                    <Text style={styles.galleryItemText}>Add Photo</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <MaterialIcons name="lightbulb" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipsTitle}>Photo Tips</Text>
            <Text style={styles.tipsText}>{"\u2022"} Use natural lighting for food photos{"\n"}{"\u2022"} Show the dish from a top-down angle{"\n"}{"\u2022"} Keep backgrounds clean and simple{"\n"}{"\u2022"} Add at least 3 photos of popular dishes{"\n"}{"\u2022"} Include one interior shot for ambiance</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  section: { paddingHorizontal: 16, marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#999', lineHeight: 19, marginBottom: 16 },
  coverImageWrap: { borderRadius: 16, overflow: 'hidden', height: 200, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  changePhotoBtn: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  changePhotoBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  specHint: { fontSize: 11, color: '#666', marginTop: 8, paddingLeft: 4 },
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#999' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', gap: 6 },
  galleryItemText: { fontSize: 11, color: theme.primary, fontWeight: '600' },
  galleryItemFilled: { width: '31%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  galleryImage: { width: '100%', height: '100%' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  tipsCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  tipsText: { fontSize: 13, color: '#999', lineHeight: 22 },
});
