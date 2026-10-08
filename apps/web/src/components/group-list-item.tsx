import { ChevronRight } from 'lucide-react';
import Heading from './ui/heading';
import { FavoriteButton } from './favorite-button';

import { Group } from '@/types';
import { Link } from '@tanstack/react-router';

export default function GroupListItem({ name, _id }: Group) {
  return (
    <Link to="/dashboard/groups/$id" params={{ id: _id }} className="border-b pb-4 flex justify-between items-center">
      <div className="flex flex-col gap-2">
        <Heading>{name}</Heading>
      </div>
      <div className="flex items-center gap-1">
        <FavoriteButton kind="group" id={_id} />
        <ChevronRight className="text-muted-foreground size-4" />
      </div>
    </Link>
  );
}
