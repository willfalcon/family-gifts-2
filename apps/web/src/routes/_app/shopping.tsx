import { useState, type ReactNode } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { format } from 'date-fns';
import { Gift, Lightbulb } from 'lucide-react';

import { api } from '@convex/_generated/api';
import { confirm, showAlert } from '@/components/alerts';
import { Avatar, Card } from '@/components/avatar';
import { ItemImage } from '@/components/list-items';
import { Page, PageHeader } from '@/components/page';
import { SecretSantaAsk } from '@/components/sheets';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/controls';
import { useGiftShopping, useSetBought, type GiftToGet, type ShoppingClaim } from '@/hooks/data';
import { cn, errorMessage, firstName } from '@/lib/utils';

export const Route = createFileRoute('/_app/shopping')({
  head: () => ({ meta: [{ title: 'Gift Shopping · Family Gifts' }] }),
  component: GiftShopping,
});

type Occasion = GiftToGet['occasion'];
type Suggestions = NonNullable<GiftToGet['suggestions']>;

// "Christmas party · Thu, Dec 25"
function occasionTitle(occasion: Occasion) {
  if (!occasion.date) return occasion.label;
  const [y, m, d] = occasion.date.split('-').map(Number);
  return `${occasion.label} · ${format(new Date(y, m - 1, d), 'EEE, MMM d')}`;
}

// Splits already-sorted Gifts to get into runs by occasion, keeping their order.
function byOccasion(gifts: GiftToGet[]) {
  const sections: { key: string; occasion: Occasion; gifts: GiftToGet[] }[] = [];
  for (const gift of gifts) {
    let section = sections.at(-1);
    if (!section || section.key !== gift.occasion.key) {
      section = { key: gift.occasion.key, occasion: gift.occasion, gifts: [] };
      sections.push(section);
    }
    section.gifts.push(gift);
  }
  return sections;
}

function SectionHeading({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 pt-4">
      <h2 className="text-[15px] font-semibold text-ink-muted">{children}</h2>
      {hint && <p className="text-[13px] text-ink-muted">{hint}</p>}
    </div>
  );
}

function CardLabel({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 pt-1">
      <p className="flex-1 text-[13px] font-semibold tracking-wide text-ink-muted uppercase">{children}</p>
      {action}
    </div>
  );
}

// Everything you're buying: your Claims, your Secret Santa Match, and
// suggestions for the people you haven't claimed anything for yet.
function GiftShopping() {
  const data = useGiftShopping();
  const empty = data && !data.upcoming.length && !data.justIdeas.length && !data.recent.length;
  return (
    <Page className="gap-3">
      <PageHeader title="Gift Shopping" />
      {data && !empty && (
        <p className="text-[15px] text-ink-muted">
          Everyone you’re getting a gift for. Tick things off as you buy them, and claim something for anyone who still
          needs a gift.
        </p>
      )}
      {empty && (
        <div className="flex flex-col items-center gap-2 pt-8 text-center">
          <p className="text-lg font-semibold">Nobody to shop for yet</p>
          <p className="text-ink-muted">
            When you’re going to an event, the people there with a list for it show up here.
          </p>
        </div>
      )}
      {data &&
        byOccasion(data.upcoming).map(section => (
          <section key={section.key} className="flex flex-col gap-3">
            <SectionHeading>{occasionTitle(section.occasion)}</SectionHeading>
            {section.gifts.map(gift => (
              <GiftCard key={gift.key} gift={gift} />
            ))}
          </section>
        ))}
      {data && data.justIdeas.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading hint="Things you claimed from lists that aren’t for a particular occasion.">
            Just ideas
          </SectionHeading>
          {data.justIdeas.map(({ person, claims }) => (
            <Card key={person.userId}>
              <PersonHeader person={person} />
              <ClaimList claims={claims} />
            </Card>
          ))}
        </section>
      )}
      {data && data.recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading hint="These drop off a week after the day. Unclaim anything you didn’t end up getting.">
            Already happened
          </SectionHeading>
          {data.recent.map(gift => (
            <GiftCard key={gift.key} gift={gift} showOccasion />
          ))}
        </section>
      )}
    </Page>
  );
}

function PersonHeader({
  person,
  badge,
  detail,
}: {
  person: { name: string; color: string };
  badge?: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar person={person} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{person.name}</p>
        {detail && <p className="text-[13px] text-ink-muted">{detail}</p>}
      </div>
      {badge && <span className="shrink-0 rounded-pill bg-fill px-3 py-1 text-[13px] font-semibold">{badge}</span>}
    </div>
  );
}

// One person on one occasion.
function GiftCard({ gift, showOccasion = false }: { gift: GiftToGet; showOccasion?: boolean }) {
  // A Match stays hidden until clicked, so nobody sees it over your shoulder.
  const [revealed, setRevealed] = useState(false);
  const detail = showOccasion ? occasionTitle(gift.occasion) : undefined;

  if (gift.match && !revealed) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-fill">
            <Gift className="size-[18px] text-ink-muted" />
          </span>
          <div className="flex-1">
            <p className="text-[17px] font-semibold">Your Secret Santa</p>
            <p className="text-[13px] text-ink-muted">
              {detail ? `${detail} · ` : ''}Click Show to see who you’re giving to
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setRevealed(true)}>
            Show
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <PersonHeader person={gift.person} badge={gift.match ? 'Secret Santa' : undefined} detail={detail} />
      {gift.match && <MatchDetails gift={gift} onHide={() => setRevealed(false)} />}
      {gift.claims.length > 0 && <ClaimList claims={gift.claims} gift={gift} />}
      {gift.suggestions && <SuggestionList gift={gift} suggestions={gift.suggestions} />}
    </Card>
  );
}

function MatchDetails({ gift, onHide }: { gift: GiftToGet; onHide: () => void }) {
  const setGiftReady = useMutation(api.secretSanta.setGiftReady);
  const match = gift.match!;
  const eventId = gift.occasion.eventId;
  const label = `I have ${firstName(gift.person.name)}’s gift`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[15px] text-ink-muted">
          {match.budget != null
            ? `You’ve claimed $${match.claimedTotal} of the $${match.budget} limit`
            : 'No spending limit'}
        </p>
        <button type="button" onClick={onHide} className="text-[15px] text-accent hover:underline">
          Hide
        </button>
      </div>
      {eventId && (
        <label className="flex items-center justify-between rounded-xl bg-fill px-3 py-2">
          <span className="flex-1 pr-3">{label}</span>
          <Switch
            aria-label={label}
            checked={match.giftReady}
            onCheckedChange={checked => void setGiftReady({ eventId, giftReady: checked })}
          />
        </label>
      )}
      {eventId && <SecretSantaAsk eventId={eventId} />}
    </div>
  );
}

// Your Claims for someone, under a label saying what the checkboxes do.
function ClaimList({ claims, gift }: { claims: ShoppingClaim[]; gift?: GiftToGet }) {
  const allBought = claims.every(c => c.bought);
  return (
    <div className="flex flex-col gap-3">
      <CardLabel>{allBought ? 'You’ve bought everything you claimed' : 'You claimed · tick when bought'}</CardLabel>
      {claims.map(claim => (
        <ClaimRow key={claim.itemId} claim={claim} gift={gift} />
      ))}
    </div>
  );
}

function ClaimRow({ claim, gift }: { claim: ShoppingClaim; gift?: GiftToGet }) {
  const setBought = useSetBought();
  const setGiftReady = useMutation(api.secretSanta.setGiftReady);
  const detail = [
    claim.quantity > 1 ? `${claim.quantity} claimed` : null,
    claim.price != null ? `$${claim.price}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function toggle(bought: boolean) {
    try {
      await setBought({ itemId: claim.itemId, bought });
    } catch (e) {
      showAlert(errorMessage(e, 'Couldn’t update this item.'));
      return;
    }
    // Your gift might not come from their list, so only ask.
    const eventId = gift?.occasion.eventId;
    if (bought && gift?.match && !gift.match.giftReady && eventId) {
      const ok = await confirm({
        title: 'Mark your Secret Santa gift ready?',
        confirmText: 'Mark ready',
        cancelText: 'Not yet',
      });
      if (ok) void setGiftReady({ eventId, giftReady: true });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Checkbox
        aria-label={`Bought ${claim.name}`}
        checked={claim.bought}
        onCheckedChange={checked => void toggle(checked === true)}
      />
      <Link
        to="/lists/$id/items/$itemId"
        params={{ id: claim.listId, itemId: claim.itemId }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <ItemImage url={claim.imageUrl} muted={claim.bought} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[17px]', claim.bought && 'text-ink-muted line-through')}>
            {claim.name}
          </span>
          {detail && <span className="block text-[13px] text-ink-muted">{detail}</span>}
        </span>
      </Link>
    </div>
  );
}

// For someone you haven't claimed anything for: what's still open on their
// lists, then your Private ideas for them.
function SuggestionList({ gift, suggestions }: { gift: GiftToGet; suggestions: Suggestions }) {
  const name = firstName(gift.person.name);
  const { items, moreItems, allClaimed, listId, privateIdeas } = suggestions;
  const nothing = !items.length && !privateIdeas.length && !allClaimed;
  return (
    <div className="flex flex-col gap-3">
      <CardLabel
        action={
          listId && (
            <Link to="/lists/$id" params={{ id: listId }} className="text-[15px] text-accent hover:underline">
              {moreItems > 0 ? `See all · ${moreItems} more` : 'See list'}
            </Link>
          )
        }
      >
        {items.length > 0 ? 'Still needs a gift · pick one to claim' : 'Still needs a gift'}
      </CardLabel>
      {allClaimed && (
        <p className="text-[15px] text-ink-muted">
          Everything on {name}’s list is already claimed by someone else.
          {privateIdeas.length > 0 ? ' Here are your own ideas for them.' : ''}
        </p>
      )}
      {nothing && <p className="text-[15px] text-ink-muted">{name} hasn’t added anything to their list yet.</p>}
      {items.map(item => (
        <SuggestionRow key={item.itemId} item={item} />
      ))}
      {privateIdeas.length > 0 && items.length > 0 && <CardLabel>Your private ideas</CardLabel>}
      {privateIdeas.map(idea => (
        <div key={idea._id} className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-fill">
            <Lightbulb className="size-5 text-ink-muted" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px]">{idea.title}</p>
            <p className="truncate text-[13px] text-ink-muted">{idea.description ?? 'Your private idea'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionRow({ item }: { item: Suggestions['items'][number] }) {
  const claim = useMutation(api.claims.claim);
  const [busy, setBusy] = useState(false);
  const detail = [
    item.wanted > 1 ? `${item.left} of ${item.wanted} still needed` : null,
    item.price != null ? `$${item.price}` : null,
    item.fromIdeas ? item.listTitle : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function claimIt() {
    setBusy(true);
    try {
      await claim({ itemId: item.itemId, quantity: 1 });
    } catch (e) {
      showAlert(errorMessage(e, 'Couldn’t claim this.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/lists/$id/items/$itemId"
        params={{ id: item.listId, itemId: item.itemId }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <ItemImage url={item.imageUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px]">{item.name}</span>
          {detail && <span className="block truncate text-[13px] text-ink-muted">{detail}</span>}
        </span>
      </Link>
      <Button variant="secondary" size="sm" disabled={busy} onClick={claimIt}>
        Claim
      </Button>
    </div>
  );
}
