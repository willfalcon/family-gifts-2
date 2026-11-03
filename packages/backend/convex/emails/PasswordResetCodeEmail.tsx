import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';

interface Props {
  code: string;
}

export function PasswordResetCodeEmail({ code }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your Family Gifts password reset code is {code}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6', padding: '24px' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', maxWidth: '480px' }}>
          <Heading as="h2" style={{ marginTop: 0 }}>
            Reset your password
          </Heading>
          <Text>Enter this code in the Family Gifts app to choose a new password:</Text>
          <Text
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '8px',
              textAlign: 'center',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              padding: '16px',
            }}
          >
            {code}
          </Text>
          <Text style={{ color: '#6b7280', fontSize: '12px', marginTop: '24px' }}>
            This code expires in 5 minutes. If you didn&apos;t ask to reset your password, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
