import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { colors } from '@family-gifts/design-tokens';
import { authClient } from '../../lib/auth-client';

const inputClassName = 'w-full font-body text-[15.5px] py-1.5 pb-2.5 border-0 border-b-[1.5px] border-line bg-transparent text-ink';

export default function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error } =
      mode === 'signIn' ? await authClient.signIn.email({ email, password }) : await authClient.signUp.email({ email, password, name });
    setSubmitting(false);
    if (error) setError(error.message ?? 'Something went wrong');
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-xs gap-2.5">
        <Text className="font-display-semibold text-xl text-ink mb-1">{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
        {mode === 'signUp' && (
          <TextInput
            className={inputClassName}
            placeholder="name"
            placeholderTextColor={colors.slate}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          className={inputClassName}
          placeholder="email"
          placeholderTextColor={colors.slate}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className={inputClassName}
          placeholder="password"
          placeholderTextColor={colors.slate}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          className="rounded-pill bg-ink items-center justify-center px-5 py-2.5 mt-2 disabled:opacity-35"
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text className="font-body-semibold text-paper text-sm">{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
        </Pressable>
        {error && <Text className="text-destructive text-sm">{error}</Text>}
        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text className="text-center text-slate text-[13.5px] mt-1">
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
