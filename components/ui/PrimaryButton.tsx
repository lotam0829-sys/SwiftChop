import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'dark' | 'danger' | 'google';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

export default function PrimaryButton({
  label, onPress, variant = 'primary', loading, disabled, icon, style, size = 'lg',
}: Props) {
  const heights = { sm: 40, md: 48, lg: 56 };
  const fontSizes = { sm: 14, md: 15, lg: 16 };

  const bgColors: Record<string, string> = {
    primary: theme.primary,
    secondary: theme.backgroundSecondary,
    outline: 'transparent',
    dark: theme.backgroundDark,
    danger: theme.error,
    google: '#FFFFFF',
  };
  const textColors: Record<string, string> = {
    primary: '#FFFFFF',
    secondary: theme.textPrimary,
    outline: theme.primary,
    dark: '#FFFFFF',
    danger: '#FFFFFF',
    google: '#333333',
  };

  const handlePress = () => {
    if (loading || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          height: heights[size],
          backgroundColor: bgColors[variant],
          borderWidth: variant === 'outline' || variant === 'google' ? 1.5 : 0,
          borderColor: variant === 'outline' ? theme.primary : variant === 'google' ? '#E5E7EB' : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: textColors[variant], fontSize: fontSizes[size], marginLeft: icon ? 8 : 0 }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    fontWeight: '600',
  },
});
