import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';

interface Props {
  eventName: string;
  inviterName: string;
  inviteUrl: string;
}

export function EventInviteEmail({ eventName, inviterName, inviteUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to {eventName} on Family Gifts
      </Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6', padding: '24px' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '480px' }}>
          <Heading as="h2" style={{ marginTop: 0 }}>
            You&apos;re invited to {eventName}
          </Heading>
          <Text>
            {inviterName} invited you to &quot;{eventName}&quot; on Family Gifts.
          </Text>
          <Button
            href={inviteUrl}
            style={{ backgroundColor: '#111827', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontWeight: 600 }}
          >
            View {eventName}
          </Button>
          <Text style={{ color: '#6b7280', fontSize: '12px', marginTop: '24px' }}>
            If the button doesn&apos;t work, copy and paste this link into your browser: {inviteUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
