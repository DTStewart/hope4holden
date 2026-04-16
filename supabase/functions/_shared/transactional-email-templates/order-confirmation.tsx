import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface LineItem {
  type: string
  description: string
  amount: number
}

interface Props {
  recipientName?: string
  lineItems?: LineItem[]
  totalAmount?: number
  hasDonation?: boolean
  sponsorUploadUrl?: string
  sponsorBusinessName?: string
  sponsorTierName?: string
  registrationTeamName?: string
}

const OrderConfirmationEmail = ({
  recipientName,
  lineItems = [],
  totalAmount = 0,
  hasDonation,
  sponsorUploadUrl,
  sponsorBusinessName,
  sponsorTierName,
  registrationTeamName,
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

        {/* Registration info */}
        {registrationTeamName && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🏌️ Tournament Registration</Text>
            <Text style={infoText}>
              Team <strong>{registrationTeamName}</strong> is confirmed! We'll send you more details about tee times and course information as the date approaches.
            </Text>
          </Section>
        )}

        {/* Sponsor logo upload — prominent action item */}
        {sponsorUploadUrl && (
          <Section style={uploadBox}>
            <Text style={uploadTitle}>📤 Upload Your Logo</Text>
            <Text style={uploadText}>
              {sponsorBusinessName ? `As a ${sponsorTierName || ''} sponsor, ${sponsorBusinessName} ` : 'You '}
              can upload your logo and brand assets for display on our website and tournament materials.
            </Text>
            <Text style={uploadTips}>
              <strong>Tips:</strong> PNG or SVG with transparent background • Max 10 MB • Upload multiple files
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={sponsorUploadUrl}>
                Upload Brand Assets
              </Button>
            </Section>
            <Text style={uploadFootnote}>
              This link is unique to your sponsorship. You can use it multiple times.
            </Text>
          </Section>
        )}

        {/* Donation CRA note */}
        {hasDonation && (
          <Section style={infoBox}>
            <Text style={infoTitle}>🧾 Tax Receipt</Text>
            <Text style={infoText}>
              CRA tax receipts for your donation are issued separately by ATCP, a registered charity. You will receive your official receipt directly from them.
            </Text>
          </Section>
        )}

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
    hasDonation: true,
    sponsorUploadUrl: 'https://hope4holden.com/sponsor-upload/abc123',
    sponsorBusinessName: 'Acme Corp',
    sponsorTierName: 'Gold',
    registrationTeamName: 'The Birdie Brigade',
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
const infoTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1A1A1A', margin: '0 0 6px', fontFamily: "'Montserrat', Arial, sans-serif" }
const infoText = { fontSize: '13px', color: '#555', lineHeight: '1.5', margin: '0' }

const uploadBox = { backgroundColor: '#f0f7e4', padding: '20px 24px', margin: '0 28px 16px', borderRadius: '6px', border: '2px solid #7ab40d' }
const uploadTitle = { fontSize: '16px', fontWeight: 'bold' as const, color: '#4A7C09', margin: '0 0 8px', fontFamily: "'Montserrat', Arial, sans-serif" }
const uploadText = { fontSize: '13px', color: '#555', lineHeight: '1.5', margin: '0 0 10px' }
const uploadTips = { fontSize: '12px', color: '#777', lineHeight: '1.5', margin: '0 0 14px' }
const buttonContainer = { padding: '0 0 8px' }
const button = { backgroundColor: '#7ab40d', color: '#ffffff', padding: '12px 24px', borderRadius: '4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const, fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', textDecoration: 'none', display: 'inline-block' }
const uploadFootnote = { fontSize: '11px', color: '#999', margin: '0' }

const hr = { borderColor: '#e5e5e5', margin: '8px 28px 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
