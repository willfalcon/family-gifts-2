import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackButton } from '@/components/back-button';
import { BigTitle } from '@/components/big-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { authClient } from '../../lib/auth-client';

export default function ForgotPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email');
      return;
    }
    setError(null);
    setSubmitting(true);
    // Succeeds whether or not an account exists, so this can't be used to
    // check which emails are registered.
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: trimmed });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? 'Something went wrong');
      return;
    }
    router.push({ pathname: '/reset-password', params: { email: trimmed } });
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
            <BigTitle title="Forgot password" />
          </View>
          <Text className="text-muted-foreground text-[15px] px-4">
            Enter your email and we'll send you a 6-digit code to reset your password.
          </Text>
        </View>

        <View className="gap-6">
          <View className="gap-1.5">
            <Label nativeID="forgot-password-email">Email</Label>
            <Input
              aria-labelledby="forgot-password-email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              value={email}
              onChangeText={setEmail}
            />
          </View>
          {error && <Text className="text-sm text-destructive">{error}</Text>}
        </View>

        <Button className="h-12" onPress={handleSubmit} disabled={submitting}>
          <Text>Send Code</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
