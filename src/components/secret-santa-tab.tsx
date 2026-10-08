import { Gift } from 'lucide-react';
import { Id } from '@convex/_generated/dataModel';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useSecretSanta } from '@/hooks/secretSanta';
import { useEventAttendees } from '@/hooks/events';
import SecretSantaConfigureForm from '@/components/secret-santa-configure-form';
import SecretSantaSentView from '@/components/secret-santa-sent-view';
import SecretSantaMemberView from '@/components/secret-santa-member-view';
import SecretSantaDraftView from '@/components/secret-santa-draft-view';

interface Props {
  eventId: Id<'events'>;
}

export default function SecretSantaTab({ eventId }: Props) {
  const { secretSanta } = useSecretSanta(eventId);
  const { attendees } = useEventAttendees(eventId);

  if (!secretSanta) return null;

  if (!secretSanta.exists) {
    if (!secretSanta.isManager) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gift />
            </EmptyMedia>
            <EmptyTitle>Secret Santa hasn&apos;t been set up yet</EmptyTitle>
            <EmptyDescription>The organizer hasn&apos;t started a Secret Santa round for this event.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return (
      <SecretSantaConfigureForm
        eventId={eventId}
        attendees={attendees ?? []}
        initialParticipantIds={(attendees ?? []).map(a => a.userId)}
        initialExclusions={[]}
      />
    );
  }

  if (!secretSanta.isManager) {
    return <SecretSantaMemberView status={secretSanta.status} isParticipant={secretSanta.isParticipant} myAssignment={secretSanta.myAssignment} />;
  }

  if (secretSanta.status === 'sent') {
    return <SecretSantaSentView eventId={eventId} assignments={secretSanta.assignments} />;
  }

  if (secretSanta.assignments.length === 0) {
    return (
      <SecretSantaConfigureForm
        eventId={eventId}
        attendees={attendees ?? []}
        initialParticipantIds={secretSanta.participants.map(p => p.userId)}
        initialExclusions={secretSanta.exclusions}
      />
    );
  }

  return <SecretSantaDraftView eventId={eventId} secretSanta={secretSanta} attendees={attendees ?? []} />;
}
