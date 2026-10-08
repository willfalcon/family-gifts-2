import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';

interface Props {
  eventName: string;
  toName: string;
  assigneeName: string;
  eventUrl: string;
}

export function SecretSantaAssignmentEmail({ eventName, toName, assigneeName, eventUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Secret Santa match for {eventName} is ready</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6', padding: '24px' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '480px' }}>
          <Heading as="h2" style={{ marginTop: 0 }}>
            🎁 Secret Santa is set for {eventName}
          </Heading>
          <Text>
            Hi {toName}, you&apos;re Secret Santa for <strong>{assigneeName}</strong> this year. Keep it a secret!
          </Text>
          <Button
            href={eventUrl}
            style={{ backgroundColor: '#111827', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontWeight: 600 }}
          >
            View {eventName}
          </Button>
          <Text style={{ color: '#6b7280', fontSize: '12px', marginTop: '24px' }}>
            If the button doesn&apos;t work, copy and paste this link into your browser: {eventUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
