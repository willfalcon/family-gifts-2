import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';
import { colors } from '@family-gifts/design-tokens';

// The Ledger design system has no dark mode yet (see apps/web/src/styles.css),
// and app.json pins userInterfaceStyle to "light" — so `dark` mirrors `light`
// rather than being a real second palette. Keeping both keys (instead of a
// single theme) matches the shape rn-reusables' components expect.
const palette = {
  background: colors.background,
  foreground: colors.foreground,
  card: colors.card,
  cardForeground: colors['card-foreground'],
  popover: colors.popover,
  popoverForeground: colors['popover-foreground'],
  primary: colors.primary,
  primaryForeground: colors['primary-foreground'],
  secondary: colors.secondary,
  secondaryForeground: colors['secondary-foreground'],
  muted: colors.muted,
  mutedForeground: colors['muted-foreground'],
  accent: colors.accent,
  accentForeground: colors['accent-foreground'],
  destructive: colors.destructive,
  border: colors.border,
  input: colors.input,
  ring: colors.ring,
  radius: '0.75rem',
  chart1: colors['chart-1'],
  chart2: colors['chart-2'],
  chart3: colors['chart-3'],
  chart4: colors['chart-4'],
  chart5: colors['chart-5'],
};

export const THEME = {
  light: palette,
  dark: palette,
};

const fonts: Theme['fonts'] = {
  regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
  medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
  bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
  heavy: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
    fonts,
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
    fonts,
  },
};
