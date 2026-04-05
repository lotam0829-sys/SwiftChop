import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAlert } from '@/template';
import { getImage } from '../constants/images';

export default function RestaurantPhotosScreen() {
  const insets = useSafeAreaInsets();
  const { ownerRestaurant } = useApp();
  const { showAlert } = useAlert();

  const handleUpload = () => {
    Haptics.selectionAsync();
    showAlert('Coming Soon', 'Photo upload will be available in the next update.');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        {/* Cover Image */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <Text style={styles.sectionSub}>This is the main image customers see when browsing restaurants.</Text>

          <View style={styles.coverImageWrap}>
            <Image
              source={getImage(ownerRestaurant?.image_key || 'heroJollof')}
              style={styles.coverImage}
              contentFit="cover"
              transition={200}
            />
            <Pressable onPress={handleUpload} style={styles.changePhotoBtn}>
              <MaterialIcons name="camera-alt" size={20} color="#FFF" />
              <Text style={styles.changePhotoBtnText}>Change Cover</Text>
            </Pressable>
          </View>
        </View>

        {/* Gallery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo Gallery</Text>
          <Text style={styles.sectionSub}>Add photos of your best dishes, restaurant interior, and ambiance. Good photos boost orders.</Text>

          <View style={styles.galleryGrid}>
            {/* Upload placeholder cards */}
            {[1, 2, 3, 4, 5, 6].map((_, idx) => (
              <Pressable key={idx} onPress={handleUpload} style={styles.galleryItem}>
                <MaterialIcons name="add-photo-alternate" size={28} color="#666" />
                <Text style={styles.galleryItemText}>Add Photo</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <MaterialIcons name="lightbulb" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipsTitle}>Photo Tips</Text>
            <Text style={styles.tipsText}>{"\u2022"} Use natural lighting for food photos{"\n"}{"\u2022"} Show the dish from a top-down angle{"\n"}{"\u2022"} Keep backgrounds clean and simple{"\n"}{"\u2022"} Add at least 3 photos of popular dishes</Text>
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
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center', gap: 6 },
  galleryItemText: { fontSize: 11, color: '#666', fontWeight: '600' },
  tipsCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  tipsText: { fontSize: 13, color: '#999', lineHeight: 22 },
});
