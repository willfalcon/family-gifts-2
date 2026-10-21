import { BackLink } from '@/components/back-link';
import GlassButton from '@/components/glass-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useItems, useList } from '@/hooks/lists';
import { useUser } from '@/hooks/user';
import { useLocalSearchParams } from 'expo-router';
import { Ellipsis, Gift } from 'lucide-react-native';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function List() {
  const { id } = useLocalSearchParams();
  const listId = Array.isArray(id) ? id[0] : id;
  const list = useList(listId);
  const items = useItems(listId);
  const user = useUser();
  const isOwner = !!user && user._id === list?.createdBy;
  const count = items?.length;

  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="flex-row gap-4">
        <View className="flex-0">
          <BackLink />
        </View>
        {list && <Text className="flex-1 font-display-bold text-4xl tracking-tight text-ink">{list.title}</Text>}
        <View className="flex-0">
          <GlassButton accessibilityLabel="Options">
            <Icon as={Ellipsis} />
          </GlassButton>
        </View>
      </View>

      {items?.length === 0 && (
        <View className="flex-1 items-center justify-center gap-2">
          <View className="bg-fill mb-2 size-16 items-center justify-center rounded-2xl">
            <Icon as={Gift} className="text-ink-muted" size={28} />
          </View>
          <Text className="text-center text-xl font-semibold text-ink">Add your first idea</Text>
          <Text className="text-ink-muted mx-4 text-center">
            Paste a link from any store, or just type what you'd like. You can also share to Family Gifts from Safari.
          </Text>
          <Button>
            <Text>Paste a link</Text>
          </Button>
          <Button variant="secondary">
            <Text>Type it in</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}
