import { Gift } from 'lucide-react';
import { Id } from '@convex/_generated/dataModel';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useSecretSanta } from '@/hooks/secretSanta';
import SecretSantaSentView from '@/components/secret-santa-sent-view';
import SecretSantaMemberView from '@/components/secret-santa-member-view';

interface Props {
  eventId: Id<'events'>;
}

// Setting up and drawing happens in the app for now; the web only shows
// where things stand.
export default function SecretSantaTab({ eventId }: Props) {
  const { secretSanta } = useSecretSanta(eventId);

  if (!secretSanta) return null;

  if (!secretSanta.exists || (secretSanta.isManager && secretSanta.status !== 'sent')) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Gift />
          </EmptyMedia>
          <EmptyTitle>
            {secretSanta.exists ? 'Secret Santa is being set up' : 'Secret Santa hasn’t been set up yet'}
          </EmptyTitle>
          <EmptyDescription>
            {secretSanta.isManager
              ? 'Set up and draw names in the Family Gifts app.'
              : 'Check back once names are drawn.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!secretSanta.isManager) {
    return (
      <SecretSantaMemberView
        status={secretSanta.status}
        isParticipant={secretSanta.isParticipant}
        myAssignment={secretSanta.myAssignment}
      />
    );
  }

  return <SecretSantaSentView eventId={eventId} assignments={secretSanta.assignments} />;
}
