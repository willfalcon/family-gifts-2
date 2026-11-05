import { useEffect, useState } from 'react';

// The light / dark / system choice. Like mobile, it's a device setting
// (saved in this browser), not part of the profile. The Ledger design system
// has no dark palette yet (see packages/design-tokens), so for now this only
// toggles the `dark` class.
export type Appearance = 'light' | 'dark' | 'system';

const KEY = 'appearance';

function read(): Appearance {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // Storage blocked: fall back to the default.
  }
  return 'system';
}

function apply(value: Appearance) {
  const dark = value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

// Inlined into the page head so the class is set before first paint.
export const APPEARANCE_SCRIPT = `try{var a=localStorage.getItem('${KEY}')||'system';var d=a==='dark'||(a==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export function useAppearance() {
  const [value, setValue] = useState<Appearance>('system');
  useEffect(() => setValue(read()), []);

  function update(next: Appearance) {
    setValue(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved, but this page still shows the new value.
    }
    apply(next);
  }

  return [value, update] as const;
}
