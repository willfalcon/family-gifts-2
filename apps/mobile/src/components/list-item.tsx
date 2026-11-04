import { useState } from 'react';
import { Pressable, View, Text, Image } from 'react-native';
import PriorityBadge from '@/components/priority-badge';
import { ItemWithImage } from '@convex/types';
import {
  SwipeActions,
  Button as UIButton,
  ConfirmationDialog,
  ContextMenu,
  Section,
  Picker,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { tag, tint } from '@expo/ui/swift-ui/modifiers';
import { LIST_ROW_MODIFIERS, RNRowContent } from '@/components/native-list';
import { useClaimActions, useItemDetailsHref } from '@/hooks/claims';
import { useRowTap } from '@/hooks/row-tap';

const IMAGE_SIZE = 60;

// How much of an item is claimed - only passed when viewing someone else's
// list. The owner never gets this, so they never see claims.
export type ItemClaim = { claimedQuantity: number; myQuantity: number; otherClaimers: string[] };

// A row of a NativeList.
export default function ListItem({ item, claim }: { item: ItemWithImage; claim?: ItemClaim }) {
  if (claim) return <ClaimableListItem item={item} claim={claim} />;
  return <OwnListItem item={item} />;
}

function ItemSummary({ item, status }: { item: ItemWithImage; status?: string }) {
  return (
    <View className="flex-row gap-3 py-2" style={{ height: IMAGE_SIZE + 16 }}>
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 14 }} />
      )}
      <View className="flex-1 border-b border-line">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg" numberOfLines={1}>
            {item.name}
          </Text>
          <PriorityBadge priority={item.priority} />
        </View>
        {status ? (
          <Text className="text-sm text-accent">{status}</Text>
        ) : (
          (item.notes || item.price) && (
            <View className="flex-row">
              <Text className="text-sm text-ink-muted" numberOfLines={1}>
                {item.notes && item.notes}
              </Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-sm text-ink-muted">{item.notes && item.price && ' • '}</Text>
                <Text className="text-sm text-ink-muted">{item.price && `$${item.price}`}</Text>
              </View>
            </View>
          )
        )}
      </View>
    </View>
  );
}

// "Ann", "Ann and Bo", "Ann, Bo and Cy"
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? 'someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// How many of an item the owner wants. Unset means one.
export function wantedQuantity(item: ItemWithImage) {
  return Math.max(1, item.quantity ?? 1);
}

export function claimStatus(wanted: number, claim: ItemClaim) {
  if (claim.claimedQuantity === 0) return wanted > 1 ? `Wants ${wanted}` : undefined;
  if (wanted === 1) {
    return claim.myQuantity > 0 ? "You're getting this" : `Claimed by ${joinNames(claim.otherClaimers)}`;
  }
  if (claim.myQuantity > 0) return `You're getting ${claim.myQuantity}`;
  return `${claim.claimedQuantity} of ${wanted} claimed by ${joinNames(claim.otherClaimers)}`;
}

// Swipe buttons are tinted red rather than given role="destructive": in a List,
// SwiftUI animates a row away when its destructive swipe action is tapped,
// which hides rows that aren't actually being removed.
const SWIPE_RED = [tint('red')];

// Someone else's idea: claim it, take one more of it, or let it go.
function ClaimableListItem({ item, claim }: { item: ItemWithImage; claim: ItemClaim }) {
  const router = useRouter();
  const { claimOneMore, unclaim } = useClaimActions(item._id, claim);
  const detailsHref = useItemDetailsHref();
  const rowTap = useRowTap(() => router.push(detailsHref(item.listId, item._id)));

  const wanted = wantedQuantity(item);
  const left = wanted - claim.claimedQuantity;

  const claimButton = left > 0 && (
    <UIButton label={claim.myQuantity > 0 ? 'Claim one more' : 'Claim'} systemImage="gift" onPress={claimOneMore} />
  );

  return (
    <SwipeActions modifiers={LIST_ROW_MODIFIERS}>
      <ContextMenu>
        <ContextMenu.Items>
          {claimButton}
          {claim.myQuantity > 0 && (
            <UIButton label="Unclaim" systemImage="arrow.uturn.backward" role="destructive" onPress={unclaim} />
          )}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <RNRowContent>
            <Pressable {...rowTap}>
              <ItemSummary item={item} status={claimStatus(wanted, claim)} />
            </Pressable>
          </RNRowContent>
        </ContextMenu.Trigger>
      </ContextMenu>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        {claimButton}
        {claim.myQuantity > 0 && (
          <UIButton label="Unclaim" systemImage="arrow.uturn.backward" modifiers={SWIPE_RED} onPress={unclaim} />
        )}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

function OwnListItem({ item }: { item: ItemWithImage }) {
  const router = useRouter();
  const removeItem = useMutation(api.items.remove);
  const updatePriority = useMutation(api.items.updatePriority);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const edit = () => router.push(`/lists/${item.listId}/items/${item._id}`);

  const confirmDelete = () => {
    removeItem({ id: item._id });
    setDeleteConfirm(false);
  };

  const handleUpdatePriority = (priority: 'low' | 'medium' | 'high') => {
    updatePriority({ id: item._id, priority });
  };

  return (
    <SwipeActions modifiers={LIST_ROW_MODIFIERS}>
      {/* The dialog hangs off the row, not the swipe button, so it stays up
          after SwiftUI closes the swipe. */}
      <ConfirmationDialog title="Delete Item" isPresented={deleteConfirm} onIsPresentedChange={setDeleteConfirm}>
        <ConfirmationDialog.Trigger>
          <ContextMenu>
            <ContextMenu.Items>
              <UIButton label="Edit" systemImage="pencil" onPress={edit} />
              <Section title="Priority">
                <Picker
                  label="Priority"
                  selection={item.priority}
                  onSelectionChange={value => {
                    handleUpdatePriority(value as 'low' | 'medium' | 'high');
                  }}
                >
                  <UIText key="low" modifiers={[tag('low')]}>
                    Low
                  </UIText>
                  <UIText key="medium" modifiers={[tag('medium')]}>
                    Medium
                  </UIText>
                  <UIText key="high" modifiers={[tag('high')]}>
                    High
                  </UIText>
                </Picker>
              </Section>

              <UIButton label="Move to List" systemImage="arrow.right" onPress={() => {}} />
              <UIButton label="Delete" systemImage="trash" role="destructive" onPress={() => setDeleteConfirm(true)} />
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              <RNRowContent>
                <ItemSummary item={item} />
              </RNRowContent>
            </ContextMenu.Trigger>
          </ContextMenu>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <UIButton label="Cancel" onPress={() => setDeleteConfirm(false)} />
          <UIButton label="Delete" role="destructive" onPress={confirmDelete} />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>

      <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
        <UIButton label="Edit" systemImage="pencil" onPress={edit} />
      </SwipeActions.Actions>

      <SwipeActions.Actions edge="trailing">
        <UIButton label="Delete" systemImage="trash" modifiers={SWIPE_RED} onPress={() => setDeleteConfirm(true)} />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
