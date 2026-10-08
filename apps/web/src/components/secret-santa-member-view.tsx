import { useState } from 'react';
import { Eye, EyeOff, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { initials } from '@/lib/utils';

interface Props {
  status: 'draft' | 'sent';
  isParticipant: boolean;
  myAssignment: { userId: string; name: string; image: string | null } | null;
}

export default function SecretSantaMemberView({ status, isParticipant, myAssignment }: Props) {
  const [revealed, setRevealed] = useState(false);

  if (status === 'draft') {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gift />
          </EmptyMedia>
          <EmptyTitle>Secret Santa is being set up</EmptyTitle>
          <EmptyDescription>The organizer is still choosing participants. Check back once matches are sent.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!isParticipant || !myAssignment) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gift />
          </EmptyMedia>
          <EmptyTitle>You&apos;re not in this Secret Santa</EmptyTitle>
          <EmptyDescription>Matches have already been sent to the participants for this round.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
      <Gift className="text-muted-foreground size-8" />
      {revealed ? (
        <>
          <p className="text-muted-foreground text-sm">You&apos;re the Secret Santa for</p>
          <div className="flex items-center gap-2">
            <Avatar size="lg">
              {myAssignment.image && <AvatarImage src={myAssignment.image} alt={myAssignment.name} />}
              <AvatarFallback>{initials(myAssignment.name)}</AvatarFallback>
            </Avatar>
            <span className="font-display text-lg font-medium">{myAssignment.name}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed(false)}>
            <EyeOff />
            Hide
          </Button>
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">Your Secret Santa match is ready. Make sure no one&apos;s looking!</p>
          <Button type="button" onClick={() => setRevealed(true)}>
            <Eye />
            Reveal My Match
          </Button>
        </>
      )}
    </div>
  );
}
