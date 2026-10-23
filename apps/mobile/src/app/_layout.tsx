import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { ThemeProvider } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PortalHost } from '@rn-primitives/portal';
import * as SplashScreen from 'expo-splash-screen';
import { authClient } from '../../lib/auth-client';
import AppContent from '../components/app-content';
import { AnimatedSplashOverlay } from '../components/animated-splash-screen';
import { NAV_THEME } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL — copy .env.example to .env.local.');
}

// Reuse one client across hot reloads. Without this, every reload of this
// file opens a new websocket and the new client starts without auth.
const globalForConvex = globalThis as { __convex?: ConvexReactClient };
const convex = (globalForConvex.__convex ??= new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
}));

import '../global.css';

export default function AppLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={NAV_THEME.light}>
      <ConvexProvider client={convex}>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <AppContent />
          <PortalHost />
        </ConvexBetterAuthProvider>
      </ConvexProvider>
      <AnimatedSplashOverlay />
    </ThemeProvider>
  );
}
