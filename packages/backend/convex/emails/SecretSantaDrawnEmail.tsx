import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';

interface Props {
  eventName: string;
  toName: string;
  eventUrl: string;
}

// To hosts, when a scheduled Reviewed draw has happened.
export function SecretSantaDrawnEmail({ eventName, toName, eventUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Names are drawn for {eventName}. Review them, then send the names.</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6', padding: '24px' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '480px' }}>
          <Heading as="h2" style={{ marginTop: 0 }}>
            🎁 Names are drawn for {eventName}
          </Heading>
          <Text>
            Hi {toName}, Secret Santa names are drawn. Nobody has been told who they have yet. Review the matches, then
            send the names.
          </Text>
          <Button
            href={eventUrl}
            style={{
              backgroundColor: '#111827',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              fontWeight: 600,
            }}
          >
            Review matches
          </Button>
          <Text style={{ color: '#6b7280', fontSize: '12px', marginTop: '24px' }}>
            If the button doesn&apos;t work, copy and paste this link into your browser: {eventUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
