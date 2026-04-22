import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  subject?: string
  body?: string
  recipientName?: string
}

const BulkAnnouncementEmail = ({ subject, body, recipientName }: Props) => {
  // Split on blank lines to create paragraphs; preserve single newlines as <br />
  const paragraphs = (body || '').split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || `Update from ${SITE_NAME}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img src="https://rhksslzpdzpyrixkfmhb.supabase.co/storage/v1/object/public/email-assets/h4h-logo.png" alt={SITE_NAME} width="120" height="auto" style={{ margin: '0 auto 8px' }} />
            <Heading style={headerTitle}>{SITE_NAME}</Heading>
            <Text style={headerSubtitle}>Annual Charity Golf Tournament</Text>
          </Section>

          <Heading style={h1}>{subject}</Heading>
          {recipientName ? <Text style={text}>Hi {recipientName},</Text> : null}
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

          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or contact us at hello@hope4holden.com.
          </Text>
          <Text style={footer}>— Derrick, Jill & the {SITE_NAME} team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BulkAnnouncementEmail,
  subject: (data: Record<string, any>) => data.subject || `Update from ${SITE_NAME}`,
  displayName: 'Bulk Announcement',
  previewData: {
    subject: 'Weather update for the tournament',
    body:
      'Hi team!\n\nQuick update: we are keeping an eye on the forecast for Thursday, and right now it looks great for tee times.\n\nA couple of reminders:\n- Check in opens at 8:00 AM\n- Shotgun start at 9:00 AM\n- Dinner begins at 6:30 PM\n\nSee you soon!',
    recipientName: 'Alex',
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
