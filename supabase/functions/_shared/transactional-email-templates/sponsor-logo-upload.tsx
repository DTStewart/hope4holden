import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  businessName?: string
  tierName?: string
  uploadUrl?: string
}

const SponsorLogoUploadEmail = ({ businessName, tierName, uploadUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Upload your logo and brand assets for {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>⛳ {SITE_NAME}</Heading>
          <Text style={headerSubtitle}>Annual Charity Golf Tournament</Text>
        </Section>

        <Heading style={h1}>Upload Your Logo</Heading>
        <Text style={text}>
          Thank you for sponsoring {SITE_NAME}{tierName ? ` as a ${tierName} sponsor` : ''}!
        </Text>
        <Text style={text}>
          {businessName ? `Hi ${businessName}, p` : 'P'}lease use the link below to upload your logo and any brand assets you'd like displayed on our website and tournament materials.
        </Text>
        <Text style={tips}>
          <strong>Upload tips:</strong><br />
          • PNG or SVG with transparent background recommended<br />
          • Maximum file size: 10 MB<br />
          • You can upload multiple files (logo variations, banners, etc.)
        </Text>
        <Section style={buttonContainer}>
          <Button style={button} href={uploadUrl || '#'}>
            Upload Brand Assets
          </Button>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          This link is unique to your sponsorship. You can use it multiple times to add or update your assets.
        </Text>
        <Text style={footer}>
          Questions? Contact us at hello@hope4holden.com
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SponsorLogoUploadEmail,
  subject: (data: Record<string, any>) => `Upload your logo — ${data.businessName || 'Hope 4 Holden'}`,
  displayName: 'Sponsor Logo Upload',
  previewData: {
    businessName: 'Acme Corp',
    tierName: 'Gold',
    uploadUrl: 'https://hope4holden.lovable.app/sponsor-upload/abc123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.5', margin: '0 28px 16px' }
const tips = { fontSize: '13px', color: '#555', lineHeight: '1.6', margin: '0 28px 20px', backgroundColor: '#f8f8f8', padding: '14px 16px', borderRadius: '6px' }
const buttonContainer = { padding: '0 28px 8px' }
const button = { backgroundColor: '#7ab40d', color: '#ffffff', padding: '12px 24px', borderRadius: '4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const, fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
