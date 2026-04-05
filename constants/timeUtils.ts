// SwiftChop Time Utilities — Nigerian Time (WAT / Africa/Lagos)
// All times displayed in 12-hour AM/PM format using Nigerian timezone

export const NIGERIA_TIMEZONE = 'Africa/Lagos';

/**
 * Format a 24h time string "HH:MM" to 12-hour AM/PM format.
 * e.g. "09:00" → "9:00 AM", "14:30" → "2:30 PM", "00:00" → "12:00 AM"
 */
export function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format a Date object to a time string in Nigerian timezone (12h AM/PM).
 */
export function formatNigerianTime(date: Date): string {
  return date.toLocaleTimeString('en-NG', {
    timeZone: NIGERIA_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a Date to a date string in Nigerian timezone.
 */
export function formatNigerianDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-NG', {
    timeZone: NIGERIA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format a Date to a full date+time string in Nigerian timezone (12h AM/PM).
 */
export function formatNigerianDateTime(date: Date): string {
  return date.toLocaleString('en-NG', {
    timeZone: NIGERIA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get current Nigerian time as a Date (note: Date objects don't store timezone,
 * but this returns the actual current moment which can be formatted with Nigerian TZ).
 */
export function getNigerianNow(): Date {
  return new Date();
}

/**
 * Check if a BOGO offer is currently active.
 * If no start/end is set, the offer is NOT active (must have duration).
 * Uses Nigerian timezone for comparison.
 */
export function isBogoActive(bogoStart: string | null | undefined, bogoEnd: string | null | undefined): boolean {
  if (!bogoStart || !bogoEnd) return false;

  const now = new Date();
  const start = new Date(bogoStart);
  const end = new Date(bogoEnd);

  return now >= start && now <= end;
}

/**
 * Get a human-readable label for BOGO duration remaining.
 * e.g. "Ends in 2 days", "Ends tonight", "Ends in 3 hours"
 */
export function getBogoTimeRemaining(bogoEnd: string | null | undefined): string | null {
  if (!bogoEnd) return null;

  const now = new Date();
  const end = new Date(bogoEnd);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 1) return `Ends in ${diffDays} days`;
  if (diffDays === 1) return 'Ends tomorrow';
  if (diffHours > 1) return `Ends in ${diffHours} hours`;
  if (diffHours === 1) return 'Ends in 1 hour';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins > 0) return `Ends in ${diffMins} min`;
  return 'Ending now';
}

/**
 * Format a BOGO duration for display.
 * e.g. "Apr 5, 9:00 PM — Apr 7, 11:00 PM"
 */
export function formatBogoDuration(bogoStart: string | null | undefined, bogoEnd: string | null | undefined): string {
  if (!bogoStart || !bogoEnd) return 'No duration set';

  const start = new Date(bogoStart);
  const end = new Date(bogoEnd);

  const startStr = start.toLocaleString('en-NG', {
    timeZone: NIGERIA_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const endStr = end.toLocaleString('en-NG', {
    timeZone: NIGERIA_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${startStr} — ${endStr}`;
}

/**
 * BOGO duration presets for restaurants to quickly choose from.
 */
export const BOGO_DURATION_PRESETS = [
  { label: 'Tonight Only', getEnd: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d; } },
  { label: '24 Hours', getEnd: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  { label: '3 Days', getEnd: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
  { label: '1 Week', getEnd: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  { label: '2 Weeks', getEnd: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  { label: '1 Month', getEnd: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
];
