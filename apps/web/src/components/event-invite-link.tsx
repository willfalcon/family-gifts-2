import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { Check, Link as LinkIcon } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface Props {
  eventId: Id<'events'>;
}

// The event's shareable join link. Anyone with it can answer Going / Can't go
// and land on the event. Hosts always see it and can let guests share it too,
// or reset it to stop an old link working.
export default function EventInviteLink({ eventId }: Props) {
  const { data: link } = useQuery(convexQuery(api.events.getInviteLink, { eventId }));
  const setGuestsCanInvite = useMutation({ mutationFn: useConvexMutation(api.events.setGuestsCanInvite) });
  const resetInviteLink = useMutation({ mutationFn: useConvexMutation(api.events.resetInviteLink) });
  const [copied, setCopied] = useState(false);

  if (!link || (!link.url && !link.canManage)) return null;

  async function copy() {
    if (!link?.url) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      {link.url ? (
        <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={copy}>
          {copied ? <Check /> : <LinkIcon />}
          {copied ? 'Copied' : 'Copy invite link'}
        </Button>
      ) : (
        // Events from before links existed have none until a host makes one.
        <Button
          variant="link"
          className="text-accent hover:no-underline cursor-pointer pl-0"
          onClick={() => resetInviteLink.mutate({ eventId })}
        >
          <LinkIcon />
          Create invite link
        </Button>
      )}

      {link.canManage && (
        <>
          <label className="flex items-center justify-between gap-4 text-sm">
            Guests can invite
            <Switch
              checked={link.guestsCanInvite}
              onCheckedChange={value => setGuestsCanInvite.mutate({ eventId, guestsCanInvite: value })}
            />
          </label>
          <p className="text-muted-foreground text-xs">
            {link.guestsCanInvite ? 'Anyone on the event can share the link.' : 'Only hosts can share the link.'} Anyone
            with it can join.
            {link.url && (
              <>
                {' '}
                <button
                  type="button"
                  className="underline cursor-pointer"
                  onClick={() => {
                    if (confirm('Reset the invite link? The current link will stop working.')) {
                      resetInviteLink.mutate({ eventId });
                    }
                  }}
                >
                  Reset link
                </button>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
