import { Cake, ChevronRight, TreePine, Calendar, Gift } from 'lucide-react-native';
import { SwipeActions, Button as UIButton, ConfirmationDialog, ContextMenu } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import type { FunctionReturnType } from 'convex/server';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { api } from '@convex/_generated/api';
import { Text } from './ui/text';
import { useListShares } from '@/hooks/lists';
import { LIST_ROW_MODIFIERS, RNRowContent } from './native-list';
import { formatOccasionDate } from '@/lib/occasion';
import { Icon } from './ui/icon';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useRowTap } from '@/hooks/row-tap';

type ListRow = FunctionReturnType<typeof api.lists.myLists>[number];

function getListIcon(occasion: ListRow['occasion']) {
  switch (occasion?.kind) {
    case 'event':
      return Calendar;
    case 'birthday':
      return Cake;
    case 'christmas':
      return TreePine;
    default:
      return Gift;
  }
}

export default function ListListItem({
  title,
  itemCount,
  _id,
  occasion,
  occasionEventName,
  occasionEventDate,
  archived = false,
}: ListRow & { archived?: boolean }) {
  const listShares = useListShares(_id);
  const sharedWithGroups = listShares?.filter(share => share.kind === 'group');
  const router = useRouter();
  const archiveList = useMutation(api.lists.archive);
  const unarchiveList = useMutation(api.lists.unarchive);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const rowTap = useRowTap(() => router.push({ pathname: '/(app)/(my-lists)/lists/[id]', params: { id: _id } }));
  let details = [];
  if (occasionEventName) {
    details.push(occasionEventName);
  }
  if (occasionEventDate) {
    details.push(formatOccasionDate(occasionEventDate));
  }
  if (sharedWithGroups && sharedWithGroups.length > 0) {
    details.push(`Shared with ${sharedWithGroups.length} group${sharedWithGroups.length > 1 ? 's' : ''}`);
  }

  const icon = getListIcon(occasion);

  const confirmArchive = () => {
    archiveList({ id: _id });
    setArchiveConfirm(false);
  };

  const edit = () => router.push({ pathname: '/(app)/(my-lists)/lists/[id]/edit', params: { id: _id } });
  const unarchive = () => unarchiveList({ id: _id });

  // A row of a NativeList. The archive dialog hangs off the row, not the swipe
  // button, so it stays up after SwiftUI closes the swipe. Swipe buttons are
  // tinted red rather than role="destructive", which would make SwiftUI
  // animate the row away before the archive is confirmed.
  return (
    <SwipeActions modifiers={LIST_ROW_MODIFIERS}>
      <ConfirmationDialog title="Archive List" isPresented={archiveConfirm} onIsPresentedChange={setArchiveConfirm}>
        <ConfirmationDialog.Trigger>
          <ContextMenu>
            <ContextMenu.Items>
              <UIButton label="Edit" systemImage="pencil" onPress={edit} />
              {archived ? (
                <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={unarchive} />
              ) : (
                <UIButton
                  label="Archive"
                  systemImage="archivebox"
                  role="destructive"
                  onPress={() => setArchiveConfirm(true)}
                />
              )}
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              <RNRowContent>
                <Pressable {...rowTap}>
                  <View className="flex-row items-center gap-3 py-1">
                    <View className="bg-fill rounded-lg size-11 items-center justify-center">
                      <Icon as={icon} size={20} className="text-ink-muted" />
                    </View>
                    <View className="flex-1 border-b pb-3 flex-row justify-between items-center w-full border-line pt-2">
                      <View className="">
                        <Text className="font-semibold text-button-lg">{title}</Text>
                        {details.length > 0 && <Text className="text-ink-muted text-sm">{details.join(' • ')}</Text>}
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Text className="text-ink-muted">{itemCount}</Text>
                        <ChevronRight className="text-ink-faint size-4" />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </RNRowContent>
            </ContextMenu.Trigger>
          </ContextMenu>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <UIButton label="Cancel" onPress={() => setArchiveConfirm(false)} />
          <UIButton label="Archive" role="destructive" onPress={confirmArchive} />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
      <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
        <UIButton label="Edit" systemImage="pencil" onPress={edit} />
      </SwipeActions.Actions>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        {archived ? (
          <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={unarchive} />
        ) : (
          <UIButton
            label="Archive"
            systemImage="archivebox"
            modifiers={[tint('red')]}
            onPress={() => setArchiveConfirm(true)}
          />
        )}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
