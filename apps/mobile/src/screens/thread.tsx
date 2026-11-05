import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowUp, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, useWindowDimensions, View } from 'react-native';
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
  type KeyboardChatScrollViewRef,
} from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import GlassButton from '@/components/glass-button';
import { makeListHref, ThreadAvatar, threadTitle } from '@/components/thread-row';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { localToday } from '@/hooks/events';
import { useHideTabBar } from '@/hooks/tab-bar';
import { cn } from '@/lib/utils';
import { api } from '@convex/_generated/api';
import { colors } from '@family-gifts/design-tokens';

// One Thread: its messages, a way to make the list an open Ask is asking
// for, and a box to reply.
export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useQuery(api.threads.get, { id, today: localToday() });
  const markRead = useMutation(api.threads.markRead);
  const send = useMutation(api.threads.send);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<KeyboardChatScrollViewRef>(null);
  const insets = useSafeAreaInsets();
  // The message box sits at the bottom of the screen and rides on the
  // keyboard, like Messages, so the tab bar is out of the way here.
  useHideTabBar();
  // The widest a bubble gets: the screen less its side padding (32), the
  // avatar and its gap (40), and room left empty on the other side (48).
  const bubbleMaxWidth = useWindowDimensions().width - 120;

  // Reading the Thread clears its unread count, including for messages that
  // arrive while it's open.
  const lastMessageId = thread?.messages.at(-1)?._id;
  useEffect(() => {
    if (thread?._id) markRead({ id: thread._id }).catch(() => {});
  }, [thread?._id, lastMessageId]);

  if (thread === null) {
    return (
      <SafeAreaView className="flex-1 gap-6 bg-background p-4">
        <BackButton />
        <Text className="text-center text-ink-muted">This conversation doesn’t exist or you’re not in it.</Text>
      </SafeAreaView>
    );
  }

  const title = thread ? threadTitle(thread) : '';

  const submit = async () => {
    if (!thread || sending || !draft.trim()) return;
    setSending(true);
    try {
      await send({ id: thread._id, body: draft });
      setDraft('');
    } catch (e) {
      Alert.alert('Couldn’t send', e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2 p-4">
        <BackButton />
        <Text variant="detail" className="mt-1 flex-1 text-left">
          {title}
        </Text>
      </View>

      {thread?.secretSanta === 'giver' && (
        <Text className="mx-4 mb-2 text-center text-footnote text-ink-muted">
          {thread.others[0]?.firstName ?? 'They'} won’t see your name.
        </Text>
      )}

      {thread?.openAsks.map(ask => (
        <View key={ask.groupKey} className="mx-4 mb-2 flex-row items-center gap-3 rounded-xl bg-fill p-3">
          <Text className="flex-1 text-subhead">
            {ask.label ? `Asked for ideas for ${ask.label}` : 'Asked for ideas'}
          </Text>
          <Link href={makeListHref(ask)} asChild>
            <Button variant="secondary" size="sm" className="rounded-pill">
              <Icon as={Plus} size={16} strokeWidth={2.5} className="text-accent" />
              <Text className="text-accent">Make a list</Text>
            </Button>
          </Link>
        </View>
      ))}

      {/* Swiping down drags the keyboard away, and the messages lift with it.
            `offset` is the bottom safe area: the keyboard covers it, so the
            messages only need to move by the rest of the keyboard's height. */}
      <KeyboardChatScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pb-4"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        offset={insets.bottom}
      >
        {thread?.messages.map(message => {
          if (message.kind === 'listMade') {
            return (
              <Text key={message._id} className="my-2 text-center text-subhead text-ink-muted">
                {message.text}
              </Text>
            );
          }
          const author = message.mine ? thread.me : thread.others.find(o => o.userId === message.authorId);
          return (
            <View
              key={message._id}
              className={cn('w-full flex-row items-end gap-2', message.mine ? 'justify-end' : 'justify-start')}
            >
              {!message.mine && <ThreadAvatar person={author} />}
              <View className="shrink gap-1" style={{ maxWidth: bubbleMaxWidth }}>
                {message.askLabel && (
                  <Text className={cn('text-footnote text-ink-muted', message.mine && 'text-right')}>
                    Asked for ideas · {message.askLabel}
                  </Text>
                )}
                {/* The corner nearest the avatar is tighter, pointing at who sent it. */}
                <View
                  className={cn(
                    'rounded-2xl px-3 py-2',
                    message.mine ? 'self-end rounded-br-md bg-accent' : 'self-start rounded-bl-md bg-fill',
                  )}
                >
                  <Text className={cn('shrink', message.mine && 'text-accent-foreground')}>{message.text}</Text>
                </View>
              </View>
              {message.mine && <ThreadAvatar person={author} />}
            </View>
          );
        })}
      </KeyboardChatScrollView>

      {/* Follows the keyboard frame by frame. Its bottom padding clears the
            home indicator; with the keyboard up that's not needed, so it moves
            back down by that much. */}
      <KeyboardStickyView offset={{ opened: insets.bottom }} style={{ paddingBottom: insets.bottom }}>
        {thread &&
          (thread.canSend ? (
            <View className="flex-row items-center gap-2 border-t border-line bg-background px-4 pb-4 pt-3">
              {/* Single line, so the keyboard's return key sends. "submit" keeps
                  the keyboard up for the next message. */}
              <Input
                className="mb-0 w-auto flex-1 rounded-pill"
                placeholder="Message"
                value={draft}
                onChangeText={setDraft}
                accessibilityLabel="Message"
                returnKeyType="send"
                submitBehavior="submit"
                onSubmitEditing={submit}
              />
              <GlassButton
                accessibilityLabel="Send"
                glassProps={{ tintColor: colors.accent }}
                onPress={submit}
                disabled={sending || !draft.trim()}
              >
                <Icon as={ArrowUp} size={18} className="text-accent-foreground" />
              </GlassButton>
            </View>
          ) : (
            <Text className="border-t border-line px-4 pb-4 pt-3 text-center text-subhead text-ink-muted">
              {thread.cantSend}
            </Text>
          ))}
      </KeyboardStickyView>
    </View>
  );
}
