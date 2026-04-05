import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAlert } from '@/template';
import { useApp } from '../contexts/AppContext';
import { updateRestaurant } from '../services/supabaseData';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_LABELS: Record<string, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

interface DayHours {
  open: string;
  close: string;
  is_open: boolean;
}

type OperatingHours = Record<string, DayHours>;

const defaultHours: OperatingHours = {
  sunday: { open: '09:00', close: '22:00', is_open: true },
  monday: { open: '09:00', close: '22:00', is_open: true },
  tuesday: { open: '09:00', close: '22:00', is_open: true },
  wednesday: { open: '09:00', close: '22:00', is_open: true },
  thursday: { open: '09:00', close: '22:00', is_open: true },
  friday: { open: '09:00', close: '23:00', is_open: true },
  saturday: { open: '09:00', close: '23:00', is_open: true },
};

const timeOptions = [
  '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00', '00:00',
];

export default function RestaurantHoursScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { ownerRestaurant, refreshRestaurantData } = useApp();

  const [hours, setHours] = useState<OperatingHours>(defaultHours);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editField, setEditField] = useState<'open' | 'close' | null>(null);
  const [saving, setSaving] = useState(false);

  // Load existing hours from restaurant
  useEffect(() => {
    if (ownerRestaurant) {
      const existing = (ownerRestaurant as any).operating_hours;
      if (existing && typeof existing === 'object') {
        setHours({ ...defaultHours, ...existing });
      }
    }
  }, [ownerRestaurant]);

  const toggleDay = (day: string) => {
    Haptics.selectionAsync();
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], is_open: !prev[day].is_open },
    }));
  };

  const setTime = (day: string, field: 'open' | 'close', time: string) => {
    Haptics.selectionAsync();
    setHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: time },
    }));
    setEditingDay(null);
    setEditField(null);
  };

  const handleSave = async () => {
    if (!ownerRestaurant) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await updateRestaurant(ownerRestaurant.id, { operating_hours: hours } as any);
    setSaving(false);
    if (error) {
      showAlert('Error', 'Failed to save operating hours. Please try again.');
    } else {
      await refreshRestaurantData();
      showAlert('Saved', 'Operating hours updated successfully');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <Text style={styles.infoText}>Set your operating hours for each day. Customers will see when you are open and will be notified when you are about to close.</Text>
        </View>

        {DAYS.map((day) => {
          const dayData = hours[day];
          const isEditing = editingDay === day;
          return (
            <View key={day} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                  <Text style={styles.dayStatus}>
                    {dayData.is_open ? `${dayData.open} - ${dayData.close}` : 'Closed'}
                  </Text>
                </View>
                <Pressable onPress={() => toggleDay(day)} style={[styles.toggle, dayData.is_open && styles.toggleActive]}>
                  <View style={[styles.toggleDot, dayData.is_open && styles.toggleDotActive]} />
                </Pressable>
              </View>

              {dayData.is_open ? (
                <View style={styles.timeRow}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Opens</Text>
                    <Pressable
                      onPress={() => { setEditingDay(day); setEditField('open'); }}
                      style={[styles.timeBtn, isEditing && editField === 'open' && styles.timeBtnActive]}
                    >
                      <MaterialIcons name="schedule" size={16} color={theme.primary} />
                      <Text style={styles.timeBtnText}>{dayData.open}</Text>
                    </Pressable>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color="#666" style={{ marginTop: 20 }} />
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Closes</Text>
                    <Pressable
                      onPress={() => { setEditingDay(day); setEditField('close'); }}
                      style={[styles.timeBtn, isEditing && editField === 'close' && styles.timeBtnActive]}
                    >
                      <MaterialIcons name="schedule" size={16} color={theme.primary} />
                      <Text style={styles.timeBtnText}>{dayData.close}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {isEditing && editField ? (
                <View style={styles.timePickerRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                    {timeOptions.map((time) => {
                      const currentVal = editField === 'open' ? dayData.open : dayData.close;
                      return (
                        <Pressable
                          key={time}
                          onPress={() => setTime(day, editField, time)}
                          style={[styles.timeOption, currentVal === time && styles.timeOptionActive]}
                        >
                          <Text style={[styles.timeOptionText, currentVal === time && { color: '#FFF' }]}>{time}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Pressable onPress={handleSave} style={styles.saveBtn} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Hours</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,107,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)', marginBottom: 20 },
  infoText: { flex: 1, fontSize: 14, color: '#CCC', lineHeight: 20 },
  dayCard: { marginHorizontal: 16, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  dayHeader: { flexDirection: 'row', alignItems: 'center' },
  dayName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  dayStatus: { fontSize: 13, color: '#999', marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#2A2A2A', justifyContent: 'center', paddingHorizontal: 3 },
  toggleActive: { backgroundColor: theme.primary },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#666' },
  toggleDotActive: { backgroundColor: '#FFF', alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  timeBlock: { flex: 1 },
  timeLabel: { fontSize: 11, fontWeight: '600', color: '#999', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2A2A2A' },
  timeBtnActive: { borderWidth: 1, borderColor: theme.primary },
  timeBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  timePickerRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  timeOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2A2A2A' },
  timeOptionActive: { backgroundColor: theme.primary },
  timeOptionText: { fontSize: 14, fontWeight: '600', color: '#CCC' },
  saveBtn: { backgroundColor: theme.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
