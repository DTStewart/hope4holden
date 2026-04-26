import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Hope 4 Holden'

interface Props {
  recipientName?: string
  itemTitle?: string
  amount?: number
  taxReceiptAmount?: number
  pickupText?: string
  pickupNotes?: string
}

const AuctionWinnerPaidEmail = ({
  recipientName,
  itemTitle,
  amount,
  taxReceiptAmount,
  pickupText,
  pickupNotes,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`You won ${itemTitle || 'an auction item'} — payment confirmed`}</Preview>
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

        <Heading style={h1}>Congratulations{recipientName ? `, ${recipientName}` : ''}!</Heading>

        <Text style={text}>
          You won <strong>{itemTitle}</strong> at the {SITE_NAME} silent auction with a bid of{' '}
          <strong>${(amount ?? 0).toLocaleString()}</strong>.
        </Text>

        <Section style={box}>
          <Text style={boxLine}>
            <strong>Amount charged:</strong> ${(amount ?? 0).toLocaleString()} CAD
          </Text>
          {(taxReceiptAmount ?? 0) > 0 ? (
            <Text style={boxLine}>
              <strong>Potential tax receipt:</strong> ${(taxReceiptAmount ?? 0).toLocaleString()} CAD
              <br />
              <span style={subtle}>
                The portion above retail value may be eligible for a CRA-compliant tax receipt from
                ATCP. We'll forward your name and mailing address to them — watch for a receipt in
                the following weeks.
              </span>
            </Text>
          ) : null}
          <Text style={boxLine}>
            <strong>Pickup:</strong> {pickupText || 'To be confirmed'}
          </Text>
          {pickupNotes ? <Text style={boxLine}>{pickupNotes}</Text> : null}
        </Section>

        <Text style={text}>Thank you for supporting A-T research and helping Holden.</Text>

        <Hr style={hr} />
        <Text style={footer}>
          Questions? Reply to this email or contact hello@hope4holden.com.
        </Text>
        <Text style={footer}>— Derrick, Jill & the {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AuctionWinnerPaidEmail,
  subject: (data: Record<string, any>) =>
    `You won ${data.itemTitle || 'an auction item'} — payment confirmed`,
  displayName: 'Auction Winner (Paid)',
  previewData: {
    recipientName: 'Alex',
    itemTitle: 'Signed Jets jersey',
    amount: 450,
    taxReceiptAmount: 150,
    pickupText: 'Thursday dinner (June 18)',
    pickupNotes: 'Pick up from Jill at the registration table.',
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
const box = {
  margin: '0 28px 20px',
  padding: '16px',
  backgroundColor: '#f8f8f8',
  borderRadius: '6px',
}
const boxLine = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 8px' }
const subtle = { color: '#777', fontSize: '12px' }
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
