import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { Gift, Lightbulb } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useItemDetailsHref } from '@/hooks/claims';
import { useGiftShopping, useSetBought, type GiftToGet, type ShoppingClaim } from '@/hooks/gift-shopping';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/screens/secret-santa-setup';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Occasion = GiftToGet['occasion'];
type Suggestions = NonNullable<GiftToGet['suggestions']>;

const IMAGE_SIZE = 44;

function firstName(name: string) {
  return name.split(' ')[0];
}

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
    <View className="gap-0.5 pt-4">
      <Text className="font-semibold text-[15px] text-ink-muted">{children}</Text>
      {hint && <Text className="text-[13px] text-ink-muted">{hint}</Text>}
    </View>
  );
}

// A small label inside a card, saying what that part is for. `action` sits
// on the right, e.g. a "See list" link.
function CardLabel({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <View className="flex-row items-baseline justify-between gap-2 pt-1">
      <Text className="flex-1 font-semibold text-[13px] uppercase tracking-wide text-ink-muted">{children}</Text>
      {action}
    </View>
  );
}

// Everything you're buying: your Claims, your Secret Santa Match, and
// suggestions for the people you haven't claimed anything for yet.
export default function GiftShoppingScreen() {
  const data = useGiftShopping();
  const empty = data && !data.upcoming.length && !data.justIdeas.length && !data.recent.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
        <View className="flex-0">
          <BackButton />
        </View>
        <Text variant="detail" className="mt-1 flex-1 text-left">
          Gift Shopping
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-8" contentInsetAdjustmentBehavior="automatic">
        {data && !empty && (
          <Text className="text-[15px] text-ink-muted">
            Everyone you’re getting a gift for. Tick things off as you buy them, and claim something for anyone who
            still needs a gift.
          </Text>
        )}

        {empty && (
          <View className="items-center gap-2 pt-8">
            <Text className="font-semibold text-lg">Nobody to shop for yet</Text>
            <Text className="text-center text-ink-muted">
              When you’re going to an event, the people there with a list for it show up here.
            </Text>
          </View>
        )}

        {data &&
          byOccasion(data.upcoming).map(section => (
            <View key={section.key} className="gap-3">
              <SectionHeading>{occasionTitle(section.occasion)}</SectionHeading>
              {section.gifts.map(gift => (
                <GiftCard key={gift.key} gift={gift} />
              ))}
            </View>
          ))}

        {data && data.justIdeas.length > 0 && (
          <View className="gap-3">
            <SectionHeading hint="Things you claimed from lists that aren’t for a particular occasion.">
              Just ideas
            </SectionHeading>
            {data.justIdeas.map(({ person, claims }) => (
              <Card key={person.userId}>
                <PersonHeader person={person} />
                <ClaimList claims={claims} />
              </Card>
            ))}
          </View>
        )}

        {data && data.recent.length > 0 && (
          <View className="gap-3">
            <SectionHeading hint="These drop off a week after the day. Unclaim anything you didn’t end up getting.">
              Already happened
            </SectionHeading>
            {data.recent.map(gift => (
              <GiftCard key={gift.key} gift={gift} showOccasion />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="gap-3 rounded-2xl bg-surface p-4">{children}</View>;
}

function PersonHeader({
  person,
  badge,
  detail,
}: {
  person: { name: string; color: GiftToGet['person']['color'] };
  badge?: string;
  detail?: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <PersonAvatar person={person} size={36} />
      <View className="flex-1">
        <Text className="font-semibold text-[17px]" numberOfLines={1}>
          {person.name}
        </Text>
        {detail && <Text className="text-[13px] text-ink-muted">{detail}</Text>}
      </View>
      {badge && (
        <View className="shrink-0 rounded-pill bg-fill px-3 py-1">
          <Text className="text-[13px] font-semibold" numberOfLines={1}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

// One person on one occasion.
function GiftCard({ gift, showOccasion = false }: { gift: GiftToGet; showOccasion?: boolean }) {
  // A Match stays hidden until tapped, like on the Secret Santa page, so
  // nobody sees it over your shoulder.
  const [revealed, setRevealed] = useState(false);
  const detail = showOccasion ? occasionTitle(gift.occasion) : undefined;

  if (gift.match && !revealed) {
    return (
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="size-9 items-center justify-center rounded-full bg-fill">
            <Icon as={Gift} size={18} className="text-ink-muted" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-[17px]">Your Secret Santa</Text>
            <Text className="text-[13px] text-ink-muted">
              {detail ? `${detail} · ` : ''}Tap Show to see who you’re giving to
            </Text>
          </View>
          <Button variant="secondary" size="sm" className="rounded-pill" onPress={() => setRevealed(true)}>
            <Text>Show</Text>
          </Button>
        </View>
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
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] text-ink-muted">
          {match.budget != null
            ? `You’ve claimed $${match.claimedTotal} of the $${match.budget} limit`
            : 'No spending limit'}
        </Text>
        <Pressable onPress={onHide} hitSlop={8}>
          <Text className="text-[15px] text-accent">Hide</Text>
        </Pressable>
      </View>
      {eventId && (
        <View className="flex-row items-center justify-between rounded-xl bg-fill px-3 py-2">
          <Text className="flex-1 pr-3">{label}</Text>
          <Switch
            aria-label={label}
            checked={match.giftReady}
            onCheckedChange={checked => void setGiftReady({ eventId, giftReady: checked })}
          />
        </View>
      )}
    </View>
  );
}

function ItemImage({ url, muted }: { url: string | null; muted?: boolean }) {
  return (
    <View className={muted ? 'opacity-50' : undefined}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 10 }} />
      ) : (
        <View
          className="items-center justify-center rounded-[10px] bg-fill"
          style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
        >
          <Icon as={Gift} size={20} className="text-ink-muted" />
        </View>
      )}
    </View>
  );
}

// Your Claims for someone, under a label saying what the checkboxes do.
function ClaimList({ claims, gift }: { claims: ShoppingClaim[]; gift?: GiftToGet }) {
  const allBought = claims.every(c => c.bought);
  return (
    <View className="gap-3">
      <CardLabel>{allBought ? 'You’ve bought everything you claimed' : 'You claimed · tick when bought'}</CardLabel>
      {claims.map(claim => (
        <ClaimRow key={claim.itemId} claim={claim} gift={gift} />
      ))}
    </View>
  );
}

// One of your Claims, with its Bought checkbox. Tapping the item opens it.
function ClaimRow({ claim, gift }: { claim: ShoppingClaim; gift?: GiftToGet }) {
  const detailsHref = useItemDetailsHref();
  const setBought = useSetBought();
  const setGiftReady = useMutation(api.secretSanta.setGiftReady);
  const detail = [claim.quantity > 1 ? `${claim.quantity} claimed` : null, claim.price != null ? `$${claim.price}` : null]
    .filter(Boolean)
    .join(' · ');

  async function toggle(bought: boolean) {
    try {
      await setBought({ itemId: claim.itemId, bought });
    } catch (error) {
      Alert.alert(error instanceof ConvexError ? String(error.data) : 'Couldn’t update this item.');
      return;
    }
    // Your gift might not come from their list, so only ask.
    const eventId = gift?.occasion.eventId;
    if (bought && gift?.match && !gift.match.giftReady && eventId) {
      Alert.alert('Mark your Secret Santa gift ready?', undefined, [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Mark ready', onPress: () => void setGiftReady({ eventId, giftReady: true }) },
      ]);
    }
  }

  return (
    <View className="flex-row items-center gap-3">
      <Checkbox
        aria-label={`Bought ${claim.name}`}
        checked={claim.bought}
        onCheckedChange={checked => void toggle(checked)}
      />
      <Link href={detailsHref(claim.listId, claim.itemId) as Href} asChild>
        <Pressable className="flex-1 flex-row items-center gap-3">
          <ItemImage url={claim.imageUrl} muted={claim.bought} />
          <View className="flex-1">
            <Text className={cn('text-[17px]', claim.bought && 'text-ink-muted line-through')} numberOfLines={1}>
              {claim.name}
            </Text>
            {detail !== '' && <Text className="text-[13px] text-ink-muted">{detail}</Text>}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

// For someone you haven't claimed anything for: what's still open on their
// lists, then your Private ideas for them.
function SuggestionList({ gift, suggestions }: { gift: GiftToGet; suggestions: Suggestions }) {
  const name = firstName(gift.person.name);
  const { items, moreItems, allClaimed, listId, privateIdeas } = suggestions;
  const nothing = !items.length && !privateIdeas.length && !allClaimed;

  return (
    <View className="gap-3">
      <CardLabel
        action={
          listId && (
            <Link href={`/(app)/(dashboard)/lists/${listId}` as Href} asChild>
              <Pressable hitSlop={8}>
                <Text className="text-[15px] text-accent">
                  {moreItems > 0 ? `See all · ${moreItems} more` : 'See list'}
                </Text>
              </Pressable>
            </Link>
          )
        }
      >
        {items.length > 0 ? `Still needs a gift · pick one to claim` : `Still needs a gift`}
      </CardLabel>
      {allClaimed && (
        <Text className="text-[15px] text-ink-muted">
          Everything on {name}’s list is already claimed by someone else.
          {privateIdeas.length > 0 ? ' Here are your own ideas for them.' : ''}
        </Text>
      )}
      {nothing && <Text className="text-[15px] text-ink-muted">{name} hasn’t added anything to their list yet.</Text>}
      {items.map(item => (
        <SuggestionRow key={item.itemId} item={item} />
      ))}
      {privateIdeas.length > 0 && items.length > 0 && <CardLabel>Your private ideas</CardLabel>}
      {privateIdeas.map(idea => (
        <View key={idea._id} className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-[10px] bg-fill" style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}>
            <Icon as={Lightbulb} size={20} className="text-ink-muted" />
          </View>
          <View className="flex-1">
            <Text className="text-[17px]" numberOfLines={1}>
              {idea.title}
            </Text>
            <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
              {idea.description ?? 'Your private idea'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function SuggestionRow({ item }: { item: Suggestions['items'][number] }) {
  const detailsHref = useItemDetailsHref();
  const claim = useMutation(api.claims.claim);
  const [busy, setBusy] = useState(false);
  const detail = [
    item.wanted > 1 ? `${item.left} of ${item.wanted} still needed` : null,
    item.price != null ? `$${item.price}` : null,
    item.fromIdeas ? item.listTitle : null,
  ]
    .filter(Boolean)
    .join(' · ');

  async function claimIt(itemId: Id<'items'>) {
    setBusy(true);
    try {
      await claim({ itemId, quantity: 1 });
    } catch (error) {
      Alert.alert(error instanceof ConvexError ? String(error.data) : 'Couldn’t claim this.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3">
      <Link href={detailsHref(item.listId, item.itemId) as Href} asChild>
        <Pressable className="flex-1 flex-row items-center gap-3">
          <ItemImage url={item.imageUrl} />
          <View className="flex-1">
            <Text className="text-[17px]" numberOfLines={1}>
              {item.name}
            </Text>
            {detail !== '' && (
              <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
                {detail}
              </Text>
            )}
          </View>
        </Pressable>
      </Link>
      <Button variant="secondary" size="sm" className="rounded-pill" disabled={busy} onPress={() => claimIt(item.itemId)}>
        <Text>Claim</Text>
      </Button>
    </View>
  );
}
