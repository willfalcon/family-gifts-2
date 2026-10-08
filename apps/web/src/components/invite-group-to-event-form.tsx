import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useConvexMutation } from '@convex-dev/react-query';
import { Users } from 'lucide-react';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGroups } from '@/hooks/groups';

interface Props {
  eventId: Id<'events'>;
}

export default function InviteGroupToEventForm({ eventId }: Props) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const { groups } = useGroups();
  const inviteGroup = useMutation({ mutationFn: useConvexMutation(api.events.inviteGroup) });

  if (!open) {
    return (
      <Button variant="link" className="text-accent hover:no-underline cursor-pointer pl-0" onClick={() => setOpen(true)}>
        <Users />
        Invite a Group
      </Button>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <p>You&apos;re not in any groups yet.</p>
        <Button type="button" variant="link" className="pl-0" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map(group => (
              <SelectItem key={group._id} value={group._id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!groupId || inviteGroup.isPending}
          onClick={async () => {
            const { invited, total } = await inviteGroup.mutateAsync({ eventId, groupId: groupId as Id<'groups'> });
            setResult(
              invited === 0
                ? 'Everyone in that group is already invited or attending.'
                : `Invited ${invited} of ${total} member${total !== 1 ? 's' : ''}.`
            );
            setGroupId('');
          }}
        >
          Send Invites
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setOpen(false);
            setGroupId('');
            setResult(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {result && <p className="text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}
