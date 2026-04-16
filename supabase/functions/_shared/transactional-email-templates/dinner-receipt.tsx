import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  guestName?: string
  guestEmail?: string
  quantity?: number
  amount?: number
}

const DinnerReceiptEmail = ({ guestName, guestEmail, quantity, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Dinner ticket confirmation — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>⛳ {SITE_NAME}</Heading>
          <Text style={headerSubtitle}>Annual Charity Golf Tournament</Text>
        </Section>

        <Heading style={h1}>Dinner Tickets Confirmed!</Heading>
        <Text style={text}>
          {guestName ? `Hi ${guestName}, y` : 'Y'}our dinner tickets for the {SITE_NAME} Golf Tournament dinner have been confirmed. We look forward to seeing you there!
        </Text>

        <Section style={detailsBox}>
          <Text style={label}>Guest</Text>
          <Text style={value}>{guestName || 'N/A'}</Text>
          <Text style={label}>Tickets</Text>
          <Text style={value}>{quantity || 1}</Text>
          <Text style={label}>Total Paid</Text>
          <Text style={valueHighlight}>${amount || 0} CAD</Text>
          {guestEmail && (
            <>
              <Text style={label}>Email</Text>
              <Text style={value}>{guestEmail}</Text>
            </>
          )}
        </Section>

        <Text style={text}>
          More details about the dinner, including time and location, will be shared closer to the event.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Please retain this email as confirmation of your dinner tickets.
        </Text>
        <Text style={footer}>
          Questions? Contact us at hello@hope4holden.com
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DinnerReceiptEmail,
  subject: `Dinner Tickets Confirmed — ${SITE_NAME}`,
  displayName: 'Dinner Receipt',
  previewData: {
    guestName: 'Jane Doe',
    guestEmail: 'jane@example.com',
    quantity: 2,
    amount: 100,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const detailsBox = { backgroundColor: '#f8f8f8', padding: '20px 24px', margin: '0 28px 20px', borderRadius: '6px', border: '1px solid #e5e5e5' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 2px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const value = { fontSize: '15px', color: '#1A1A1A', margin: '0 0 14px' }
const valueHighlight = { fontSize: '18px', color: '#7ab40d', fontWeight: 'bold' as const, margin: '0 0 14px', fontFamily: "'Montserrat', Arial, sans-serif" }
const hr = { borderColor: '#e5e5e5', margin: '8px 28px 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
