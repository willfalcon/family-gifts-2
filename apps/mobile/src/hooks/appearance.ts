import { colorScheme } from 'nativewind';
import { getLocalSetting, useLocalSetting } from './local-settings';

/** Applies the saved appearance. Called once when the app starts. */
export function applySavedAppearance() {
  colorScheme.set(getLocalSetting('appearance'));
}

/** The user's light / dark / system choice, applied as soon as it changes. */
export function useAppearance() {
  return useLocalSetting('appearance', value => colorScheme.set(value));
}
