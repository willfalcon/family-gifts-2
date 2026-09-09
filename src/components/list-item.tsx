import { ExternalLink } from 'lucide-react';
import Heading from './ui/heading';

import { Item } from '@/types';

const priorityLabels: Record<NonNullable<Item['priority']>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export default function ListItem({ name, link, notes, priority, price }: Item) {
  return (
    <li className="border-b pb-4 flex flex-col gap-2">
      <div className="flex justify-between items-start gap-4">
        <Heading>{name}</Heading>
        {typeof price === 'number' && (
          <span className="text-muted-foreground text-sm shrink-0">${price.toFixed(2)}</span>
        )}
      </div>

      {notes && <p className="text-muted-foreground text-sm">{notes}</p>}

      <div className="flex items-center gap-3 text-sm">
        {priority && <span className="text-muted-foreground">{priorityLabels[priority]} priority</span>}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-accent flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="size-3.5" /> View
          </a>
        )}
      </div>
    </li>
  );
}
