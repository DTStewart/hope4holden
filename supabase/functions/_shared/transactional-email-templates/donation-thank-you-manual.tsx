import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  donorName?: string
  amount?: number
  method?: string
  note?: string
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'cash',
  cheque: 'cheque',
  eft: 'e-transfer',
  other: 'your contribution',
}

const ManualDonationThankYouEmail = ({ donorName, amount, method, note }: Props) => {
  const methodLabel = method ? (METHOD_LABELS[method] || 'your contribution') : 'your contribution'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Thank you for your $${amount || 0} donation to ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png" alt={SITE_NAME} width="120" height="auto" style={{ margin: '0 auto 8px' }} />
            <Heading style={headerTitle}>{SITE_NAME}</Heading>
            <Text style={headerSubtitle}>Thank you</Text>
          </Section>

          <Heading style={h1}>Thank you, {donorName || 'friend'}.</Heading>
          <Text style={text}>
            We've received {methodLabel} of <strong>${amount || 0}</strong> toward {SITE_NAME}. Every
            dollar goes directly to Ataxia Telangiectasia research through ATCP — accelerating the
            work of the families and scientists on the front lines.
          </Text>
          {note ? <Text style={text}>{note}</Text> : null}
          <Text style={text}>
            If you'd like an official tax receipt, reply to this email and we'll follow up with the
            details.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>— Derrick, Jill & the {SITE_NAME} team</Text>
          <Text style={footer}>
            Questions? Reply to this email or contact us at hello@hope4holden.com.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ManualDonationThankYouEmail,
  subject: (data: Record<string, any>) => `Thank you for your donation — ${SITE_NAME}`,
  displayName: 'Donation Thank-You (manual)',
  previewData: {
    donorName: 'Alex',
    amount: 500,
    method: 'cheque',
    note: 'Thank you so much for handing this in at dinner — it means the world.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
