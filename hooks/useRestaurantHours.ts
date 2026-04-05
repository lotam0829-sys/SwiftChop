import { useMemo } from 'react';
import { formatTime12h, NIGERIA_TIMEZONE } from '../constants/timeUtils';

export interface DayHours {
  open: string;
  close: string;
  is_open: boolean;
}

export type OperatingHours = Record<string, DayHours>;

const DAYS_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS: Record<string, string> = {
  sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};

const defaultHours: OperatingHours = {
  sunday: { open: '09:00', close: '22:00', is_open: true },
  monday: { open: '09:00', close: '22:00', is_open: true },
  tuesday: { open: '09:00', close: '22:00', is_open: true },
  wednesday: { open: '09:00', close: '22:00', is_open: true },
  thursday: { open: '09:00', close: '22:00', is_open: true },
  friday: { open: '09:00', close: '23:00', is_open: true },
  saturday: { open: '09:00', close: '23:00', is_open: true },
};

/**
 * Parse time string "HH:MM" into minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Hook that computes restaurant open/close status, closing-soon badge, and formatted hours.
 */
export function useRestaurantHours(operatingHours: any) {
  return useMemo(() => {
    const hours: OperatingHours = operatingHours && typeof operatingHours === 'object'
      ? { ...defaultHours, ...operatingHours }
      : defaultHours;

    const now = new Date();
    const dayIndex = now.getDay(); // 0 = Sunday
    const todayKey = DAYS_ORDER[dayIndex];
    const todayHours = hours[todayKey];

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let isCurrentlyOpen = false;
    let minutesUntilClose: number | null = null;
    let closingSoon = false;
    let closingSoonLabel: string | null = null;

    if (todayHours && todayHours.is_open) {
      const openMin = parseTimeToMinutes(todayHours.open);
      const closeMin = parseTimeToMinutes(todayHours.close);

      if (closeMin > openMin) {
        // Normal hours (e.g. 09:00 - 22:00)
        isCurrentlyOpen = currentMinutes >= openMin && currentMinutes < closeMin;
        if (isCurrentlyOpen) {
          minutesUntilClose = closeMin - currentMinutes;
        }
      } else if (closeMin < openMin) {
        // Overnight hours (e.g. 18:00 - 02:00 → close = next day)
        isCurrentlyOpen = currentMinutes >= openMin || currentMinutes < closeMin;
        if (isCurrentlyOpen) {
          if (currentMinutes >= openMin) {
            minutesUntilClose = (24 * 60 - currentMinutes) + closeMin;
          } else {
            minutesUntilClose = closeMin - currentMinutes;
          }
        }
      } else {
        // open == close → 24h
        isCurrentlyOpen = true;
        minutesUntilClose = null;
      }

      if (minutesUntilClose !== null && minutesUntilClose <= 30 && minutesUntilClose > 0) {
        closingSoon = true;
        closingSoonLabel = `Closes in ${minutesUntilClose} min`;
      }
    }

    // Format hours list for display — 12-hour AM/PM format
    const formattedHours = DAYS_ORDER.map(day => {
      const openRaw = hours[day]?.open ?? '09:00';
      const closeRaw = hours[day]?.close ?? '22:00';
      return {
        day,
        label: DAY_LABELS[day],
        isOpen: hours[day]?.is_open ?? true,
        open: formatTime12h(openRaw),
        close: formatTime12h(closeRaw),
        openRaw,
        closeRaw,
        isToday: day === todayKey,
      };
    });

    return {
      isCurrentlyOpen,
      closingSoon,
      closingSoonLabel,
      minutesUntilClose,
      todayHours,
      todayKey,
      formattedHours,
      hours,
    };
  }, [operatingHours]);
}
