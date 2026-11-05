import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext } from 'react';

// Set by AppTabs. Hides or shows the tab bar.
export const TabBarContext = createContext<(hidden: boolean) => void>(() => {});

// Hides the tab bar while the calling screen is focused, e.g. so a thread's
// message box can sit at the bottom of the screen and ride on the keyboard.
export function useHideTabBar() {
  const setHidden = useContext(TabBarContext);
  useFocusEffect(
    useCallback(() => {
      setHidden(true);
      return () => setHidden(false);
    }, [setHidden]),
  );
}
