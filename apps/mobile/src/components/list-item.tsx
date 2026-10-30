import { useState } from 'react';
import { Alert, View, Text, Image } from 'react-native';
import { Star } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { ItemWithImage } from '@convex/types';
import {
  Host,
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
import { tag } from '@expo/ui/swift-ui/modifiers';
import { ConvexError } from 'convex/values';

// How much of an item is claimed - only passed when viewing someone else's
// list. The owner never gets this, so they never see claims.
export type ItemClaim = { claimedQuantity: number; myQuantity: number };

export default function ListItem({ item, claim }: { item: ItemWithImage; claim?: ItemClaim }) {
  if (claim) return <ClaimableListItem item={item} claim={claim} />;
  return <OwnListItem item={item} />;
}

function ItemSummary({ item, status }: { item: ItemWithImage; status?: string }) {
  return (
    <View className="flex-row gap-3 py-2">
      {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60, borderRadius: 14 }} />}
      <View className="flex-1 border-b border-line">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-lg" numberOfLines={1}>
            {item.name}
          </Text>
          {item.priority === 'high' && (
            <View className="flex-row items-center gap-1">
              <Icon as={Star} className="text-star" size={16} />
            </View>
          )}
        </View>
        {(item.notes || item.price) && (
          <View className="flex-row">
            <Text className="flex-1 text-sm text-ink-muted" numberOfLines={1}>
              {item.notes && item.notes}
            </Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-ink-muted">{item.notes && item.price && ' • '}</Text>
              <Text className="text-sm text-ink-muted">{item.price && `$${item.price}`}</Text>
            </View>
          </View>
        )}
        {status && <Text className="text-sm text-accent">{status}</Text>}
      </View>
    </View>
  );
}

function claimStatus(wanted: number, claim: ItemClaim) {
  if (claim.claimedQuantity === 0) return wanted > 1 ? `Wants ${wanted}` : undefined;
  const mine = claim.myQuantity > 0 ? ` · you're getting ${claim.myQuantity}` : '';
  if (claim.claimedQuantity >= wanted) return `Claimed${mine}`;
  return `${claim.claimedQuantity} of ${wanted} claimed${mine}`;
}

// Someone else's idea: claim it, take one more of it, or let it go.
function ClaimableListItem({ item, claim }: { item: ItemWithImage; claim: ItemClaim }) {
  const claimItem = useMutation(api.claims.claim);
  const unclaimItem = useMutation(api.claims.unclaim);

  const wanted = Math.max(1, item.quantity ?? 1);
  const left = wanted - claim.claimedQuantity;

  const run = async (action: Promise<unknown>) => {
    try {
      await action;
    } catch (error) {
      Alert.alert(error instanceof ConvexError ? String(error.data) : "Couldn't update your claim.");
    }
  };

  const actions = (
    <>
      {left > 0 && (
        <UIButton
          label={claim.myQuantity > 0 ? 'Claim one more' : 'Claim'}
          systemImage="gift"
          onPress={() => run(claimItem({ itemId: item._id, quantity: claim.myQuantity + 1 }))}
        />
      )}
      {claim.myQuantity > 0 && (
        <UIButton
          label="Unclaim"
          systemImage="arrow.uturn.backward"
          role="destructive"
          onPress={() => run(unclaimItem({ itemId: item._id }))}
        />
      )}
    </>
  );

  return (
    <Host>
      <SwipeActions>
        <ContextMenu>
          <ContextMenu.Items>{actions}</ContextMenu.Items>
          <ContextMenu.Trigger>
            <ItemSummary item={item} status={claimStatus(wanted, claim)} />
          </ContextMenu.Trigger>
        </ContextMenu>
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          {actions}
        </SwipeActions.Actions>
      </SwipeActions>
    </Host>
  );
}

function OwnListItem({ item }: { item: ItemWithImage }) {
  const router = useRouter();
  const removeItem = useMutation(api.items.remove);
  const updatePriority = useMutation(api.items.updatePriority);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const confirmDelete = () => {
    removeItem({ id: item._id });
    setDeleteConfirm(false);
  };

  const handleUpdatePriority = (priority: 'low' | 'medium' | 'high') => {
    updatePriority({ id: item._id, priority });
  };

  return (
    <Host>
      <SwipeActions>
        <ContextMenu>
          <ContextMenu.Items>
            <UIButton
              label="Edit"
              systemImage="pencil"
              onPress={() => router.push(`/lists/${item.listId}/items/${item._id}`)}
            />
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
            <ItemSummary item={item} />
          </ContextMenu.Trigger>
        </ContextMenu>

        <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
          <UIButton
            label="Edit"
            systemImage="pencil"
            onPress={() => router.push(`/lists/${item.listId}/items/${item._id}`)}
          />
        </SwipeActions.Actions>

        <SwipeActions.Actions edge="trailing">
          <ConfirmationDialog title="Delete Item" isPresented={deleteConfirm} onIsPresentedChange={setDeleteConfirm}>
            <ConfirmationDialog.Trigger>
              <UIButton label="Delete" systemImage="trash" role="destructive" onPress={() => setDeleteConfirm(true)} />
            </ConfirmationDialog.Trigger>
            <ConfirmationDialog.Actions>
              <UIButton label="Cancel" onPress={() => setDeleteConfirm(false)} />
              <UIButton label="Delete" role="destructive" onPress={confirmDelete} />
            </ConfirmationDialog.Actions>
          </ConfirmationDialog>
        </SwipeActions.Actions>
      </SwipeActions>
    </Host>
  );
}
