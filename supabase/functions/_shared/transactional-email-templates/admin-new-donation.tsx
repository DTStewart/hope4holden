import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  donorName?: string
  donorEmail?: string
  amount?: number
}

const AdminNewDonationEmail = ({ donorName, donorEmail, amount }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New donation: ${amount || 0} from {donorName || 'Anonymous'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Donation</Heading>
        <Text style={text}>A new donation has been received for {SITE_NAME}.</Text>
        <Hr style={hr} />
        <Text style={label}>Donor</Text>
        <Text style={value}>{donorName || 'Anonymous'}</Text>
        <Text style={label}>Email</Text>
        <Text style={value}>{donorEmail || 'N/A'}</Text>
        <Text style={label}>Amount</Text>
        <Text style={value}>${amount || 0}</Text>
        <Hr style={hr} />
        <Text style={footer}>You can view all donations in the admin dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewDonationEmail,
  subject: (data: Record<string, any>) => `New Donation: $${data.amount || 0} from ${data.donorName || 'Anonymous'}`,
  displayName: 'Admin — New Donation',
  previewData: { donorName: 'Jane Doe', donorEmail: 'jane@example.com', amount: 100 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const label = { fontSize: '12px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const value = { fontSize: '15px', color: '#1A1A1A', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
