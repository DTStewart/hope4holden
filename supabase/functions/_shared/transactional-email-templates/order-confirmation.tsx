import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"
const ICS_BASE = "https://rhksslzpdzpyrixkfmhb.supabase.co/functions/v1/event-ics"

// Google Calendar deep-link (UTC times in YYYYMMDDTHHmmssZ).
// Thu June 18 2026 6:00 PM America/Toronto = 22:00 UTC
// Fri June 19 2026 8:00 AM America/Toronto = 12:00 UTC
const GCAL_DINNER = 'https://www.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE',
  text: 'Hope 4 Holden — Dinner + Silent Auction',
  dates: '20260618T220000Z/20260619T020000Z',
  details: 'Doors open 6:00 PM. Dinner 6:30 PM. Silent auction closes 9:00 PM. Details: https://hope4holden.com/day-of',
  location: 'TBD — details emailed closer to the event',
}).toString()
const GCAL_TOURNAMENT = 'https://www.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE',
  text: 'Hope 4 Holden — Golf Tournament',
  dates: '20260619T120000Z/20260619T190000Z',
  details: 'Check-in 8:00 AM, shotgun start 9:00 AM. Arrive 30 min early. Details: https://hope4holden.com/day-of',
  location: 'TBD — details emailed closer to the event',
}).toString()

interface LineItem {
  type: string
  description: string
  amount: number
}

interface Props {
  recipientName?: string
  lineItems?: LineItem[]
  totalAmount?: number
  hasRegistration?: boolean
  hasSponsorship?: boolean
  hasDinner?: boolean
  hasDonation?: boolean
  isDinnerOnly?: boolean
  publicDisplayConsent?: boolean
}

const OrderConfirmationEmail = ({
  recipientName,
  lineItems = [],
  totalAmount = 0,
  hasRegistration,
  hasSponsorship,
  hasDinner,
  hasDonation,
  isDinnerOnly,
  publicDisplayConsent,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Order confirmation — {SITE_NAME} Golf Tournament</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png" alt={SITE_NAME} width="120" height="auto" style={{ margin: '0 auto 8px' }} />
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
          <Text style={headerSubtitle}>Annual Charity Golf Tournament</Text>
        </Section>

        <Heading style={h1}>Thank You for Your Support!</Heading>
        <Text style={text}>
          {recipientName ? `Hi ${recipientName}, t` : 'T'}hank you for your purchase. Here's a summary of everything included in your order.
        </Text>

        {/* Line Items */}
        <Section style={tableBox}>
          <table style={table} cellPadding="0" cellSpacing="0">
            <thead>
              <tr>
                <th style={thLeft}>Item</th>
                <th style={thRight}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i}>
                  <td style={i === lineItems.length - 1 ? tdLeftLast : tdLeft}>{item.description}</td>
                  <td style={i === lineItems.length - 1 ? tdRightLast : tdRight}>${item.amount} CAD</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={totalLabel}>Total</td>
                <td style={totalValue}>${totalAmount} CAD</td>
              </tr>
            </tfoot>
          </table>
        </Section>

        {/* Registration: Tournament Day Information */}
        {hasRegistration && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🏌️ Tournament Day Information</Text>
            <Text style={infoText}>
              <strong>Date:</strong> Thursday, June 19, 2026
            </Text>
            <Text style={infoText}>
              <strong>Shotgun Start:</strong> 11:00 AM
            </Text>
            <Text style={infoText}>
              <strong>Location:</strong> Glen Lea Golf Course
            </Text>
            <Text style={infoText}>
              <strong>Dinner:</strong> Thursday, June 18 at Victoria Inn Brandon
            </Text>
            <Text style={infoTextNote}>
              We'll send you more details about tee times and course information as the date approaches.
            </Text>
          </Section>
        )}

        {/* Sponsorship: Next Steps */}
        {hasSponsorship && (
          <Section style={infoBox}>
            <Text style={infoTitle}>📤 Next Steps for Sponsors</Text>
            <Text style={infoText}>
              You'll receive a separate email shortly to collect your marketing materials (logo and social media handles). That email can be forwarded to your marketing or design team if they handle brand assets on your behalf.
            </Text>
          </Section>
        )}

        {/* Dinner Only: Simple confirmation */}
        {isDinnerOnly && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🍽️ Dinner Details</Text>
            <Text style={infoText}>
              <strong>Date:</strong> Thursday, June 18, 2026
            </Text>
            <Text style={infoText}>
              <strong>Location:</strong> Victoria Inn Brandon
            </Text>
            <Text style={infoTextNote}>
              We'll share more details about the evening closer to the event.
            </Text>
          </Section>
        )}

        {/* Dinner info for non-dinner-only orders that include dinner */}
        {hasDinner && !isDinnerOnly && !hasRegistration && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🍽️ Dinner Information</Text>
            <Text style={infoText}>
              <strong>Date:</strong> Thursday, June 18, 2026
            </Text>
            <Text style={infoText}>
              <strong>Location:</strong> Victoria Inn Brandon
            </Text>
          </Section>
        )}

        {(hasRegistration || hasDinner || isDinnerOnly) && (
          <Section style={infoBox}>
            <Text style={infoTitle}>📅 Add to your calendar</Text>
            <Text style={infoText}>
              One-tap save so you don't miss anything:
            </Text>
            <table style={{ borderCollapse: 'collapse' as const, margin: '8px 0 0' }}>
              <tbody>
                {(hasDinner || isDinnerOnly || hasRegistration) && (
                  <tr>
                    <td style={{ padding: '4px 0' }}>
                      <Button href={GCAL_DINNER} style={calButton}>Thursday dinner (Google)</Button>
                    </td>
                    <td style={{ padding: '4px 0 4px 10px' }}>
                      <Link href={`${ICS_BASE}?kind=dinner`} style={calLink}>Apple / Outlook (.ics)</Link>
                    </td>
                  </tr>
                )}
                {hasRegistration && (
                  <tr>
                    <td style={{ padding: '4px 0' }}>
                      <Button href={GCAL_TOURNAMENT} style={calButton}>Friday tournament (Google)</Button>
                    </td>
                    <td style={{ padding: '4px 0 4px 10px' }}>
                      <Link href={`${ICS_BASE}?kind=tournament`} style={calLink}>Apple / Outlook (.ics)</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        )}

        {hasDonation && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🧾 Tax receipt</Text>
            <Text style={infoText}>
              Your tax receipt will be issued by the Ataxia Telangiectasia Children's Project (ATCP) following the tournament.
            </Text>
            {publicDisplayConsent && (
              <Text style={infoTextNote}>
                Thank you for letting others see your support — your name now appears on the supporter list at <Link href="https://hope4holden.com" style={calLink}>https://hope4holden.com</Link>
              </Text>
            )}
          </Section>
        )}

        <Text style={closingText}>
          We truly appreciate your support. Every contribution helps make the {SITE_NAME} Golf Tournament a success and supports our mission to make a difference. We look forward to seeing you!
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Please retain this email as confirmation of your order. You will also receive a payment receipt from Stripe.
        </Text>
        <Text style={footer}>
          Questions? Contact us at hello@hope4holden.com
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Order Confirmation — $${data.totalAmount || 0} CAD — ${SITE_NAME}`,
  displayName: 'Order Confirmation',
  previewData: {
    recipientName: 'Jane Doe',
    lineItems: [
      { type: 'registration', description: 'Team Registration — The Birdie Brigade', amount: 800 },
      { type: 'sponsorship', description: 'Gold Sponsorship — Acme Corp', amount: 2500 },
      { type: 'dinner', description: 'Dinner Tickets × 2', amount: 100 },
      { type: 'donation', description: 'Donation', amount: 50 },
    ],
    totalAmount: 3450,
    hasRegistration: true,
    hasSponsorship: true,
    hasDinner: true,
    hasDonation: true,
    isDinnerOnly: false,
    publicDisplayConsent: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }

const tableBox = { margin: '0 28px 20px' }
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' }
const thLeft = { textAlign: 'left' as const, padding: '10px 12px', backgroundColor: '#f0f0f0', color: '#666', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const, borderBottom: '2px solid #e5e5e5' }
const thRight = { ...thLeft, textAlign: 'right' as const }
const tdLeft = { textAlign: 'left' as const, padding: '12px', color: '#1A1A1A', borderBottom: '1px solid #e5e5e5' }
const tdRight = { textAlign: 'right' as const, padding: '12px', color: '#1A1A1A', borderBottom: '1px solid #e5e5e5', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const tdLeftLast = { ...tdLeft, borderBottom: 'none' }
const tdRightLast = { ...tdRight, borderBottom: 'none' }
const totalLabel = { textAlign: 'left' as const, padding: '14px 12px', fontSize: '14px', fontWeight: 'bold' as const, color: '#1A1A1A', borderTop: '2px solid #1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif" }
const totalValue = { textAlign: 'right' as const, padding: '14px 12px', fontSize: '18px', fontWeight: 'bold' as const, color: '#7ab40d', borderTop: '2px solid #1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif" }

const infoBox = { backgroundColor: '#f8f8f8', padding: '16px 20px', margin: '0 28px 16px', borderRadius: '6px', border: '1px solid #e5e5e5' }
const infoTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 8px', fontFamily: "'Montserrat', Arial, sans-serif" }
const infoText = { fontSize: '13px', color: '#555', lineHeight: '1.5', margin: '0 0 4px' }
const infoTextNote = { fontSize: '13px', color: '#777', lineHeight: '1.5', margin: '8px 0 0', fontStyle: 'italic' as const }

const closingText = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '8px 28px 16px' }

const hr = { borderColor: '#e5e5e5', margin: '8px 28px 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
const calButton = { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '8px 14px', borderRadius: 4, fontSize: '13px', fontWeight: 'bold' as const, textDecoration: 'none', fontFamily: "'Montserrat', Arial, sans-serif" }
const calLink = { color: '#7ab40d', fontSize: '13px', textDecoration: 'underline' }
