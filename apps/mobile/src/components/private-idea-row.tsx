import { Button as UIButton, ContextMenu, Host, RNHostView } from '@expo/ui/swift-ui';
import { useMutation } from 'convex/react';
import { Lightbulb } from 'lucide-react-native';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@convex/_generated/api';
import { Doc } from '@convex/_generated/dataModel';

// One of your private ideas for someone. Tap to edit; long-press for more.
export default function PrivateIdeaRow({
  idea,
  onEdit,
}: {
  idea: Doc<'privateIdeas'>;
  onEdit: (idea: Doc<'privateIdeas'>) => void;
}) {
  const removeIdea = useMutation(api.privateIdeas.remove);

  const confirmDelete = () =>
    Alert.alert('Delete this idea?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeIdea({ id: idea._id }) },
    ]);

  return (
    <Host matchContents={{ vertical: true }}>
      <ContextMenu>
        <ContextMenu.Items>
          <UIButton label="Edit" systemImage="pencil" onPress={() => onEdit(idea)} />
          <UIButton label="Delete" systemImage="trash" role="destructive" onPress={confirmDelete} />
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          {/* RNHostView lets SwiftUI measure the RN row, so the Host gets its real height
              instead of collapsing and letting the next row draw on top of it.
              onLongPress is a no-op so releasing after opening the menu doesn't also open the editor. */}
          <RNHostView matchContents={{ vertical: true }}>
            <Pressable onPress={() => onEdit(idea)} onLongPress={() => {}}>
              <View className="flex-row gap-3 py-2">
                <View className="size-11 items-center justify-center rounded-lg bg-fill">
                  <Icon as={Lightbulb} size={20} className="text-ink-muted" />
                </View>
                <View className="flex-1 justify-center border-b border-line pb-2">
                  <Text className="text-lg" numberOfLines={1}>
                    {idea.title}
                  </Text>
                  {idea.description && (
                    <Text className="text-sm text-ink-muted" numberOfLines={2}>
                      {idea.description}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          </RNHostView>
        </ContextMenu.Trigger>
      </ContextMenu>
    </Host>
  );
}
