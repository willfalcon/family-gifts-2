import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { ConvexProvider, ConvexReactClient, useQuery } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { api } from '@family-gifts/backend/convex/_generated/api';
import { authClient } from './lib/auth-client';

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL — copy .env.example to .env.local.');
}

const convex = new ConvexReactClient(CONVEX_URL, {
  expectAuth: true,
  unsavedChangesWarning: false,
});

function AuthForm() {
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
      mode === 'signIn'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setSubmitting(false);
    if (error) setError(error.message ?? 'Something went wrong');
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
      {mode === 'signUp' && (
        <TextInput
          style={styles.input}
          placeholder="name"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{mode === 'signIn' ? 'Sign in' : 'Sign up'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
        <Text style={styles.link}>
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

function SignedIn({ email }: { email: string }) {
  return (
    <View style={styles.form}>
      <Text style={styles.title}>Signed in</Text>
      <Text>{email}</Text>
      <Pressable style={styles.button} onPress={() => authClient.signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function AppContent() {
  const user = useQuery(api.auth.getCurrentUser);

  if (user === undefined) {
    return <Text>Connecting to Convex...</Text>;
  }

  return user ? <SignedIn email={user.email} /> : <AuthForm />;
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <View style={styles.container}>
          <AppContent />
          <StatusBar style="auto" />
        </View>
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  error: {
    color: '#c33',
  },
  link: {
    textAlign: 'center',
    color: '#555',
    marginTop: 4,
  },
});
