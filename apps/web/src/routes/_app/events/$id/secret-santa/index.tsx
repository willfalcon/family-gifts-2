import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns';

import { api } from '@convex/_generated/api';
import { confirm, showError } from '@/components/alerts';
import { Card } from '@/components/avatar';
import { Page, PageHeader, Section } from '@/components/page';
import { GiftReady, MatchAvatar, MatchItems, ReviewMatches } from '@/components/secret-santa';
import { SecretSantaAsk } from '@/components/sheets';
import { Button } from '@/components/ui/button';
import { useEvent, useSecretSanta, useUser } from '@/hooks/data';

export const Route = createFileRoute('/_app/events/$id/secret-santa/')({
  head: () => ({ meta: [{ title: 'Secret Santa · Family Gifts' }] }),
  component: SecretSanta,
});

// "just now", "5 min ago", "3 hours ago", "yesterday", "on Mon", "on Nov 2".
function formatDrawnAt(drawnAt: number, now: number) {
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
// stays hidden until they reveal it, every time the page opens. In a Reviewed
// draw, hosts also see every Match here, and send the names. Ported from
// apps/mobile/src/screens/secret-santa.tsx.
function SecretSanta() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
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
  // open, or there's nothing to see yet, go to the event, which explains why.
  const left = useRef(false);
  useEffect(() => {
    if (event === undefined || (event && secretSanta === undefined) || match || review || left.current) return;
    left.current = true;
    navigate({ to: event ? '/events/$id' : '/events', params: { id }, replace: true });
  }, [event, secretSanta, match, review, navigate, id]);

  async function confirmSend() {
    if (!event || !review) return;
    const ok = await confirm({
      title: 'Send the names?',
      message: 'Everyone in the draw gets an email with their match. You can’t change matches after this.',
      confirmText: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      await sendNames({ eventId: event._id });
    } catch (e) {
      void showError('Couldn’t send the names', e);
    } finally {
      setSending(false);
    }
  }

  const budget = secretSanta?.exists && secretSanta.budget != null ? secretSanta.budget : null;

  return (
    <Page className="gap-4">
      <PageHeader title="Secret Santa" fallback="/events" subtitle={event?.name} />

      {review?.status === 'drawn' && review.drawnAt != null && (
        <Card className="gap-1">
          <p className="font-semibold">Drawn {formatDrawnAt(review.drawnAt, now)} · Not sent yet</p>
          <p className="text-[15px] text-ink-muted">
            Nobody has been told who they have. Make any changes, then send the names.
          </p>
        </Card>
      )}

      {match && (
        <Card className="aspect-square w-full items-center justify-center gap-6 px-5 pt-6 pb-5 sm:aspect-[4/3]">
          {revealed ? (
            <>
              <MatchAvatar match={match} />
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-[15px] text-ink-muted">You’re giving to</p>
                <p className="font-display-bold text-4xl tracking-tight text-ink">{match.name}</p>
                <p className="text-[15px] text-ink-muted">
                  {reviewed ? 'Keep it secret.' : 'Keep it secret. Not even the hosts know.'}
                </p>
              </div>
              <Button variant="secondary" size="lg" onClick={() => setRevealed(false)}>
                Hide
              </Button>
            </>
          ) : (
            <>
              <img src="/gift-icon.svg" alt="" width={86} height={86} />
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-2xl font-bold tracking-tight text-ink">Names are drawn</p>
                <p className="max-w-sm text-[15px] leading-6 text-ink-muted">
                  Click to see who you’re giving to. Make sure no one’s looking over your shoulder.
                </p>
              </div>
              <Button size="lg" onClick={() => setRevealed(true)}>
                Reveal my person
              </Button>
            </>
          )}
        </Card>
      )}

      {match && budget != null && <p className="text-center text-[15px] text-ink-muted">${budget} limit</p>}

      {match && revealed && <MatchItems eventId={event?._id} match={match} budget={budget} />}

      {match && revealed && event && <SecretSantaAsk eventId={event._id} />}

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
        <Section title="Gifts">
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
        </Section>
      )}

      {review?.status === 'drawn' && (
        <Button size="lg" disabled={sending} onClick={() => void confirmSend()}>
          Send names to {review.participants.length} {review.participants.length === 1 ? 'person' : 'people'}
        </Button>
      )}
    </Page>
  );
}
