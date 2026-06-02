import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Hope 4 Holden"

interface Props {
  subject?: string
  body?: string
  recipientName?: string
  teamName?: string
  manageUrl?: string
}

const RosterRequestEmail = ({ subject, body, recipientName, teamName, manageUrl }: Props) => {
  // Split on blank lines to create paragraphs; preserve single newlines as <br />
  const paragraphs = (body || '').split(/\n\s*\n/).filter((p) => p.trim())
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject || `Add your golfers for ${SITE_NAME}`}</Preview>
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

          <Section style={ctaBox}>
            {teamName ? <Text style={ctaTeam}>{teamName}</Text> : null}
            <Button style={button} href={manageUrl || '#'}>
              Add Your Golfers
            </Button>
            <Text style={ctaHint}>
              This link is unique to your team. You can come back to it any time to add or update names.
            </Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            Questions? Reply to this email or contact us at hello@hope4holden.com.
          </Text>
          <Text style={footer}>Thank you, Derrick, Jill & the {SITE_NAME} team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RosterRequestEmail,
  subject: (data: Record<string, any>) => data.subject || `Add your golfers for ${SITE_NAME}`,
  displayName: 'Roster Request',
  previewData: {
    subject: 'Add your golfers for the 2026 tournament',
    body:
      'The tournament is coming up and it is time to lock in your foursome.\n\nTap the button below to open your team page, where you can add each golfer\'s name and email. You are already listed as the first golfer, so you only need to fill in the rest.\n\nIf anything changes later, just come back to the same link and update it.',
    recipientName: 'Alex',
    teamName: 'The Birdie Brigade',
    manageUrl: 'https://hope4holden.com/team/manage/abc123token',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Open Sans', Arial, sans-serif" }
const container = { padding: '0' }
const header = { backgroundColor: '#7ab40d', padding: '24px 28px', borderRadius: '6px 6px 0 0' }
const headerTitle = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ffffff', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0', letterSpacing: '0.5px' }
const headerSubtitle = { fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0', fontFamily: "'Montserrat', Arial, sans-serif" }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '24px 28px 16px' }
const text = { fontSize: '14px', color: '#555', lineHeight: '1.6', margin: '0 28px 16px' }
const ctaBox = { textAlign: 'center' as const, padding: '8px 28px 4px' }
const ctaTeam = { fontSize: '15px', fontWeight: 'bold' as const, color: '#1A1A1A', fontFamily: "'Montserrat', Arial, sans-serif", margin: '0 0 12px' }
const button = { backgroundColor: '#7ab40d', color: '#ffffff', padding: '12px 24px', borderRadius: '4px', fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 'bold' as const, fontSize: '14px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', textDecoration: 'none', display: 'inline-block' }
const ctaHint = { fontSize: '12px', color: '#999', lineHeight: '1.5', margin: '12px 0 0' }
const hr = { borderColor: '#e5e5e5', margin: '16px 28px' }
const footer = { fontSize: '12px', color: '#999', margin: '0 28px 8px' }
