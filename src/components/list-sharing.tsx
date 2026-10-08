import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { ConvexError } from 'convex/values';
import { Share2, X, Users, Calendar, User } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Heading from '@/components/ui/heading';
import { initials } from '@/lib/utils';
import { useListShares, useMyConnections } from '@/hooks/lists';
import { useGroups } from '@/hooks/groups';
import { useEvents } from '@/hooks/events';

function errorMessage(e: unknown) {
  if (e instanceof ConvexError && typeof e.data === 'string') return e.data;
  return 'Something went wrong';
}

const kindIcon = { group: Users, event: Calendar, user: User } as const;

interface Props {
  listId: Id<'lists'>;
}

export default function ListSharing({ listId }: Props) {
  const { shares } = useListShares(listId);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unshare = useMutation({ mutationFn: useConvexMutation(api.listShares.unshare) });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Heading>Sharing</Heading>
        {!formOpen && (
          <Button variant="link" className="text-accent hover:no-underline cursor-pointer" onClick={() => setFormOpen(true)}>
            <Share2 />
            Share
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm mt-1">{error}</p>}

      {shares.length === 0 && !formOpen ? (
        <p className="text-muted-foreground text-sm mt-2">Only visible to you.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {shares.map(share => {
            const Icon = kindIcon[share.kind];
            return (
              <li key={share.id} className="flex items-center gap-2">
                {share.kind === 'user' ? (
                  <Avatar size="sm">
                    {share.image && <AvatarImage src={share.image} alt={share.name} />}
                    <AvatarFallback>{initials(share.name)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Icon className="size-4 text-muted-foreground" />
                )}
                <span className="flex-1">{share.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Stop sharing with ${share.name}`}
                  onClick={() => unshare.mutate({ id: share.id }, { onError: e => setError(errorMessage(e)) })}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen && <ShareForm listId={listId} onError={setError} onDone={() => setFormOpen(false)} />}
    </div>
  );
}

interface ShareFormProps {
  listId: Id<'lists'>;
  onError: (message: string) => void;
  onDone: () => void;
}

function ShareForm({ listId, onError, onDone }: ShareFormProps) {
  const { groups } = useGroups();
  const { events } = useEvents();
  const { connections } = useMyConnections();
  const [kind, setKind] = useState<'group' | 'event' | 'user'>('group');
  const [targetId, setTargetId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shareWithGroup = useMutation({ mutationFn: useConvexMutation(api.listShares.shareWithGroup) });
  const shareWithEvent = useMutation({ mutationFn: useConvexMutation(api.listShares.shareWithEvent) });
  const shareWithUser = useMutation({ mutationFn: useConvexMutation(api.listShares.shareWithUser) });

  // Mutations are idempotent (re-sharing with an already-shared target is a
  // no-op), so this doesn't bother filtering out targets already shared with -
  // just normalizes each kind's list to a common {id, label} shape to pick from.
  const options: { id: string; label: string }[] =
    kind === 'group'
      ? groups.map(g => ({ id: g._id, label: g.name }))
      : kind === 'event'
        ? events.map(e => ({ id: e._id, label: e.name }))
        : connections.map(c => ({ id: c.userId, label: c.name }));

  async function handleShare() {
    if (!targetId) return;
    setSubmitting(true);
    try {
      if (kind === 'group') await shareWithGroup.mutateAsync({ listId, groupId: targetId as Id<'groups'> });
      else if (kind === 'event') await shareWithEvent.mutateAsync({ listId, eventId: targetId as Id<'events'> });
      else await shareWithUser.mutateAsync({ listId, userId: targetId });
      setTargetId('');
      onDone();
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <Select
        value={kind}
        onValueChange={v => {
          setKind(v as typeof kind);
          setTargetId('');
        }}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="group">Group</SelectItem>
          <SelectItem value="event">Event</SelectItem>
          <SelectItem value="user">Person</SelectItem>
        </SelectContent>
      </Select>

      <Select value={targetId} onValueChange={setTargetId}>
        <SelectTrigger size="sm" className="flex-1">
          <SelectValue placeholder={`Choose a ${kind}`} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {kind === 'group' ? "You're not in any groups." : kind === 'event' ? "You're not attending any events." : 'No connections yet.'}
            </div>
          ) : (
            options.map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Button onClick={handleShare} disabled={!targetId || submitting}>
        Share
      </Button>
      <Button variant="link" onClick={onDone}>
        Cancel
      </Button>
    </div>
  );
}
