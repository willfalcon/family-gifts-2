import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { MOCK_USERS, MOCK_USER_PASSWORD, type MockUser } from '@shared/mock-users';
import { authClient } from '../../lib/auth-client';

/**
 * Dev-only panel for signing in as one of the mock users in
 * packages/shared/mock-users.ts. Tapping a user signs out of the current
 * account (if any) and into theirs, creating the account the first time.
 * Renders nothing in release builds.
 */
export default function DevUserSwitcher({ currentEmail }: { currentEmail?: string | null }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!__DEV__) return null;

  async function switchTo(user: MockUser) {
    setError(null);
    setPending(user.email);
    try {
      if (currentEmail) await authClient.signOut();

      const signIn = await authClient.signIn.email({ email: user.email, password: MOCK_USER_PASSWORD });
      if (!signIn.error) return;

      // Most likely the account doesn't exist yet, so make it.
      const signUp = await authClient.signUp.email({ email: user.email, password: MOCK_USER_PASSWORD, name: user.name });
      if (signUp.error) setError(signUp.error.message ?? signIn.error.message ?? 'Could not sign in');
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    setError(null);
    setPending('signOut');
    await authClient.signOut();
    setPending(null);
  }

  return (
    <View className="w-full gap-2 rounded-2xl border border-dashed border-line p-3 mt-6">
      <Text className="font-body-semibold text-xs uppercase tracking-wider text-slate">Dev · sign in as</Text>
      <View className="flex-row flex-wrap gap-2">
        {MOCK_USERS.map(user => {
          const isCurrent = user.email === currentEmail;
          return (
            <Pressable
              key={user.email}
              className={`rounded-pill px-3 py-1.5 border border-line disabled:opacity-35 ${isCurrent ? 'bg-ink' : ''}`}
              disabled={pending !== null || isCurrent}
              onPress={() => switchTo(user)}
            >
              <Text className={`text-[13px] ${isCurrent ? 'text-paper' : 'text-ink'}`}>
                {pending === user.email ? '…' : user.name.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {currentEmail && (
        <Pressable onPress={signOut} disabled={pending !== null}>
          <Text className="text-[13px] text-destructive">Sign out ({currentEmail})</Text>
        </Pressable>
      )}
      {error && <Text className="text-destructive text-[13px]">{error}</Text>}
    </View>
  );
}
