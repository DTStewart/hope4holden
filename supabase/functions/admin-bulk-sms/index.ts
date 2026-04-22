import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const TWILIO_FROM = Deno.env.get('TWILIO_FROM')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  let isAuthorized = claims?.role === 'service_role' || token === SERVICE_KEY
  if (!isAuthorized && claims?.role === 'authenticated' && typeof claims.sub === 'string') {
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: claims.sub,
      _role: 'admin',
    })
    isAuthorized = isAdmin === true
  }
  if (!isAuthorized) return json({ error: 'Forbidden' }, 403)

  let recipientGroup: string
  let message: string
  let dryRun: boolean
  try {
    const payload = await req.json()
    recipientGroup = String(payload.recipientGroup || '')
    message = String(payload.message || '').trim()
    dryRun = Boolean(payload.dryRun)
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  if (!recipientGroup) return json({ error: 'recipientGroup is required' }, 400)
  if (!dryRun && !message) return json({ error: 'message is required' }, 400)
  if (message.length > 320) {
    return json({ error: 'message too long (max 320 chars)' }, 400)
  }

  // Collect E.164 phones across sources.
  const numbers = new Set<string>()

  const add = (raw: string | null | undefined) => {
    const e164 = toE164(raw)
    if (e164) numbers.add(e164)
  }

  if (recipientGroup === 'registrations' || recipientGroup === 'all_attendees') {
    const { data } = await supabase
      .from('registrations')
      .select('captain_phone')
      .eq('paid', true)
    for (const r of data || []) add((r as { captain_phone?: string }).captain_phone)
  }
  if (recipientGroup === 'sponsors' || recipientGroup === 'all_attendees') {
    const { data } = await supabase
      .from('sponsors')
      .select('contact_phone')
      .eq('paid', true)
    for (const s of data || []) add((s as { contact_phone?: string | null }).contact_phone)
  }
  if (recipientGroup === 'dinners' || recipientGroup === 'all_attendees') {
    const { data } = await supabase
      .from('dinners')
      .select('guest_phone')
      .eq('paid', true)
    for (const d of data || []) add((d as { guest_phone?: string }).guest_phone)
  }
  if (recipientGroup === 'bidders') {
    const { data } = await supabase.from('auction_bidders').select('phone')
    for (const b of data || []) add((b as { phone?: string }).phone)
  }

  const phones = Array.from(numbers)

  if (dryRun) {
    return json({ count: phones.length })
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return json({ error: 'Twilio not configured', sent: 0, total: phones.length }, 503)
  }

  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
  let sent = 0
  let failed = 0

  // Sequential send — Twilio rate-limits per-account anyway, and we keep
  // the total volume small by design (it's an alert, not a newsletter).
  for (const to of phones) {
    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message }),
        }
      )
      if (resp.ok) sent++
      else {
        failed++
        const text = await resp.text().catch(() => '')
        console.error('Twilio send failed', { to, status: resp.status, body: text.slice(0, 200) })
      }
    } catch (e) {
      failed++
      console.error('Twilio send threw', { to, error: e })
    }
  }

  console.log(`Bulk SMS: sent=${sent} failed=${failed} total=${phones.length}`)
  return json({ sent, failed, total: phones.length })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
