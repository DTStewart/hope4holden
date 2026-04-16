import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  teamName?: string
  captainName?: string
  captainEmail?: string
}

const AdminNewRegistrationEmail = ({ teamName, captainName, captainEmail }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New team registration: {teamName || 'Unknown'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>⛳ {SITE_NAME}</Heading>
          <Text style={headerSubtitle}>Admin Notification</Text>
        </Section>

        <Heading style={h1}>New Registration</Heading>
        <Text style={text}>A new team has registered for the {SITE_NAME} Golf Tournament.</Text>

        <Section style={detailsBox}>
          <Text style={label}>Team Name</Text>
          <Text style={value}>{teamName || 'N/A'}</Text>
          <Text style={label}>Captain</Text>
          <Text style={value}>{captainName || 'N/A'}</Text>
          <Text style={label}>Email</Text>
          <Text style={value}>{captainEmail || 'N/A'}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>You can view all registrations in the admin dashboard.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewRegistrationEmail,
  subject: (data: Record<string, any>) => `New Registration: ${data.teamName || 'New Team'}`,
  displayName: 'Admin — New Registration',
  previewData: { teamName: 'The Birdie Brigade', captainName: 'John Smith', captainEmail: 'john@example.com' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.5', margin: '0 28px 16px' }
const detailsBox = { backgroundColor: '#f8f8f8', padding: '20px 24px', margin: '0 28px 20px', borderRadius: '6px', border: '1px solid #e5e5e5' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 2px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const value = { fontSize: '15px', color: '#1A1A1A', margin: '0 0 14px' }
const hr = { borderColor: '#e5e5e5', margin: '8px 28px 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
