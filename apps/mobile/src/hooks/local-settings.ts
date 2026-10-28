import Storage from 'expo-sqlite/kv-store';
import { useState } from 'react';

// Settings that live only on this device, not in the user's profile.
// To add one, add its default here; the key and type come from this object.
const DEFAULTS = {
  appearance: 'system' as Appearance,
};

export type Appearance = 'light' | 'dark' | 'system';
type LocalSettings = typeof DEFAULTS;

/** Reads a device setting right away (no waiting), falling back to its default. */
export function getLocalSetting<K extends keyof LocalSettings>(key: K): LocalSettings[K] {
  try {
    const raw = Storage.getItemSync(key);
    if (raw !== null) return JSON.parse(raw) as LocalSettings[K];
  } catch {
    // Missing or unreadable: use the default.
  }
  return DEFAULTS[key];
}

function setLocalSetting<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
  try {
    Storage.setItemSync(key, JSON.stringify(value));
  } catch {
    // Not saved, but the screen still shows the new value for this session.
  }
}

/**
 * A device setting as state. Changes save on the device straight away.
 * `onChange` runs after each change, for settings that need to act on the app
 * (like appearance).
 */
export function useLocalSetting<K extends keyof LocalSettings>(key: K, onChange?: (value: LocalSettings[K]) => void) {
  const [value, setValue] = useState(() => getLocalSetting(key));

  function update(next: LocalSettings[K]) {
    setValue(next);
    setLocalSetting(key, next);
    onChange?.(next);
  }

  return [value, update] as const;
}
