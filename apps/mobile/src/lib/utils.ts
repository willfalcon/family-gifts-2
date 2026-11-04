import { fontSize } from '@family-gifts/design-tokens';
import { clsx, type ClassValue } from 'clsx';
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

// Joining the last two words only helps if they fit on one line together;
// past this length the words would get split mid-word instead.
const PRETTY_MAX_TAIL = 20;

/**
 * Rough stand-in for CSS `text-wrap: pretty`: glues the last two words with a
 * non-breaking space so a paragraph never ends on a single orphaned word.
 */
export function pretty(text: string) {
  const match = /(\S+)[ \t]+(\S+)\s*$/.exec(text);
  if (!match || match[1].length + match[2].length + 1 > PRETTY_MAX_TAIL) return text;
  return text.slice(0, match.index) + `${match[1]} ${match[2]}`;
}
