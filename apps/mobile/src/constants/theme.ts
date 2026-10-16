import '../global.css';

import { Platform } from 'react-native';
import { colors } from '@family-gifts/design-tokens';

// For native chrome that can't take Tailwind classes directly (NativeTabs props).
export const TabColors = {
  background: colors.background,
  backgroundElement: colors.secondary,
  text: colors.foreground,
  textSecondary: colors['muted-foreground'],
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
