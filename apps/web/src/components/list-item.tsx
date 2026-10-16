import { useState } from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import Heading from './ui/heading';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

import { Item } from '@convex/types';
import PriorityBadge from './priority-badge';
import EditItemForm from './edit-item-form';

function isValidLink(link?: string): boolean {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

interface Props {
  item: Item;
  // Only the list's owner gets edit/delete controls.
  isOwner: boolean;
}

export default function ListItem({ item, isOwner }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="border-b pb-4">
        <EditItemForm item={item} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const { name, link, notes, priority, price } = item;

  return (
    <li className="border-b pb-4 flex flex-col gap-2">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-end gap-2">
          <Heading className="mb-0">{name}</Heading>
          {typeof price === 'number' && <span className="text-muted-foreground text-sm shrink-0 mb-0.5">${price.toFixed(2)}</span>}
          <div className="mb-1.5">
            <PriorityBadge priority={priority} />
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon-sm" aria-label="Edit item" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
            <DeleteItemButton id={item._id} name={name} />
          </div>
        )}
      </div>

      {notes && <p className="text-muted-foreground text-sm">{notes}</p>}

      <div className="flex items-center gap-3 text-sm">
        {isValidLink(link) ? (
          <a href={link} target="_blank" rel="noreferrer" className="text-accent flex items-center gap-1 hover:underline">
            <ExternalLink className="size-3.5" /> {link}
          </a>
        ) : (
          link && <p className="text-accent flex items-center gap-1">{link}</p>
        )}
      </div>
    </li>
  );
}

function DeleteItemButton({ id, name }: { id: Id<'items'>; name: string }) {
  const removeItem = useMutation({ mutationFn: useConvexMutation(api.items.remove) });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Delete item">
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>This item will be permanently removed from the list.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => removeItem.mutate({ id })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
