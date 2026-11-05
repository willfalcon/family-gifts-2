import { fontSize } from '@family-gifts/design-tokens';
import { clsx, type ClassValue } from 'clsx';
import { ConvexError } from 'convex/values';
import { extendTailwindMerge } from 'tailwind-merge';

// Without this, tailwind-merge reads custom sizes like `text-footnote` as a
// text color and drops whichever of the two comes first.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: Object.keys(fontSize) }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// The server's message for expected failures (ConvexError), a generic one otherwise.
export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.') {
  return e instanceof ConvexError ? String(e.data) : fallback;
}

export function firstName(name: string | undefined | null) {
  return name ? name.trim().split(/\s+/)[0] : undefined;
}

// "Dad", "Dad and Sis", "Dad, Sis and Mom".
export function joinNames(names: string[], empty = '') {
  if (names.length <= 1) return names[0] ?? empty;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// The viewer's local date as "YYYY-MM-DD", for splitting upcoming from past.
export function localToday() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Only same-site paths, so a crafted link can't send someone elsewhere after logging in.
export function safeRedirect(path: string | undefined) {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

// "https://www.amazon.com/dp/123" -> "amazon.com"
export function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
