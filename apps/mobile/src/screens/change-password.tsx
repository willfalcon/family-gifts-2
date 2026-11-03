import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, type TextInputInstance, View } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { colors } from '@family-gifts/design-tokens';
import GlassButton from '@/components/glass-button';
import { useBreachedPasswordConfirm } from '@/components/breached-password-dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useUser } from '@/hooks/user';
import { authClient } from '../../lib/auth-client';

export default function ChangePassword() {
  const router = useRouter();
  const user = useUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const newPasswordRef = useRef<TextInputInstance>(null);
  const { confirmPassword, dialog } = useBreachedPasswordConfirm();

  // Emails a reset code to the signed-in address, then moves to the screen
  // where it's entered. Uses the same code flow as the log-in screen.
  async function forgotPassword() {
    if (!user?.email) return;
    setError(null);
    setSendingCode(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: user.email });
    setSendingCode(false);
    if (error) {
      setError(error.message ?? 'Something went wrong. Try again.');
      return;
    }
    router.push('/change-password/reset');
  }

  async function save() {
    if (!currentPassword || !newPassword) {
      setError('Enter your current password and a new one.');
      return;
    }
    // Both values are already on the device, so this check leaks nothing.
    if (currentPassword === newPassword) {
      setError("That's your current password. Choose a new one.");
      return;
    }
    setError(null);
    setSaving(true);
    if (!(await confirmPassword(newPassword))) {
      setSaving(false);
      return;
    }
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      // Keeps this device signed in and signs out everywhere else, matching
      // what a password reset does.
      revokeOtherSessions: true,
    });
    setSaving(false);
    if (error) {
      setError(
        error.code === 'INVALID_PASSWORD'
          ? 'Your current password is incorrect.'
          : (error.message ?? 'Something went wrong. Try again.'),
      );
      return;
    }
    router.back();
    Alert.alert('Password changed', "You've been signed out on your other devices.");
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Cancel">
          <Icon as={X} size={20} />
        </GlassButton>
        <Text className="flex-1 text-center text-lg font-bold">Change Password</Text>
        <GlassButton
          className="w-20"
          accessibilityLabel="Save password"
          glassProps={{ tintColor: colors.accent }}
          glassStyle={{ width: 'auto', paddingHorizontal: 8 }}
          onPress={save}
          disabled={saving}
        >
          <Text className="font-semibold text-accent-foreground">Save</Text>
        </GlassButton>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pt-2 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="gap-1.5">
          <Label nativeID="change-password-current">Current password</Label>
          <Input
            aria-labelledby="change-password-current"
            placeholder="Current password"
            secureTextEntry
            autoFocus
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => newPasswordRef.current?.focus()}
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Pressable className="self-end pt-1" onPress={forgotPassword} disabled={sendingCode} hitSlop={8}>
            <Text className="text-sm text-accent font-semibold">{sendingCode ? 'Sending code…' : 'Forgot it?'}</Text>
          </Pressable>
        </View>
        <View className="gap-1.5">
          <Label nativeID="change-password-new">New password</Label>
          <Input
            ref={newPasswordRef}
            aria-labelledby="change-password-new"
            placeholder="New password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={save}
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>
        {error && <Text className="text-sm text-destructive">{error}</Text>}
        <Text className="text-sm text-ink-muted">
          Changing your password signs you out on your other devices. You'll stay signed in here.
        </Text>
      </ScrollView>
      {dialog}
    </View>
  );
}
