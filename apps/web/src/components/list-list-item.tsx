import { ChevronRight } from 'lucide-react';
import Heading from './ui/heading';
import { FavoriteButton } from './favorite-button';

import { Link } from '@tanstack/react-router';
import { List } from '@convex/types';

export default function ListListItem({ title, itemCount, _id }: List) {
  return (
    <Link to="/dashboard/lists/$id" params={{ id: _id }} className="border-b pb-4 flex justify-between items-center">
      <div className="flex flex-col gap-2">
        <Heading>{title}</Heading>
        <p className="text-muted-foreground text-sm">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <FavoriteButton kind="list" id={_id} />
        <ChevronRight className="text-muted-foreground size-4" />
      </div>
    </Link>
  );
}
