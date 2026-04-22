// Public endpoint that serves an .ics calendar file for the Hope 4 Holden event.
// Embedded in post-purchase emails as an "Add to calendar" download.
//
// Accepts an optional ?kind=dinner|tournament|both (default: both).
//
// All timestamps in America/Toronto; dates are the event (Thu June 18 + Fri June 19, 2026).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

// VCALENDAR format: CRLF line endings, 75-char max line length (we stay well under).
function vcal(body: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hope 4 Holden//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    body,
    'END:VCALENDAR',
  ].join('\r\n')
}

// Local-time (TZID) event block. No timezone definitions inline — every major
// calendar client resolves America/Toronto correctly from the TZID.
function vevent(opts: {
  uid: string
  summary: string
  description: string
  location: string
  start: string // YYYYMMDDTHHMMSS
  end: string
  url?: string
}): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const lines = [
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/Toronto:${opts.start}`,
    `DTEND;TZID=America/Toronto:${opts.end}`,
    `SUMMARY:${escape(opts.summary)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `LOCATION:${escape(opts.location)}`,
  ]
  if (opts.url) lines.push(`URL:${opts.url}`)
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

const SITE = 'https://hope4holden.com'

const DINNER = vevent({
  uid: 'dinner-2026@hope4holden.com',
  summary: 'Hope 4 Holden — Dinner + Silent Auction',
  description: `Doors open 6:00 PM · Dinner 6:30 PM · Silent auction closes 9:00 PM. Event details: ${SITE}/day-of`,
  location: 'TBD — details emailed closer to the event',
  start: '20260618T180000',
  end: '20260618T220000',
  url: `${SITE}/day-of`,
})

const TOURNAMENT = vevent({
  uid: 'tournament-2026@hope4holden.com',
  summary: 'Hope 4 Holden — Golf Tournament',
  description: `Check-in 8:00 AM · Shotgun start 9:00 AM. Arrive 30 minutes early for bag drop and cart assignment. Event details: ${SITE}/day-of`,
  location: 'TBD — details emailed closer to the event',
  start: '20260619T080000',
  end: '20260619T150000',
  url: `${SITE}/day-of`,
})

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') || 'both'

  let body: string
  let filename: string
  if (kind === 'dinner') {
    body = vcal(DINNER)
    filename = 'hope4holden-dinner.ics'
  } else if (kind === 'tournament') {
    body = vcal(TOURNAMENT)
    filename = 'hope4holden-tournament.ics'
  } else {
    body = vcal([DINNER, TOURNAMENT].join('\r\n'))
    filename = 'hope4holden-2026.ics'
  }

  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
})
