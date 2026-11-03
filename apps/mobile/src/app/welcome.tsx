import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

// Placeholder landing page shown to signed-out users before sign-in.
export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <Image
        source={require('@/assets/landing-graphic.svg')}
        contentFit="contain"
        style={{ width: '100%', aspectRatio: 390 / 230, marginTop: 80 }}
      />
      <View className="items-center justify-center gap-3">
        <Text className="font-display-bold text-4xl text-ink text-center">Family Gifts</Text>
        <Text className="font-body text-ink-muted text-center text-[17px] max-w-xs">
          Wish lists for the people you love. Claim a gift without spoiling the surprise.
        </Text>
      </View>
      <View className="w-full max-w-xs self-center gap-3 pb-6 flex-1 justify-end">
        <Link href={{ pathname: '/sign-in', params: { mode: 'signUp' } }} asChild>
          <Button className="h-12">
            <Text>Create Account</Text>
          </Button>
        </Link>
        <Link href={{ pathname: '/sign-in', params: { mode: 'signIn' } }} asChild>
          <Button variant="secondary" className="h-12">
            <Text>Log In</Text>
          </Button>
        </Link>
        <Text className="text-center text-xs text-ink-muted">
          By continuing you agree to the Terms and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}
