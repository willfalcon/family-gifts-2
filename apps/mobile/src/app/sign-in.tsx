import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackButton } from '@/components/back-button';
import { BigTitle } from '@/components/big-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { authClient } from '../../lib/auth-client';
import DevUserSwitcher from '@/components/dev-user-switcher';
import { useBreachedPasswordConfirm } from '@/components/breached-password-dialog';

export default function SignIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signIn' | 'signUp'>(params.mode === 'signUp' ? 'signUp' : 'signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { confirmPassword, dialog } = useBreachedPasswordConfirm();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignIn = mode === 'signIn';

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    if (!isSignIn && !(await confirmPassword(password))) {
      setSubmitting(false);
      return;
    }
    const { error } = isSignIn
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name });
    setSubmitting(false);
    if (error) setError(error.message ?? 'Something went wrong');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="gap-3">
          <View className="flex-row items-center gap-4">
            <BackButton />
            <BigTitle title={isSignIn ? 'Log in' : 'Create account'} />
          </View>
          <Text className="text-muted-foreground text-[15px] px-4">
            {isSignIn ? 'Welcome back.' : "It's free. You'll log in with your email and password."}
          </Text>
        </View>

        <View className="gap-6">
          {!isSignIn && (
            <View className="gap-1.5">
              <Label nativeID="sign-in-name">Name</Label>
              <Input
                aria-labelledby="sign-in-name"
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                value={name}
                onChangeText={setName}
              />
            </View>
          )}
          <View className="gap-1.5">
            <Label nativeID="sign-in-email">Email</Label>
            <Input
              aria-labelledby="sign-in-email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View className="gap-1.5">
            <Label nativeID="sign-in-password">Password</Label>
            <Input
              aria-labelledby="sign-in-password"
              placeholder="Password"
              secureTextEntry
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              textContentType={isSignIn ? 'password' : 'newPassword'}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              value={password}
              onChangeText={setPassword}
            />
            {isSignIn && (
              <Pressable
                className="self-end pt-1"
                onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
              >
                <Text className="text-sm text-accent font-semibold">Forgot password?</Text>
              </Pressable>
            )}
          </View>
          {error && <Text className="text-sm text-destructive">{error}</Text>}
        </View>

        <View className="gap-3">
          <Button className="h-12" onPress={handleSubmit} disabled={submitting}>
            <Text>{isSignIn ? 'Log In' : 'Create Account'}</Text>
          </Button>
          <Pressable onPress={() => setMode(isSignIn ? 'signUp' : 'signIn')}>
            <Text className="text-center text-sm text-ink-muted">
              {isSignIn ? (
                <>
                  Don't have an account? <Text className="text-accent font-semibold">Create one</Text>
                </>
              ) : (
                <>
                  Already have an account? <Text className="text-accent font-semibold">Log in</Text>
                </>
              )}
            </Text>
          </Pressable>
        </View>

        <DevUserSwitcher />
      </ScrollView>
      {dialog}
    </SafeAreaView>
  );
}
