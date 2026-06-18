/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png"
          alt="Hope 4 Holden logo"
          width="200"
          style={logo}
        />
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Thanks for joining{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Please confirm your email address ({recipient}) by clicking the button below.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Open Sans', Arial, sans-serif",
}
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 24px', maxWidth: '200px' }
const h1 = {
  fontFamily: "'Montserrat', Arial, sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#737373',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const link = { color: '#7ab40d', textDecoration: 'underline' }
const button = {
  backgroundColor: '#7ab40d',
  color: '#ffffff',
  fontFamily: "'Montserrat', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '4px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
