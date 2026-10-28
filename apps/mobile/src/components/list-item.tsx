import { useState } from 'react';
import { View, Text, Image } from 'react-native';
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

export default function ListItem({ item }: { item: ItemWithImage }) {
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
            <View className="flex-row gap-3 py-2">
              {item.imageUrl && (
                <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60, borderRadius: 14 }} />
              )}
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
              </View>
            </View>
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
