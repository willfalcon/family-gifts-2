import { ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Id } from '@convex/_generated/dataModel';
import Heading from './ui/heading';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { FavoriteButton } from './favorite-button';
import { initials } from '@/lib/utils';

interface Props {
  _id: Id<'lists'>;
  title: string;
  itemCount: number;
  owner: { name: string; image: string | null };
}

// A list shown on a group's/event's "Lists" tab - unlike ListListItem (used
// on the user's own lists page), this shows whose list it is, since every row
// here belongs to someone else.
export default function SharedListItem({ _id, title, itemCount, owner }: Props) {
  return (
    <Link to="/dashboard/lists/$id" params={{ id: _id }} className="border-b pb-4 flex justify-between items-center gap-4">
      <div className="flex items-center gap-3">
        <Avatar size="sm">
          {owner.image && <AvatarImage src={owner.image} alt={owner.name} />}
          <AvatarFallback>{initials(owner.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <Heading>{title}</Heading>
          <p className="text-muted-foreground text-sm">
            {owner.name} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <FavoriteButton kind="list" id={_id} />
        <ChevronRight className="text-muted-foreground size-4" />
      </div>
    </Link>
  );
}
