import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useEvent } from '@/hooks/events';
import { useUser } from '@/hooks/user';

import { useSecretSanta } from '@/hooks/secret-santa-setup';
import MatchItems from '@/components/secret-santa/match-items';
import GiftReady from '@/components/secret-santa/gift-ready';
import MatchAvatar from '@/components/secret-santa/match-avatar';
import ReviewMatches from '@/components/secret-santa/review-matches';
import { api } from '@convex/_generated/api';

// "just now", "5 min ago", "3 hours ago", "yesterday", "on Mon", "on Nov 2".
export function formatDrawnAt(drawnAt: number, now: number) {
  const minutes = Math.floor((now - drawnAt) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (isToday(drawnAt)) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (isYesterday(drawnAt)) return 'yesterday';
  if (differenceInCalendarDays(now, drawnAt) < 7) return `on ${format(drawnAt, 'EEE')}`;
  return `on ${format(drawnAt, 'MMM d')}`;
}

// The current time, updated every minute, so "5 min ago" stays right.
function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// Where someone in the draw sees their Match once names are sent. The Match
// stays hidden until they tap to reveal it, every time the page opens. In a
// Reviewed draw, hosts also see every Match here, and send the names.
export default function SecretSanta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  const secretSanta = useSecretSanta(event?._id);
  const [revealed, setRevealed] = useState(false);
  const sendNames = useMutation(api.secretSanta.send);
  const [sending, setSending] = useState(false);
  const now = useNow();
  const user = useUser();

  const match = secretSanta?.exists && secretSanta.status === 'sent' ? secretSanta.myAssignment : null;
  // A host's view of a Reviewed draw, once names are drawn.
  const review =
    secretSanta?.exists && secretSanta.isManager && secretSanta.mode === 'reviewed' && secretSanta.status !== 'draft'
      ? secretSanta
      : null;
  const reviewed = !!secretSanta?.exists && secretSanta.mode === 'reviewed';
  const giftProgress = secretSanta?.exists ? secretSanta.giftProgress : null;
  // Once a Reviewed draw is sent, hosts see Gift ready under the Matches,
  // with who has their gift.
  const hostGiftView = review?.status === 'sent';

  // If the draw is undone (or they're no longer on the event) while this is
  // open, there's nothing to show: go back to the event, which explains why.
  const left = useRef(false);
  useEffect(() => {
    if (secretSanta === undefined || match || review || left.current) return;
    left.current = true;
    if (router.canGoBack()) router.back();
  }, [secretSanta, match, review]);

  function confirmSend() {
    if (!event || !review) return;
    Alert.alert(
      'Send the names?',
      'Everyone in the draw gets an email with their match. You can’t change matches after this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              await sendNames({ eventId: event._id });
            } catch (e) {
              Alert.alert(
                'Couldn’t send the names',
                e instanceof ConvexError ? String(e.data) : 'Something went wrong. Try again.',
              );
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }

  const budget = secretSanta?.exists && secretSanta.budget != null ? secretSanta.budget : null;

  return (
    // No bottom edge: the scroll view runs behind the tab bar, and iOS insets
    // its content so the last row can still scroll clear of it.
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
        <View className="flex-0">
          <BackButton />
        </View>
        <Text variant="detail" className="mt-1 flex-1 text-left">
          Secret Santa
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
      >
        {review?.status === 'drawn' && review.drawnAt != null && (
          <View className="gap-1 rounded-2xl bg-surface p-4">
            <Text className="font-semibold">Drawn {formatDrawnAt(review.drawnAt, now)} &middot; Not sent yet</Text>
            <Text className="text-[15px] text-ink-muted">
              Nobody has been told who they have. Make any changes, then send the names.
            </Text>
          </View>
        )}

        {match && (
          <View className="aspect-square w-full items-center justify-center gap-6 rounded-2xl bg-surface pt-6 pb-5 px-5">
            {revealed ? (
              <>
                <MatchAvatar match={match} />
                <View className="items-center gap-1">
                  <Text className="text-[15px] text-ink-muted">You’re giving to</Text>
                  <Text className="text-center font-display-bold text-4xl tracking-tight text-ink">{match.name}</Text>
                  <Text className="text-center text-[15px] text-ink-muted">
                    {reviewed ? 'Keep it secret.' : 'Keep it secret. Not even the hosts know.'}
                  </Text>
                </View>
                <Button variant="secondary" size="lg" className="rounded-pill" onPress={() => setRevealed(false)}>
                  <Text>Hide</Text>
                </Button>
              </>
            ) : (
              <>
                <Image
                  source={require('@/assets/gift-icon.svg')}
                  contentFit="contain"
                  style={{ width: 86, height: 86 }}
                />

                <View className="items-center gap-2">
                  <Text className="text-center font-bold text-2xl tracking-tight text-ink">Names are drawn</Text>
                  <Text className="text-center text-[15px] text-ink-muted leading-6">
                    Tap to see who you’re giving to. Make sure no one’s looking over your shoulder.
                  </Text>
                </View>
                <Button size="lg" className="rounded-pill" onPress={() => setRevealed(true)}>
                  <Text>Reveal my person</Text>
                </Button>
              </>
            )}
          </View>
        )}

        {match && budget != null && <Text className="text-center text-[15px] text-ink-muted">${budget} limit</Text>}

        {match && revealed && <MatchItems eventId={event?._id} match={match} budget={budget} />}

        {!hostGiftView && match && event && giftProgress && (
          <GiftReady
            eventId={event._id}
            matchName={revealed ? match.name : null}
            giftReady={match.giftReady}
            progress={giftProgress}
            reviewed={reviewed}
          />
        )}

        {review && event && (
          <ReviewMatches
            eventId={event._id}
            assignments={review.assignments}
            exclusions={review.exclusions}
            editable={review.status === 'drawn'}
          />
        )}

        {hostGiftView && event && giftProgress && (
          <View className="gap-2">
            <Text className="font-semibold text-ink-muted text-[15px]">Gifts</Text>
            <GiftReady
              eventId={event._id}
              myUserId={user?._id}
              matchName={match && revealed ? match.name : null}
              giftReady={match ? match.giftReady : null}
              progress={giftProgress}
              reviewed
              people={review.assignments.map(a => ({
                userId: a.giverUserId,
                name: a.giverName,
                color: a.giverColor,
                giftReady: a.giftReady,
              }))}
            />
          </View>
        )}

        {review?.status === 'drawn' && (
          <Button size="lg" className="rounded-pill" disabled={sending} onPress={confirmSend}>
            <Text>
              Send names to {review.participants.length} {review.participants.length === 1 ? 'person' : 'people'}
            </Text>
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
