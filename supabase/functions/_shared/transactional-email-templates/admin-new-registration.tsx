import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
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
        <Heading style={h1}>New Registration</Heading>
        <Text style={text}>A new team has registered for the {SITE_NAME} Golf Tournament.</Text>
        <Hr style={hr} />
        <Text style={label}>Team Name</Text>
        <Text style={value}>{teamName || 'N/A'}</Text>
        <Text style={label}>Captain</Text>
        <Text style={value}>{captainName || 'N/A'}</Text>
        <Text style={label}>Email</Text>
        <Text style={value}>{captainEmail || 'N/A'}</Text>
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
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.5', margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const label = { fontSize: '12px', color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const }
const value = { fontSize: '15px', color: '#1A1A1A', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
