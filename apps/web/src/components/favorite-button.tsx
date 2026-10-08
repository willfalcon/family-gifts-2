import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIsFavorited, useToggleFavorite, type FavoriteKind } from '@/hooks/favorites';

interface Props {
  kind: FavoriteKind;
  id: string;
  className?: string;
}

// One-click favorite/unfavorite toggle, meant to be dropped in anywhere a
// user, list, group, or event is shown. Most call sites nest this inside a
// row that's itself a `Link` (e.g. ListListItem), so clicks stop propagation
// rather than triggering the row's own navigation.
export function FavoriteButton({ kind, id, className }: Props) {
  const favorited = useIsFavorited(kind, id);
  const toggle = useToggleFavorite(kind);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={favorited ? 'Remove favorite' : 'Add favorite'}
      aria-pressed={favorited}
      disabled={toggle.isPending}
      className={cn('shrink-0', className)}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ id });
      }}
    >
      <Star className={favorited ? 'fill-accent text-accent' : ''} />
    </Button>
  );
}
