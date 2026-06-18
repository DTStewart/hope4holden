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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png"
          alt="Hope 4 Holden logo"
          width="200"
          style={logo}
        />
        <Heading style={h1}>Sign in to {siteName}</Heading>
        <Text style={text}>
          Click the button below to sign in on this device. This link will expire shortly.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Sign in
        </Button>
        {token && (
          <>
            <Text style={text}>
              Or enter this 6-digit code on the sign-in screen (works on any device):
            </Text>
            <Text style={codeStyle}>{token}</Text>
          </>
        )}
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const codeStyle = {
  fontFamily: "'Montserrat', Arial, sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.15em',
  color: '#1a1a1a',
  margin: '0 0 30px',
}
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
