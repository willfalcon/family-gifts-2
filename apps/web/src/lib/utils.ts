export { cn } from '@shared/cn';

// First letter of the first two words of a name, for avatar fallbacks.
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
