import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassButton from '@/components/glass-button';
import { claimStatus, wantedQuantity, type ItemClaim } from '@/components/list-item';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useClaimActions } from '@/hooks/claims';
import { useItemClaims, useItems, useList } from '@/hooks/lists';
import { Id } from '@convex/_generated/dataModel';

const IMAGE_SIZE = 240;
const NO_CLAIM: ItemClaim = { claimedQuantity: 0, myQuantity: 0, otherClaimers: [] };

// "https://www.amazon.com/dp/123" -> "amazon.com"
function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Stack options for this screen's route. It opens as a sheet at ~2/3 height.
// Scrolling up past the top of the content (or dragging) pulls it to full
// screen, and dragging back down drops it to the smaller size or dismisses it.
export const THEIR_ITEM_SHEET_OPTIONS = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.65, 1],
  sheetGrabberVisible: true,
};

// Details of one idea on someone else's list, shown as a sheet over the list.
export default function TheirItem() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const listId = id as Id<'lists'>;

  const list = useList(listId);
  const items = useItems(listId);
  const claims = useItemClaims(listId);
  const item = items?.find(i => i._id === itemId);
  const claim = (item && claims?.[item._id]) || NO_CLAIM;
  const { claimOneMore, unclaim } = useClaimActions(itemId as Id<'items'>, claim);
  const [claiming, setClaiming] = useState(false);

  const closeButton = (
    <View className="flex-row justify-end p-4">
      <GlassButton onPress={() => router.back()} accessibilityLabel="Close">
        <Icon as={X} size={20} />
      </GlassButton>
    </View>
  );

  if (items === undefined) return <View className="flex-1 bg-background">{closeButton}</View>;
  if (!item) {
    return (
      <View className="flex-1 bg-background">
        {closeButton}
        <Text className="text-center text-ink-muted">This idea isn't on the list anymore.</Text>
      </View>
    );
  }

  const wanted = wantedQuantity(item);
  const left = wanted - claim.claimedQuantity;
  const status = claimStatus(wanted, claim);

  const updateClaim = async (action: () => Promise<boolean>) => {
    setClaiming(true);
    await action();
    setClaiming(false);
  };

  // First name only reads more naturally: "Ask Sam a question".
  const ownerName = list?.owner.name.split(' ')[0];

  const priceRow = [item.price !== undefined && `$${item.price}`, item.link && linkLabel(item.link)].filter(Boolean);

  console.log(list);
  return (
    <View className="flex-1 bg-background">
      {closeButton}

      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            contentFit="contain"
            style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 20, alignSelf: 'center' }}
          />
        )}

        <View className="gap-1">
          {list && (
            <Link href={`/lists/${list._id}`} asChild>
              <Text className="text-[14px] text-ink-muted text-center">From {list.title}</Text>
            </Link>
          )}
          <Text className="text-[24px] font-bold text-ink text-center">{item.name}</Text>
        </View>

        {priceRow.length > 0 && <Text className="text-center text-ink-muted">{priceRow.join(' at ')}</Text>}

        {item.notes && <Text className="text-ink">{item.notes}</Text>}

        <View className="gap-2 px-4 pt-2" style={{ paddingBottom: insets.bottom + 16 }}>
          {status && <Text className="text-center text-sm text-accent">{status}</Text>}
          {left > 0 && claim.myQuantity === 0 && (
            <Button size="lg" onPress={() => updateClaim(claimOneMore)} disabled={claiming}>
              <Text>I'll get this</Text>
            </Button>
          )}
          {claim.myQuantity > 0 && (
            <Button size="lg" variant="secondary" onPress={() => updateClaim(unclaim)} disabled={claiming}>
              <Text>Unclaim</Text>
            </Button>
          )}
          <View className="gap-2 flex-row items-center justify-center">
            {item.link && (
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(item.link!)}
                accessibilityRole="link"
                className="flex-row items-center justify-center gap-1.5 py-2 active:opacity-60"
              >
                <Text className="text-ink">Open in store</Text>
                <Icon as={ExternalLink} size={14} className="text-ink" />
              </Pressable>
            )}
            {ownerName && <Text className="text-center text-ink">Ask {ownerName} a question</Text>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
