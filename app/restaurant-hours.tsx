import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../constants/theme';
import { useAlert } from '@/template';

interface DaySchedule {
  day: string;
  shortDay: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

const defaultSchedule: DaySchedule[] = [
  { day: 'Monday', shortDay: 'Mon', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Tuesday', shortDay: 'Tue', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Wednesday', shortDay: 'Wed', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Thursday', shortDay: 'Thu', isOpen: true, openTime: '08:00', closeTime: '22:00' },
  { day: 'Friday', shortDay: 'Fri', isOpen: true, openTime: '08:00', closeTime: '23:00' },
  { day: 'Saturday', shortDay: 'Sat', isOpen: true, openTime: '09:00', closeTime: '23:00' },
  { day: 'Sunday', shortDay: 'Sun', isOpen: false, openTime: '10:00', closeTime: '20:00' },
];

const timeOptions = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00', '00:00',
];

export default function RestaurantHoursScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [editField, setEditField] = useState<'open' | 'close' | null>(null);

  const toggleDay = (index: number) => {
    Haptics.selectionAsync();
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, isOpen: !d.isOpen } : d));
  };

  const setTime = (index: number, field: 'openTime' | 'closeTime', time: string) => {
    Haptics.selectionAsync();
    setSchedule(prev => prev.map((d, i) => i === index ? { ...d, [field]: time } : d));
    setEditingDay(null);
    setEditField(null);
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert('Saved', 'Operating hours updated successfully');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <Text style={styles.infoText}>Set your operating hours. Customers will only be able to order during these times.</Text>
        </View>

        {schedule.map((day, index) => (
          <View key={day.day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dayName}>{day.day}</Text>
                <Text style={styles.dayStatus}>
                  {day.isOpen ? `${day.openTime} - ${day.closeTime}` : 'Closed'}
                </Text>
              </View>
              <Pressable onPress={() => toggleDay(index)} style={[styles.toggle, day.isOpen && styles.toggleActive]}>
                <View style={[styles.toggleDot, day.isOpen && styles.toggleDotActive]} />
              </Pressable>
            </View>

            {day.isOpen ? (
              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Opens</Text>
                  <Pressable
                    onPress={() => { setEditingDay(index); setEditField('open'); }}
                    style={[styles.timeBtn, editingDay === index && editField === 'open' && styles.timeBtnActive]}
                  >
                    <MaterialIcons name="schedule" size={16} color={theme.primary} />
                    <Text style={styles.timeBtnText}>{day.openTime}</Text>
                  </Pressable>
                </View>
                <MaterialIcons name="arrow-forward" size={16} color="#666" style={{ marginTop: 20 }} />
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Closes</Text>
                  <Pressable
                    onPress={() => { setEditingDay(index); setEditField('close'); }}
                    style={[styles.timeBtn, editingDay === index && editField === 'close' && styles.timeBtnActive]}
                  >
                    <MaterialIcons name="schedule" size={16} color={theme.primary} />
                    <Text style={styles.timeBtnText}>{day.closeTime}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {editingDay === index && editField ? (
              <View style={styles.timePickerRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                  {timeOptions.map((time) => (
                    <Pressable
                      key={time}
                      onPress={() => setTime(index, editField === 'open' ? 'openTime' : 'closeTime', time)}
                      style={[
                        styles.timeOption,
                        (editField === 'open' ? day.openTime : day.closeTime) === time && styles.timeOptionActive,
                      ]}
                    >
                      <Text style={[
                        styles.timeOptionText,
                        (editField === 'open' ? day.openTime : day.closeTime) === time && { color: '#FFF' },
                      ]}>{time}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Hours</Text>
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
