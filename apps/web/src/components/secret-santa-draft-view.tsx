import { useState } from 'react';
import { Id } from '@convex/_generated/dataModel';
import SecretSantaConfigureForm from '@/components/secret-santa-configure-form';
import SecretSantaPreview from '@/components/secret-santa-preview';

interface Attendee {
  userId: string;
  name: string;
  image: string | null;
  color: string;
}

interface SecretSantaData {
  participants: { userId: string; name: string; image: string | null }[];
  exclusions: { userId: string; excludedUserId: string }[];
  assignments: { giverUserId: string; giverName: string; receiverUserId: string; receiverName: string }[];
}

interface Props {
  eventId: Id<'events'>;
  secretSanta: SecretSantaData;
  attendees: Attendee[];
}

// Toggles between the generated preview and re-opening the participant /
// exclusion form, for a draft round that already has assignments.
export default function SecretSantaDraftView({ eventId, secretSanta, attendees }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SecretSantaConfigureForm
        eventId={eventId}
        attendees={attendees}
        initialParticipantIds={secretSanta.participants.map(p => p.userId)}
        initialExclusions={secretSanta.exclusions}
        onGenerated={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return <SecretSantaPreview eventId={eventId} secretSanta={secretSanta} onEdit={() => setEditing(true)} />;
}
