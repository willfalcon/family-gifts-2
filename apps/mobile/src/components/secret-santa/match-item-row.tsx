import { useMatchItems } from '@/hooks/secret-santa-setup';
import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Gift } from 'lucide-react-native';

import { Icon } from '../ui/icon';
import { useItemDetailsHref } from '@/hooks/claims';
import { Text } from '../ui/text';

type MatchItemsData = NonNullable<ReturnType<typeof useMatchItems>>;
type MatchItem = MatchItemsData['items'][number];

const ITEM_IMAGE_SIZE = 44;

// One suggested item. Ones you can't get are muted, with why on the right.
export default function MatchItemRow({
  item,
  budget,
  showList,
}: {
  item: MatchItem;
  budget: number | null;
  showList: boolean;
}) {
  const detailsHref = useItemDetailsHref();
  const muted = item.status === 'overBudget' || item.status === 'claimed';
  const reason =
    item.status === 'mine'
      ? 'Claimed by you'
      : item.status === 'claimed'
        ? `Already claimed by ${joinNames(item.claimedBy)}`
        : item.status === 'overBudget'
          ? `Over $${budget}`
          : null;
  // Other lists' items say which list they're from.
  const detail = [item.price != null ? `$${item.price}` : null, showList ? item.listTitle : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={detailsHref(item.listId, item._id) as Href} asChild>
      <Pressable className="flex-row items-center gap-3 border-b border-line pb-3">
        <View className={muted ? 'opacity-50' : undefined}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: ITEM_IMAGE_SIZE, height: ITEM_IMAGE_SIZE, borderRadius: 10 }}
            />
          ) : (
            <View
              className="items-center justify-center rounded-[10px] bg-fill"
              style={{ width: ITEM_IMAGE_SIZE, height: ITEM_IMAGE_SIZE }}
            >
              <Icon as={Gift} size={20} className="text-ink-muted" />
            </View>
          )}
        </View>
        <View className={muted ? 'flex-1 opacity-50' : 'flex-1'}>
          <Text className="text-[17px]" numberOfLines={1}>
            {item.name}
          </Text>
          {detail !== '' && (
            <Text className="text-[13px] text-ink-muted" numberOfLines={1}>
              {detail}
            </Text>
          )}
        </View>
        {reason && (
          <Text
            className={
              item.status === 'mine' ? 'max-w-[45%] text-[13px] text-accent' : 'max-w-[45%] text-[13px] text-ink-muted'
            }
            numberOfLines={2}
          >
            {reason}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

// "Ann", "Ann and Bo", "Ann, Bo and Cy"
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? 'someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
