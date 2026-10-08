import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { ConvexProvider, ConvexReactClient, useQuery } from 'convex/react';
import { api } from '@family-gifts/backend/convex/_generated/api';

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error('Missing EXPO_PUBLIC_CONVEX_URL — copy .env.example to .env.local.');
}

const convex = new ConvexReactClient(CONVEX_URL);

function ConnectionStatus() {
  // Same backend as the web app — unauthenticated here, so this just proves
  // the mobile client can reach the shared Convex deployment.
  const user = useQuery(api.auth.getCurrentUser);

  if (user === undefined) {
    return <Text>Connecting to Convex...</Text>;
  }

  return (
    <Text>{user ? `Signed in as ${user.email}` : 'Connected to Convex (not signed in)'}</Text>
  );
}

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <View style={styles.container}>
        <ConnectionStatus />
        <StatusBar style="auto" />
      </View>
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
});
