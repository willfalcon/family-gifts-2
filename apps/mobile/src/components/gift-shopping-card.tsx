import { Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { shoppingSummary, useGiftShopping } from '@/hooks/gift-shopping';
import { Card, CardContent } from './ui/card';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

// Home screen card that opens Gift Shopping: "Shopping for 4 · 3 to buy".
export default function GiftShoppingCard() {
  const data = useGiftShopping();
  if (!data) return null;
  const { shoppingFor, toBuy } = shoppingSummary(data);
  const summary =
    shoppingFor === 0 && toBuy === 0
      ? 'Nobody to shop for yet'
      : [
          shoppingFor > 0 ? `Shopping for ${shoppingFor} ${shoppingFor === 1 ? 'person' : 'people'}` : null,
          `${toBuy} to buy`,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <Link href="/(app)/(dashboard)/shopping" asChild>
      <Pressable>
        <Card>
          <CardContent className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-muted-foreground font-semibold text-sm">Gift Shopping</Text>
              <Text className="font-bold text-xl">{summary}</Text>
            </View>
            <Icon as={ChevronRight} size={20} className="text-ink-muted" />
          </CardContent>
        </Card>
      </Pressable>
    </Link>
  );
}
