import * as SplashScreen from 'expo-splash-screen';
import AppTabs from '@/components/app-tabs';
import { AnimatedSplashOverlay } from '@/components/animated-splash-screen';

SplashScreen.preventAutoHideAsync();
export default function AppLayout() {
  return (
    <>
      <AnimatedSplashOverlay />
      <AppTabs />
    </>
  );
}
