import { Cake, ChevronRight, TreePine, Calendar, Gift } from 'lucide-react-native';
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
import type { FunctionReturnType } from 'convex/server';
import { useRouter } from 'expo-router';
import { Pressable, View, type GestureResponderEvent } from 'react-native';

import { api } from '@convex/_generated/api';
import { Text } from './ui/text';
import { useListShares } from '@/hooks/lists';
import { formatOccasionDate } from '@/screens/list';
import { Icon } from './ui/icon';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';

// How far (in points) the finger can move before a touch counts as a swipe instead of a tap.
const TAP_SLOP = 10;

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

  // The native swipe moves the row along with the finger, so React Native never sees the
  // touch leave the row and would treat a partial swipe as a tap. Track the start point
  // in screen coordinates and ignore the press if the finger traveled.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onPressIn = (e: GestureResponderEvent) => {
    touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
  };
  const onPress = (e: GestureResponderEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (
      start &&
      (Math.abs(e.nativeEvent.pageX - start.x) > TAP_SLOP || Math.abs(e.nativeEvent.pageY - start.y) > TAP_SLOP)
    ) {
      return;
    }
    router.push({ pathname: '/(app)/(lists)/lists/[id]', params: { id: _id } });
  };
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

  return (
    <Host>
      <SwipeActions>
        <ContextMenu>
          <ContextMenu.Items>
            <UIButton
              label="Edit"
              systemImage="pencil"
              onPress={() => {
                router.push({ pathname: '/(app)/(lists)/lists/[id]/edit', params: { id: _id } });
              }}
            />
            {archived ? (
              <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={() => unarchiveList({ id: _id })} />
            ) : (
              <UIButton
                label="Archive"
                systemImage="archivebox"
                role="destructive"
                onPress={() => {
                  setArchiveConfirm(true);
                }}
              />
            )}
          </ContextMenu.Items>
          <ContextMenu.Trigger>
            {/* onLongPress is a no-op so releasing after opening the context menu doesn't also navigate. */}
            <Pressable onPressIn={onPressIn} onPress={onPress} onLongPress={() => {}}>
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
          </ContextMenu.Trigger>
        </ContextMenu>
        <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
          <UIButton
            label="Edit"
            systemImage="pencil"
            onPress={() => {
              router.push({ pathname: '/(app)/(lists)/lists/[id]/edit', params: { id: _id } });
            }}
          />
        </SwipeActions.Actions>
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          {archived ? (
            <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={() => unarchiveList({ id: _id })} />
          ) : (
            <ConfirmationDialog
              title="Archive List"
              isPresented={archiveConfirm}
              onIsPresentedChange={setArchiveConfirm}
            >
              <ConfirmationDialog.Trigger>
                <UIButton
                  label="Archive"
                  systemImage="archivebox"
                  role="destructive"
                  onPress={() => setArchiveConfirm(true)}
                />
              </ConfirmationDialog.Trigger>
              <ConfirmationDialog.Actions>
                <UIButton label="Cancel" onPress={() => setArchiveConfirm(false)} />
                <UIButton label="Archive" role="destructive" onPress={confirmArchive} />
              </ConfirmationDialog.Actions>
            </ConfirmationDialog>
          )}
        </SwipeActions.Actions>
      </SwipeActions>
    </Host>
  );
}
