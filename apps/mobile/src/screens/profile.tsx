import { ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import GlassButton from '@/components/glass-button';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { useProfile, useUser } from '@/hooks/user';
import { useGroups } from '@/hooks/groups';
import ProfileForm from '@/components/profile-form';
import DevUserSwitcher from '@/components/dev-user-switcher';

const AVATAR_SIZE = 76;

export default function Profile() {
  const router = useRouter();
  const profile = useProfile();
  const user = useUser();
  const groups = useGroups();

  const initial = user?.name?.charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center p-4 mx-4 relative">
        <GlassButton
          className="w-20 absolute left-4 top-3 z-10"
          onPress={() => router.back()}
          accessibilityLabel="Cancel"
        >
          <Icon as={X} size={20} />
        </GlassButton>
        <Text className="flex-1 text-center text-lg font-bold">Profile</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pt-2 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View
          className="mx-auto p-4 rounded-full bg-avatar-navy items-center justify-center"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          <Text className="!text-title text-on-avatar leading-tight font-semibold">{initial}</Text>
        </View>
        <Text className="text-center display-name">{user?.name}</Text>
        <Text className="text-center !text-callout text-accent">Edit photo and name</Text>
        <DevUserSwitcher currentEmail={user?.email} />

        {profile !== undefined && groups !== undefined && (
          <ProfileForm profile={profile} groups={groups} email={user?.email ?? null} />
        )}
      </ScrollView>
    </View>
  );
}
