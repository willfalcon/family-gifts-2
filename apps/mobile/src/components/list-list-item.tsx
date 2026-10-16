import { ChevronRight } from 'lucide-react-native';
// import { FavoriteButton } from './favorite-button';

import { List } from '@convex/types';
import Heading from './heading';
import { Link } from 'expo-router';
import { View } from 'react-native';
import { Text } from './ui/text';

export default function ListListItem({ title, itemCount, _id }: List) {
  return (
    <Link href={`/(app)/lists/${_id}`} className="border-b pb-4 flex-row justify-between items-center">
      <View className="flex flex-col gap-2">
        <Heading>{title}</Heading>
        <Text className="text-muted-foreground text-sm">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <View className="flex items-center gap-1">
        {/* <FavoriteButton kind="list" id={_id} /> */}
        <ChevronRight className="text-muted-foreground size-4" />
      </View>
    </Link>
  );
}
