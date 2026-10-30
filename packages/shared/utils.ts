export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
