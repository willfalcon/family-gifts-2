import { Alert, ScrollView, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import GlassButton from '@/components/glass-button';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useUser } from '@/hooks/user';

// Reached from "Forgot it?" on Change Password, which has already emailed
// the code to the signed-in user's address.
export default function ChangePasswordReset() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useUser();
  const email = user?.email ?? '';

  function handleSuccess() {
    // Close the whole Change Password modal, not just this screen.
    navigation.getParent()?.goBack();
    Alert.alert('Password changed', "You've been signed out on your other devices.");
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 p-4">
        <GlassButton className="w-20" onPress={() => router.back()} accessibilityLabel="Back">
          <Icon as={ChevronLeft} size={20} />
        </GlassButton>
        <Text className="flex-1 text-center text-lg font-bold">Reset Password</Text>
        {/* Balances the back button so the title stays centred. */}
        <View className="w-20" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-4 pt-2 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text className="text-muted-foreground text-[15px]">
          We've emailed a 6-digit code to <Text className="font-semibold">{email}</Text>. It expires in 5 minutes.
        </Text>
        {email ? <ResetPasswordForm email={email} onSuccess={handleSuccess} /> : null}
      </ScrollView>
    </View>
  );
}
