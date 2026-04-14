import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  businessName?: string
  tierName?: string
  uploadUrl?: string
}

const SponsorConfirmationEmail = ({ businessName, tierName, uploadUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thank you for sponsoring {SITE_NAME}!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Thank You for Your Sponsorship!</Heading>
        <Text style={text}>
          Dear {businessName || 'Sponsor'},
        </Text>
        <Text style={text}>
          Your <strong>{tierName || ''}</strong> sponsorship for the {SITE_NAME} Golf Tournament has been confirmed. We truly appreciate your support in the fight against Ataxia Telangiectasia.
        </Text>
        <Hr style={hr} />
        <Text style={text}>
          Please upload your logo and brand assets using the link below. Your logo will appear on tournament signage and our website after review.
        </Text>
        {uploadUrl && (
          <Button href={uploadUrl} style={button}>
            Upload Your Logo
          </Button>
        )}
        <Hr style={hr} />
        <Text style={footer}>
          If you have any questions, reply to this email or visit hope4holden.com.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SponsorConfirmationEmail,
  subject: (data: Record<string, any>) => `Sponsorship Confirmed — Upload Your Logo, ${data.businessName || 'Sponsor'}`,
  displayName: 'Sponsor confirmation & logo upload',
  previewData: { businessName: 'Acme Corp', tierName: 'Gold', uploadUrl: 'https://hope4holden.com/sponsor-upload/abc123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '20px 0' }
const button = { backgroundColor: '#7ab40d', color: '#ffffff', padding: '12px 28px', borderRadius: '4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
