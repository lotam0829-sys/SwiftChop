// SwiftChop Design System — Nigerian Food Delivery
// Brand: Energetic Orange + Dark

export const theme = {
  // Primary palette
  primary: '#FF6B00',
  primaryLight: '#FF8C3A',
  primaryDark: '#E05500',
  primaryFaint: 'rgba(255, 107, 0, 0.08)',
  primaryMuted: 'rgba(255, 107, 0, 0.15)',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F7F7F8',
  backgroundDark: '#1A1A1A',
  backgroundDarker: '#111111',
  surface: '#FFFFFF',
  surfaceDark: '#242424',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textWhite: '#FFFFFF',
  textDark: '#1A1A1A',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Gradients
  gradientPrimary: ['#FF6B00', '#E05500'] as const,
  gradientDark: ['#1A1A1A', '#111111'] as const,
  gradientSuccess: ['#10B981', '#059669'] as const,

  // Shadows
  shadow: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Border radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  // Typography
  typography: {
    heroValue: { fontSize: 48, fontWeight: '700' as const },
    h1: { fontSize: 28, fontWeight: '700' as const },
    h2: { fontSize: 24, fontWeight: '700' as const },
    h3: { fontSize: 20, fontWeight: '600' as const },
    h4: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '400' as const },
    bodyBold: { fontSize: 15, fontWeight: '600' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
    captionBold: { fontSize: 13, fontWeight: '600' as const },
    small: { fontSize: 11, fontWeight: '500' as const },
    price: { fontSize: 18, fontWeight: '700' as const },
    priceLarge: { fontSize: 24, fontWeight: '700' as const },
    button: { fontSize: 16, fontWeight: '600' as const },
    tabLabel: { fontSize: 11, fontWeight: '600' as const },
  },
};

export type Theme = typeof theme;
