import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { ThemeProvider } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PortalHost } from '@rn-primitives/portal';
import { authClient } from '../../lib/auth-client';
import AppContent from '../components/app-content';
import { NAV_THEME } from '../lib/theme';

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL — copy .env.example to .env.local.');
}

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

// Bridges Convex's live subscriptions into TanStack Query's cache so
// `useQuery(convexQuery(...))` stays reactive. Shares the client above so
// auth set by ConvexBetterAuthProvider applies to react-query calls too.
const convexQueryClient = new ConvexQueryClient(convex);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

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
      {/* <AnimatedSplashOverlay /> */}
      <ConvexProvider client={convex}>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <QueryClientProvider client={queryClient}>
            <AppContent />
            <PortalHost />
          </QueryClientProvider>
        </ConvexBetterAuthProvider>
      </ConvexProvider>
    </ThemeProvider>
  );
}
