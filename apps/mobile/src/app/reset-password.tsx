import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { BackButton } from '@/components/back-button';
import { BigTitle } from '@/components/big-title';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { Text } from '@/components/ui/text';

export default function ResetPassword() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

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
            <BigTitle title="New password" />
          </View>
          <Text className="text-muted-foreground text-[15px] px-4">
            If an account exists for <Text className="font-semibold">{email}</Text>, we've emailed it a 6-digit code.
            It expires in 5 minutes.
          </Text>
        </View>

        <ResetPasswordForm email={email} />
      </ScrollView>
    </SafeAreaView>
  );
}
