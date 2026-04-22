import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  subject?: string
  recipientName?: string
  totalRaised?: number
  photoUrl?: string
  videoUrl?: string
  customMessage?: string
  saveTheDateUrl?: string
  atcpUrl?: string
}

const EventRecapEmail = ({
  recipientName,
  totalRaised,
  photoUrl,
  videoUrl,
  customMessage,
  saveTheDateUrl,
  atcpUrl,
}: Props) => {
  const paragraphs = (customMessage || '').split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Together we raised ${totalRaised?.toLocaleString('en-CA') || '—'} for A-T research</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png" alt={SITE_NAME} width="120" height="auto" style={{ margin: '0 auto 8px' }} />
            <Heading style={headerTitle}>{SITE_NAME}</Heading>
            <Text style={headerSubtitle}>Thank you for showing up for Holden</Text>
          </Section>

          <Heading style={h1}>
            Because of you — ${totalRaised?.toLocaleString('en-CA') || '—'} raised
          </Heading>

          {recipientName ? <Text style={text}>Hi {recipientName},</Text> : null}

          <Text style={text}>
            What a day. Because of every person who swung a club, bought a ticket, bid on an item,
            dropped a cheque in the bucket, or told a friend — we raised{' '}
            <strong>${totalRaised?.toLocaleString('en-CA') || '—'}</strong> toward Ataxia
            Telangiectasia research. Every dollar goes to ATCP, where it accelerates the work of
            the scientists and families racing against the clock for kids like Holden.
          </Text>

          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>
              {p.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  {line}
                </React.Fragment>
              ))}
            </Text>
          ))}

          {photoUrl ? (
            <Section style={imageBox}>
              <Img src={photoUrl} alt="Event recap" width="560" style={{ width: '100%', maxWidth: '560px', borderRadius: 6 }} />
            </Section>
          ) : null}

          {videoUrl ? (
            <Section style={{ textAlign: 'center' as const, margin: '0 28px 20px' }}>
              <Button href={videoUrl} style={secondaryButton}>Watch a message from Holden's family</Button>
            </Section>
          ) : null}

          {saveTheDateUrl ? (
            <Section style={ctaBox}>
              <Text style={ctaLabel}>Year 4 is already brewing.</Text>
              <Text style={ctaText}>
                Want first dibs on a team next year? One click and we'll keep you on the 2027 list.
              </Text>
              <Button href={saveTheDateUrl} style={primaryButton}>Count me in for 2027</Button>
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            Learn more about Ataxia Telangiectasia and ATCP:{' '}
            <Link href={atcpUrl || 'https://www.atcp.org'} style={link}>{atcpUrl || 'atcp.org'}</Link>
          </Text>
          <Text style={footer}>— Derrick, Jill, Holden & the {SITE_NAME} team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventRecapEmail,
  subject: (data: Record<string, any>) =>
    data.subject || `Together we raised $${data.totalRaised?.toLocaleString('en-CA') || '—'} for A-T research`,
  displayName: 'Event Recap',
  previewData: {
    subject: 'What a day — thank you from the whole family',
    recipientName: 'Alex',
    totalRaised: 47200,
    photoUrl: 'https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png',
    videoUrl: 'https://example.com/thank-you-video',
    customMessage:
      "Highlights we'll never forget: the auction hitting its goal before dessert, Holden laughing at hole 7, and how many of you stayed after to help tear down. We're grateful, and we're not done.",
    saveTheDateUrl: 'https://hope4holden.com/save-the-date',
    atcpUrl: 'https://www.atcp.org',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const imageBox = { padding: '0 28px 20px' }
const ctaBox = { backgroundColor: '#f8fbf0', border: '1px solid #d8e8b8', borderRadius: 6, padding: '20px 24px', margin: '0 28px 20px', textAlign: 'center' as const }
const ctaLabel = { fontSize: '13px', color: '#7ab40d', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontWeight: 'bold' as const, margin: '0 0 6px', fontFamily: "'Montserrat', Arial, sans-serif" }
const ctaText = { fontSize: '14px', color: '#555', margin: '0 0 12px', lineHeight: '1.5' }
const primaryButton = { backgroundColor: '#7ab40d', color: '#ffffff', padding: '12px 24px', borderRadius: 4, fontWeight: 'bold' as const, textDecoration: 'none', fontFamily: "'Montserrat', Arial, sans-serif" }
const secondaryButton = { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '12px 24px', borderRadius: 4, fontWeight: 'bold' as const, textDecoration: 'none', fontFamily: "'Montserrat', Arial, sans-serif" }
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
const link = { color: '#7ab40d', textDecoration: 'underline' }
