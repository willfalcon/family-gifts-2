import { SwipeActions, Button as UIButton, ContextMenu } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import type { FunctionReturnType } from 'convex/server';
import { formatRelativeDay, formatWhen } from '@shared/event-dates';
import { format, isValid, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { Calendar, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { api } from '@convex/_generated/api';
import { isHostRole, useEventActions } from '@/hooks/event-actions';
import { useRowTap } from '@/hooks/row-tap';
import { LIST_ROW_MODIFIERS, RNRowContent } from './native-list';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

export type EventRow = FunctionReturnType<typeof api.events.myEvents>[number];

// A row of a NativeList on the Events screen. Swipe right to edit (hosts),
// swipe left to archive or delete (owner). Press and hold for every action,
// including cancelling the event. Swipe buttons are tinted rather than
// role="destructive", which would make SwiftUI animate the row away before
// the delete is confirmed.
export default function EventListItem({ event, past = false }: { event: EventRow; past?: boolean }) {
  const router = useRouter();
  const { confirmCancel, restore, archive, unarchive, confirmDelete } = useEventActions(event);
  const rowTap = useRowTap(() => router.push({ pathname: '/(app)/(events)/events/[id]', params: { id: event._id } }));

  const isHost = isHostRole(event.myRole);
  const isOwner = event.myRole === 'owner';
  const cancelled = event.cancelledAt !== undefined;
  const muted = past || cancelled || event.archived;

  // "in 12 days" for upcoming events; past and cancelled ones just show their date.
  const relative = event.date && !muted ? formatRelativeDay(event.date) : null;
  // parseISO reads "YYYY-MM-DD" as local midnight, so the day doesn't shift.
  const parsed = event.date ? parseISO(event.date) : null;
  const start = parsed && isValid(parsed) ? parsed : null;

  const edit = () => router.push({ pathname: '/(app)/(events)/events/[id]/edit', params: { id: event._id } });
  const archiveButton = event.archived ? (
    <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={unarchive} />
  ) : (
    <UIButton label="Archive" systemImage="archivebox" modifiers={[tint('indigo')]} onPress={archive} />
  );

  return (
    <SwipeActions modifiers={LIST_ROW_MODIFIERS}>
      <ContextMenu>
        <ContextMenu.Items>
          {isHost && <UIButton label="Edit" systemImage="pencil" onPress={edit} />}
          {event.archived ? (
            <UIButton label="Unarchive" systemImage="tray.and.arrow.up" onPress={unarchive} />
          ) : (
            <UIButton label="Archive" systemImage="archivebox" onPress={archive} />
          )}
          {isHost &&
            (cancelled ? (
              <UIButton label="Restore event" systemImage="arrow.uturn.backward" onPress={restore} />
            ) : (
              <UIButton label="Cancel event" systemImage="xmark.circle" role="destructive" onPress={confirmCancel} />
            ))}
          {isOwner && <UIButton label="Delete event" systemImage="trash" role="destructive" onPress={confirmDelete} />}
        </ContextMenu.Items>
        <ContextMenu.Trigger>
          <RNRowContent>
            <Pressable {...rowTap} className="flex-row items-center gap-3 py-1">
              <View className="w-11 items-center justify-center">
                {start ? (
                  <>
                    <Text className="text-[11px] leading-[13px] font-semibold text-ink-muted">
                      {format(start, 'EEE')}
                    </Text>
                    <Text className="text-[22px] leading-[26px] font-semibold text-ink-muted">
                      {format(start, 'd')}
                    </Text>
                  </>
                ) : (
                  <Icon as={Calendar} size={20} className="text-ink-muted" />
                )}
              </View>
              <View className="flex-1 flex-row items-center justify-between gap-2 border-b border-line pb-3 pt-2">
                <View className="flex-1">
                  <Text className={muted ? 'text-ink-muted font-semibold' : 'font-semibold'}>
                    <Text className={cancelled ? 'line-through' : ''}>{event.name}</Text>
                  </Text>
                  <Text className="text-ink-muted text-sm">
                    {cancelled ? `Cancelled · ${formatWhen(event)}` : formatWhen(event)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  {relative && <Text className="text-accent text-sm">{relative}</Text>}
                  <Icon as={ChevronRight} size={16} className="text-ink-faint" />
                </View>
              </View>
            </Pressable>
          </RNRowContent>
        </ContextMenu.Trigger>
      </ContextMenu>
      {isHost && (
        <SwipeActions.Actions edge="leading" allowsFullSwipe={false}>
          <UIButton label="Edit" systemImage="pencil" onPress={edit} />
        </SwipeActions.Actions>
      )}
      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        {isOwner && (
          <UIButton label="Delete" systemImage="trash" modifiers={[tint('red')]} onPress={confirmDelete} />
        )}
        {archiveButton}
      </SwipeActions.Actions>
    </SwipeActions>
  );
}
