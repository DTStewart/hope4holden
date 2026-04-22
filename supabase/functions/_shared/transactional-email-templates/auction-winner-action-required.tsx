import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Hope 4 Holden'

interface Props {
  recipientName?: string
  itemTitle?: string
  amount?: number
  payUrl?: string
  pickupText?: string
  reason?: 'needs_verification' | 'failed'
}

const AuctionWinnerActionRequiredEmail = ({
  recipientName,
  itemTitle,
  amount,
  payUrl,
  pickupText,
  reason,
}: Props) => {
  const isFailed = reason === 'failed'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isFailed
          ? `Couldn't charge your card for ${itemTitle} — quick fix needed`
          : `Complete your payment for ${itemTitle}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png"
              alt={SITE_NAME}
              width="120"
              height="auto"
              style={{ margin: '0 auto 8px' }}
            />
            <Heading style={headerTitle}>{SITE_NAME}</Heading>
            <Text style={headerSubtitle}>Silent Auction</Text>
          </Section>

          <Heading style={h1}>You won {itemTitle}!</Heading>

          <Text style={text}>
            {recipientName ? `Hi ${recipientName}, ` : ''}
            {isFailed
              ? `Your winning bid was accepted, but we couldn't automatically charge your card. It happens — usually a temporary bank hold, an expired card, or a network blip.`
              : `Your winning bid was accepted. Your bank needs a quick verification step before we can complete the payment — it's a standard security check for larger charges.`}
          </Text>

          <Section style={box}>
            <Text style={boxLine}>
              <strong>Item:</strong> {itemTitle}
            </Text>
            <Text style={boxLine}>
              <strong>Amount:</strong> ${(amount ?? 0).toLocaleString()} CAD
            </Text>
            <Text style={boxLine}>
              <strong>Pickup:</strong> {pickupText || 'To be confirmed'}
            </Text>
          </Section>

          <Text style={text}>
            Click below to complete your payment. Takes under a minute.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={payUrl || '#'}>
              Complete payment
            </Button>
          </Section>

          <Text style={smallText}>
            Or paste this link into your browser:
            <br />
            <span style={{ color: '#7ab40d' }}>{payUrl}</span>
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or contact hello@hope4holden.com.
          </Text>
          <Text style={footer}>— Derrick, Jill & the {SITE_NAME} team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AuctionWinnerActionRequiredEmail,
  subject: (data: Record<string, any>) =>
    data.reason === 'failed'
      ? `Couldn't charge your card for ${data.itemTitle || 'your auction win'}`
      : `Complete your payment for ${data.itemTitle || 'your auction win'}`,
  displayName: 'Auction Winner (Payment Action Required)',
  previewData: {
    recipientName: 'Alex',
    itemTitle: 'Signed Jets jersey',
    amount: 450,
    payUrl: 'https://hope4holden.com/auction/pay/abc123',
    pickupText: 'Thursday dinner (June 18)',
    reason: 'needs_verification',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  fontFamily: "'Montserrat', Arial, sans-serif",
  margin: '0',
  letterSpacing: '0.5px',
}
const headerSubtitle = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  margin: '4px 0 0',
  fontFamily: "'Montserrat', Arial, sans-serif",
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#1A1A1A',
  fontFamily: "'Montserrat', Arial, sans-serif",
  margin: '24px 28px 16px',
}
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const smallText = { fontSize: '12px', color: '#777', margin: '0 28px 16px', lineHeight: '1.5' }
const box = {
  margin: '0 28px 20px',
  padding: '16px',
  backgroundColor: '#f8f8f8',
  borderRadius: '6px',
}
const boxLine = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 8px' }
const buttonContainer = { padding: '0 28px 8px' }
const button = {
  backgroundColor: '#7ab40d',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '4px',
  fontFamily: "'Montserrat', Arial, sans-serif",
  fontWeight: 'bold' as const,
  fontSize: '14px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
