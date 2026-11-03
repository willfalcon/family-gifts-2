import * as Crypto from 'expo-crypto';

// How many times a password appears in the Have I Been Pwned breach list.
// Only the first 5 characters of the password's SHA-1 hash are sent; the
// match against the returned list happens on the device. Returns 0 if the
// check can't run (offline, service down) so it never blocks the user.
export async function countPasswordBreaches(password: string): Promise<number> {
  try {
    const hash = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, password)).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    // Add-Padding makes every response a similar size, so the prefix can't
    // be guessed from the response length.
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split('\n')) {
      const [lineSuffix, count] = line.trim().split(':');
      if (lineSuffix === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
