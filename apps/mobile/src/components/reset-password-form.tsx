import { useRef, useState } from 'react';
import { Pressable, type TextInputInstance, View } from 'react-native';
import { useBreachedPasswordConfirm } from '@/components/breached-password-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { Text } from '@/components/ui/text';
import { authClient } from '../../lib/auth-client';

type Props = {
  email: string;
  /** Called after the password is reset and the user is logged in with it. */
  onSuccess?: () => void;
};

// Code + new password form for the emailed-code reset flow. Used both from
// the log-in screen (signed out) and from Change Password (signed in).
export function ResetPasswordForm({ email, onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);
  const { confirmPassword, dialog } = useBreachedPasswordConfirm();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from the email');
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);
    if (!(await confirmPassword(password))) {
      setSubmitting(false);
      return;
    }
    const { error } = await authClient.emailOtp.resetPassword({ email, otp: code, password });
    if (error) {
      setSubmitting(false);
      setError(error.message ?? 'Something went wrong');
      return;
    }
    // A reset signs out every session (revokeSessionsOnPasswordReset), so log
    // straight back in with the new password. When signed out, the auth guard
    // in app-content then swaps to the app.
    const signIn = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signIn.error) {
      setError(signIn.error.message ?? 'Password reset, but logging in failed');
      return;
    }
    onSuccess?.();
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setResending(false);
    if (error) setError(error.message ?? 'Something went wrong');
    else {
      setCode('');
      setNotice('A new code is on its way.');
    }
  }

  return (
    <>
      <View className="gap-6">
        <View className="gap-1.5">
          <Label nativeID="reset-password-code">Code</Label>
          <OtpInput
            aria-labelledby="reset-password-code"
            value={code}
            onChangeText={setCode}
            onComplete={() => passwordRef.current?.focus()}
            autoFocus
          />
        </View>
        <View className="gap-1.5">
          <Label nativeID="reset-password-password">New password</Label>
          <Input
            ref={passwordRef}
            aria-labelledby="reset-password-password"
            placeholder="New password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            value={password}
            onChangeText={setPassword}
          />
        </View>
        {error && <Text className="text-sm text-destructive">{error}</Text>}
        {notice && <Text className="text-sm text-ink-muted">{notice}</Text>}
      </View>

      <View className="gap-3">
        <Button className="h-12" onPress={handleSubmit} disabled={submitting}>
          <Text>Reset Password</Text>
        </Button>
        <Pressable onPress={handleResend} disabled={resending}>
          <Text className="text-center text-sm text-ink-muted">
            Didn't get it? <Text className="text-accent font-semibold">Send a new code</Text>
          </Text>
        </Pressable>
      </View>
      {dialog}
    </>
  );
}
