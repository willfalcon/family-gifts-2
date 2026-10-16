/**
 * Ledger design system — canonical token values.
 *
 * Source of truth for apps/mobile/tailwind.config.js (required directly).
 * apps/web/src/styles.css defines the same values as CSS custom properties
 * (Tailwind 4's @theme can't import JS) — if you change a value here,
 * update it there too, and vice versa.
 */

const colors = {
  ink: '#1b2340',
  paper: '#f7f4ec',
  accent: '#b5432e',
  'accent-foreground': '#f7f4ec',
  amber: '#c9973b',
  slate: '#a6adbe',
  good: '#2e7d5b',
  line: '#e3dfd2',
  'muted-dot': '#d8d3c2',

  background: '#f7f4ec',
  foreground: '#1b2340',

  card: '#fbf9f2',
  'card-foreground': '#1b2340',

  popover: '#fbf9f2',
  'popover-foreground': '#1b2340',

  primary: '#1b2340',
  'primary-foreground': '#f7f4ec',

  secondary: '#efe9da',
  'secondary-foreground': '#1b2340',

  muted: '#efe9da',
  'muted-foreground': '#8b8f98',

  destructive: '#b5432e',
  'destructive-foreground': '#f7f4ec',

  border: '#e3dfd2',
  input: '#e3dfd2',
  ring: '#c9973b',

  'chart-1': '#b5432e',
  'chart-2': '#2e7d5b',
  'chart-3': '#c9973b',
  'chart-4': '#a6adbe',
  'chart-5': '#1b2340',

  sidebar: '#fbf9f2',
  'sidebar-foreground': '#1b2340',
  'sidebar-primary': '#1b2340',
  'sidebar-primary-foreground': '#f7f4ec',
  'sidebar-accent': '#ece6d6',
  'sidebar-accent-foreground': '#1b2340',
  'sidebar-border': '#e3dfd2',
  'sidebar-ring': '#c9973b',
};

// Unlike CSS, React Native has no font-weight-on-a-named-family mechanism —
// each weight is its own font file/family name (loaded via expo-font in
// apps/mobile/src/app/_layout.tsx from @expo-google-fonts/{inter,fraunces}),
// so weight is baked into the utility name instead of composed from a
// separate font-weight class the way web's styles.css does it.
const fontFamily = {
  body: 'Inter_400Regular',
  'body-medium': 'Inter_500Medium',
  'body-semibold': 'Inter_600SemiBold',
  'body-bold': 'Inter_700Bold',
  display: 'Fraunces_500Medium',
  'display-medium': 'Fraunces_500Medium',
  'display-semibold': 'Fraunces_600SemiBold',
  'display-bold': 'Fraunces_700Bold',
};

// Matches web's shadcn --radius (0.75rem) derived scale, plus the brand
// --radius-pill token.
const borderRadius = {
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  pill: '999px',
};

// React Native's shadow model (shadowColor/Offset/Opacity/Radius on iOS,
// elevation on Android) can't reproduce a layered CSS box-shadow with
// inset highlights. These are a single-layer approximation of the two
// web shadows — close in weight, not pixel-identical.
const boxShadow = {
  glass: '0 12px 34px rgba(20, 20, 25, 0.14)',
  'glass-active': '0 2px 10px rgba(20, 20, 25, 0.18)',
};

// backdrop-blur-glass on web. No native CSS backdrop-filter equivalent —
// use this value with expo-blur's <BlurView intensity=.../> where the
// glass panel pattern is ported to native.
const blur = {
  glass: 22,
};

module.exports = { colors, fontFamily, borderRadius, boxShadow, blur };
