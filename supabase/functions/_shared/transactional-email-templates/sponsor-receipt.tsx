import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"
const LOGO_URL = "https://hope4holden.lovable.app/lovable-uploads/atcp-logo.svg"

interface Props {
  businessName?: string
  contactName?: string
  contactEmail?: string
  tierName?: string
  amount?: number
}

const SponsorReceiptEmail = ({ businessName, contactName, contactEmail, tierName, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Sponsorship receipt — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Img src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png" alt={SITE_NAME} width="120" height="auto" style={{ margin: '0 auto 8px' }} />
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
          <Text style={headerSubtitle}>Annual Charity Golf Tournament</Text>
        </Section>

        <Heading style={h1}>Sponsorship Receipt</Heading>
        <Text style={text}>
          {contactName ? `Hi ${contactName}, t` : 'T'}hank you for your generous sponsorship of the {SITE_NAME} Golf Tournament!
        </Text>

        <Section style={receiptBox}>
          <Text style={label}>Business</Text>
          <Text style={value}>{businessName || 'N/A'}</Text>
          <Text style={label}>Sponsorship Tier</Text>
          <Text style={value}>{tierName || 'N/A'}</Text>
          <Text style={label}>Amount Paid</Text>
          <Text style={valueHighlight}>${amount || 0} CAD</Text>
          {contactEmail && (
            <>
              <Text style={label}>Email</Text>
              <Text style={value}>{contactEmail}</Text>
            </>
          )}
        </Section>

        <Text style={text}>
          You will receive a separate email with a link to upload your logo and brand assets for display on our website and tournament materials.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} is a registered charity. Please retain this email for your records.
        </Text>
        <Text style={footer}>
          Questions? Contact us at hello@hope4holden.com
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SponsorReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Sponsorship Receipt — ${data.tierName || ''} Sponsor — ${SITE_NAME}`,
  displayName: 'Sponsor Receipt',
  previewData: {
    businessName: 'Acme Corp',
    contactName: 'Bob Builder',
    contactEmail: 'bob@acme.com',
    tierName: 'Gold',
    amount: 2500,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const receiptBox = { backgroundColor: '#f8f8f8', padding: '20px 24px', margin: '0 28px 20px', borderRadius: '6px', border: '1px solid #e5e5e5' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 2px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const value = { fontSize: '15px', color: '#1A1A1A', margin: '0 0 14px' }
const valueHighlight = { fontSize: '18px', color: '#7ab40d', fontWeight: 'bold' as const, margin: '0 0 14px', fontFamily: "'Montserrat', Arial, sans-serif" }
const hr = { borderColor: '#e5e5e5', margin: '8px 28px 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
