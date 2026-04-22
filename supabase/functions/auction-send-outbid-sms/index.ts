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

// Very light E.164 normalization — falls back to "+1" for Canadian-looking
// numbers without a country code. Twilio rejects non-E.164 to.
function toE164(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('+')) return digits
  // 10 digits => Canadian/US, prepend +1
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const SITE_URL = Deno.env.get('SITE_URL') || 'https://hope4holden.com'

  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
  const TWILIO_FROM = Deno.env.get('TWILIO_FROM')

  // Graceful no-op when Twilio isn't configured — we ship the feature but it
  // stays dormant until the admin adds their Twilio creds.
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'twilio_not_configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Auth: require a signed-in bidder (or service role).
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  const isServiceRole = claims?.role === 'service_role' || token === SERVICE_KEY
  const isAuthed = claims?.role === 'authenticated'
  if (!isServiceRole && !isAuthed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let bidId: string
  try {
    const body = await req.json()
    bidId = String(body.bid_id || '')
    if (!bidId) throw new Error('missing bid_id')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Look up the new bid (the one just placed)
  const { data: newBid } = await supabase
    .from('auction_bids')
    .select('id, item_id, bidder_id, amount, created_at')
    .eq('id', bidId)
    .maybeSingle()

  if (!newBid) {
    return new Response(JSON.stringify({ sent: false, reason: 'bid_not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Find the highest bid BELOW ours — race-safe, because place_bid enforces
  // strictly-increasing amounts per increment. `neq('id', bidId)` alone would
  // miss racing between two rapid bids on the same item.
  const { data: prevBids } = await supabase
    .from('auction_bids')
    .select('id, bidder_id, amount')
    .eq('item_id', newBid.item_id)
    .lt('amount', newBid.amount)
    .order('amount', { ascending: false })
    .limit(1)

  const prev = prevBids?.[0]
  if (!prev) {
    return new Response(JSON.stringify({ sent: false, reason: 'no_previous_bidder' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Don't SMS if someone outbid themselves
  if (prev.bidder_id === newBid.bidder_id) {
    return new Response(JSON.stringify({ sent: false, reason: 'self_outbid' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load the previous bidder, respecting their SMS opt-in, plus the item.
  const [{ data: prevBidder }, { data: item }] = await Promise.all([
    supabase
      .from('auction_bidders')
      .select('phone, display_name, notify_outbid_sms')
      .eq('id', prev.bidder_id)
      .maybeSingle(),
    supabase.from('auction_items').select('title').eq('id', newBid.item_id).maybeSingle(),
  ])

  if (!prevBidder || !item) {
    return new Response(JSON.stringify({ sent: false, reason: 'lookup_failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (prevBidder.notify_outbid_sms === false) {
    return new Response(JSON.stringify({ sent: false, reason: 'opted_out' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const toPhone = toE164(prevBidder.phone || '')
  if (!toPhone) {
    return new Response(JSON.stringify({ sent: false, reason: 'invalid_phone' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const messageBody = `Hope 4 Holden: You've been outbid on "${item.title}". Current bid is $${newBid.amount.toLocaleString()}. Bid again: ${SITE_URL}/auction. Reply STOP to opt out.`

  // Fire Twilio
  try {
    const basicAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
    const form = new URLSearchParams({
      From: TWILIO_FROM,
      To: toPhone,
      Body: messageBody,
    })
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    )
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '')
      console.error('Twilio send failed:', resp.status, errBody.slice(0, 300))
      return new Response(JSON.stringify({ sent: false, reason: 'twilio_error', status: resp.status }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ sent: true, to: toPhone }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Twilio send threw:', err)
    return new Response(JSON.stringify({ sent: false, reason: 'exception', message: err?.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
