import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
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

// Generate hours and minutes arrays
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12
const MINUTES = [0, 30];
const PERIODS = ['AM', 'PM'];

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function to24h(hour12: number, minute: number, period: string): string {
  let h24 = hour12;
  if (period === 'AM') {
    h24 = hour12 === 12 ? 0 : hour12;
  } else {
    h24 = hour12 === 12 ? 12 : hour12 + 12;
  }
  return `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function parse24to12(time24: string): { hour: number; minute: number; period: string } {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const minute = m >= 30 ? 30 : 0;
  return { hour, minute, period };
}

// Wheel picker column component
function WheelColumn({ data, selectedIndex, onSelect, renderLabel, width }: {
  data: any[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  renderLabel: (item: any) => string;
  width: number;
}) {
  const scrollRef = useRef<FlatList>(null);
  const isScrolling = useRef(false);
  const paddedData = [null, ...data, null]; // Padding items for centering

  useEffect(() => {
    // Scroll to selected index on mount
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToOffset({ offset: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    if (clampedIndex !== selectedIndex) {
      onSelect(clampedIndex);
      Haptics.selectionAsync();
    }
    scrollRef.current?.scrollToOffset({ offset: clampedIndex * ITEM_HEIGHT, animated: true });
    isScrolling.current = false;
  }, [data.length, selectedIndex, onSelect]);

  return (
    <View style={[wheelStyles.column, { width }]}>
      {/* Selection highlight */}
      <View style={wheelStyles.selectionHighlight} pointerEvents="none" />
      <FlatList
        ref={scrollRef}
        data={paddedData}
        keyExtractor={(_, i) => i.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        renderItem={({ item, index }) => {
          const dataIndex = index - 1; // Adjust for padding
          const isSelected = dataIndex === selectedIndex;
          const isPlaceholder = item === null;
          return (
            <Pressable
              style={[wheelStyles.item, { height: ITEM_HEIGHT }]}
              onPress={() => {
                if (!isPlaceholder && dataIndex >= 0 && dataIndex < data.length) {
                  onSelect(dataIndex);
                  Haptics.selectionAsync();
                  scrollRef.current?.scrollToOffset({ offset: dataIndex * ITEM_HEIGHT, animated: true });
                }
              }}
            >
              {isPlaceholder ? null : (
                <Text style={[
                  wheelStyles.itemText,
                  isSelected && wheelStyles.itemTextSelected,
                  !isSelected && wheelStyles.itemTextDimmed,
                ]}>
                  {renderLabel(item)}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// Time picker modal with wheel columns
function TimePickerModal({ visible, onClose, initialTime, onConfirm, label }: {
  visible: boolean;
  onClose: () => void;
  initialTime: string;
  onConfirm: (time24: string) => void;
  label: string;
}) {
  const insets = useSafeAreaInsets();
  const parsed = parse24to12(initialTime);
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsed.period);

  useEffect(() => {
    if (visible) {
      const p = parse24to12(initialTime);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
      setSelectedPeriod(p.period);
    }
  }, [visible, initialTime]);

  const hourIndex = HOURS_12.indexOf(selectedHour);
  const minuteIndex = MINUTES.indexOf(selectedMinute);
  const periodIndex = PERIODS.indexOf(selectedPeriod);

  const handleConfirm = () => {
    const time24 = to24h(selectedHour, selectedMinute, selectedPeriod);
    onConfirm(time24);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={wheelStyles.overlay}>
        <View style={[wheelStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={wheelStyles.sheetHandle} />
          <View style={wheelStyles.sheetHeader}>
            <Text style={wheelStyles.sheetLabel}>{label}</Text>
            <Pressable onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#999" />
            </Pressable>
          </View>

          {/* Preview */}
          <View style={wheelStyles.previewRow}>
            <Text style={wheelStyles.previewTime}>
              {selectedHour}:{selectedMinute.toString().padStart(2, '0')} {selectedPeriod}
            </Text>
          </View>

          {/* Wheel pickers */}
          <View style={wheelStyles.wheelsRow}>
            <WheelColumn
              data={HOURS_12}
              selectedIndex={hourIndex >= 0 ? hourIndex : 0}
              onSelect={(i) => setSelectedHour(HOURS_12[i])}
              renderLabel={(item) => item.toString()}
              width={80}
            />
            <Text style={wheelStyles.colonSeparator}>:</Text>
            <WheelColumn
              data={MINUTES}
              selectedIndex={minuteIndex >= 0 ? minuteIndex : 0}
              onSelect={(i) => setSelectedMinute(MINUTES[i])}
              renderLabel={(item) => item.toString().padStart(2, '0')}
              width={80}
            />
            <WheelColumn
              data={PERIODS}
              selectedIndex={periodIndex >= 0 ? periodIndex : 0}
              onSelect={(i) => setSelectedPeriod(PERIODS[i])}
              renderLabel={(item) => item}
              width={80}
            />
          </View>

          <View style={wheelStyles.sheetActions}>
            <Pressable onPress={onClose} style={wheelStyles.cancelBtn}>
              <Text style={wheelStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={wheelStyles.confirmBtn}>
              <MaterialIcons name="check" size={18} color="#FFF" />
              <Text style={wheelStyles.confirmBtnText}>Set Time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RestaurantHoursScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { ownerRestaurant, refreshRestaurantData } = useApp();

  const [hours, setHours] = useState<OperatingHours>(defaultHours);
  const [saving, setSaving] = useState(false);

  // Time picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [pickerField, setPickerField] = useState<'open' | 'close'>('open');

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

  const openTimePicker = (day: string, field: 'open' | 'close') => {
    setPickerDay(day);
    setPickerField(field);
    setPickerVisible(true);
  };

  const handleTimeConfirm = (time24: string) => {
    if (pickerDay) {
      setHours(prev => ({
        ...prev,
        [pickerDay]: { ...prev[pickerDay], [pickerField]: time24 },
      }));
    }
    setPickerVisible(false);
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

  const currentPickerTime = pickerDay && pickerField
    ? (pickerField === 'open' ? hours[pickerDay].open : hours[pickerDay].close)
    : '09:00';

  const pickerLabel = pickerDay
    ? `${DAY_LABELS[pickerDay]} — ${pickerField === 'open' ? 'Opening Time' : 'Closing Time'}`
    : '';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <Text style={styles.infoText}>Set your operating hours for each day. Tap the time to open a clock picker. Customers see when you are open and get notified before closing.</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const allOpen: OperatingHours = {} as any;
              DAYS.forEach(d => { allOpen[d] = { open: '09:00', close: '22:00', is_open: true }; });
              setHours(allOpen);
            }}
            style={styles.quickBtn}
          >
            <MaterialIcons name="select-all" size={16} color="#10B981" />
            <Text style={styles.quickBtnText}>Open All Days</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const h24: OperatingHours = {} as any;
              DAYS.forEach(d => { h24[d] = { open: '00:00', close: '23:30', is_open: true }; });
              setHours(h24);
            }}
            style={styles.quickBtn}
          >
            <MaterialIcons name="all-inclusive" size={16} color="#3B82F6" />
            <Text style={styles.quickBtnText}>24/7 Open</Text>
          </Pressable>
        </View>

        {DAYS.map((day) => {
          const dayData = hours[day];
          return (
            <View key={day} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>{DAY_LABELS[day]}</Text>
                  <Text style={styles.dayStatus}>
                    {dayData.is_open ? `${formatTime12h(dayData.open)} - ${formatTime12h(dayData.close)}` : 'Closed'}
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
                      onPress={() => openTimePicker(day, 'open')}
                      style={styles.timeBtn}
                    >
                      <MaterialIcons name="schedule" size={16} color={theme.primary} />
                      <Text style={styles.timeBtnText}>{formatTime12h(dayData.open)}</Text>
                      <MaterialIcons name="edit" size={14} color="#666" />
                    </Pressable>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color="#666" style={{ marginTop: 20 }} />
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeLabel}>Closes</Text>
                    <Pressable
                      onPress={() => openTimePicker(day, 'close')}
                      style={styles.timeBtn}
                    >
                      <MaterialIcons name="schedule" size={16} color={theme.primary} />
                      <Text style={styles.timeBtnText}>{formatTime12h(dayData.close)}</Text>
                      <MaterialIcons name="edit" size={14} color="#666" />
                    </Pressable>
                  </View>
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

      {/* Clock-style Time Picker Modal */}
      <TimePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        initialTime={currentPickerTime}
        onConfirm={handleTimeConfirm}
        label={pickerLabel}
      />
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A', alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  sheetLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  previewRow: { alignItems: 'center', paddingVertical: 12 },
  previewTime: { fontSize: 36, fontWeight: '700', color: theme.primary, letterSpacing: 1 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ITEM_HEIGHT * VISIBLE_ITEMS, paddingHorizontal: 20 },
  colonSeparator: { fontSize: 28, fontWeight: '700', color: '#FFF', marginHorizontal: 4 },
  column: { height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden', position: 'relative' },
  selectionHighlight: { position: 'absolute', top: ITEM_HEIGHT, left: 4, right: 4, height: ITEM_HEIGHT, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,0,0.3)', zIndex: 0 },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 22, fontWeight: '600', color: '#FFF' },
  itemTextSelected: { fontWeight: '800', color: theme.primary, fontSize: 24 },
  itemTextDimmed: { color: '#555', fontSize: 20 },
  sheetActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#CCC' },
  confirmBtn: { flex: 2, flexDirection: 'row', height: 50, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

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
  timeBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF', flex: 1 },
  quickActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  quickBtnText: { fontSize: 12, fontWeight: '600', color: '#CCC' },
  saveBtn: { backgroundColor: theme.primary, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
