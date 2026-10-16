import { ChevronRight } from 'lucide-react-native';

import { Group } from '@convex/types';
import { Link } from 'expo-router';
import Heading from './heading';
import { View } from 'react-native';

export default function GroupListItem({ name, _id }: Group) {
  return (
    <Link href={`/dashboard/groups/${_id}`} className="border-b pb-4 flex justify-between items-center">
      <View className="flex flex-col gap-2">
        <Heading>{name}</Heading>
      </View>
      <View className="flex items-center gap-1">
        {/* <FavoriteButton kind="group" id={_id} /> */}
        <ChevronRight className="text-muted-foreground size-4" />
      </View>
    </Link>
  );
}
