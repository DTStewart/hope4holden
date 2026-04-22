import Stripe from 'npm:stripe@18.5.0'
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
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

/**
 * Called after a bidder signs in via OAuth / magic link to either (a) create
 * their auction_bidders row on first sign-in or (b) refresh their Stripe
 * SetupIntent so they can add / update a card.
 *
 * Requires the caller's Supabase Auth JWT in the Authorization header.
 * Reads email from that JWT; phone + displayName + attendingEvent come from
 * the request body (required on first sign-in; ignored on subsequent calls
 * where the row already exists).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const STRIPE_SECRET =
    Deno.env.get('STRIPE_AUCTION_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_PUBLISHABLE =
    Deno.env.get('STRIPE_AUCTION_PUBLISHABLE_KEY') || Deno.env.get('STRIPE_PUBLISHABLE_KEY')

  if (!STRIPE_SECRET || !STRIPE_PUBLISHABLE) {
    return new Response(JSON.stringify({ error: 'Auction payment system not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Require a signed-in bidder JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const jwt = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(jwt)
  const authUserId = typeof claims?.sub === 'string' ? claims.sub : null
  const jwtEmail = typeof claims?.email === 'string' ? (claims.email as string).toLowerCase() : null

  if (!authUserId || !jwtEmail || claims?.role !== 'authenticated') {
    return new Response(JSON.stringify({ error: 'Invalid auth' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' })

  let phone = ''
  let displayName = ''
  let attendingEvent = false
  try {
    const body = await req.json().catch(() => ({}))
    phone = normalizePhone(String(body.phone || ''))
    displayName = String(body.displayName || '').trim()
    attendingEvent = Boolean(body.attendingEvent)
  } catch {
    /* body is optional on returning calls */
  }

  // Look up existing bidder by auth_user_id first, then by email.
  let { data: bidder } = await supabase
    .from('auction_bidders')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (!bidder) {
    const { data: byEmail } = await supabase
      .from('auction_bidders')
      .select('*')
      .ilike('email', jwtEmail)
      .maybeSingle()
    bidder = byEmail

    // If we matched by email (legacy pre-auth bidder or admin-created), link auth.
    if (bidder && !bidder.auth_user_id) {
      await supabase
        .from('auction_bidders')
        .update({ auth_user_id: authUserId })
        .eq('id', bidder.id)
      bidder.auth_user_id = authUserId
    }
  }

  let customerId: string

  if (bidder) {
    customerId = bidder.stripe_customer_id
    // If phone/name/attending were provided, update them (the setup dialog only
    // sends these on first sign-in — otherwise they're left blank, treat as no-op).
    const patch: Record<string, unknown> = {}
    if (phone && phone.length >= 7) patch.phone = phone
    if (displayName && displayName.length >= 2) patch.display_name = displayName
    if (typeof attendingEvent === 'boolean') patch.attending_event = attendingEvent
    if (Object.keys(patch).length > 0) {
      await supabase.from('auction_bidders').update(patch).eq('id', bidder.id)
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: jwtEmail,
        phone: bidder.phone || phone,
        name: bidder.display_name || displayName,
        metadata: { bidder_id: bidder.id, auth_user_id: authUserId },
      })
      customerId = customer.id
      await supabase
        .from('auction_bidders')
        .update({ stripe_customer_id: customerId })
        .eq('id', bidder.id)
    }
  } else {
    // First sign-in: need phone + display name to create the row.
    if (phone.length < 7 || displayName.length < 2) {
      return new Response(
        JSON.stringify({ error: 'setup_required', message: 'Phone and display name are required for first-time setup.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customer = await stripe.customers.create({
      email: jwtEmail,
      phone,
      name: displayName,
      metadata: { auth_user_id: authUserId },
    })
    customerId = customer.id

    const { error: insertErr } = await supabase.from('auction_bidders').insert({
      email: jwtEmail,
      phone,
      display_name: displayName,
      stripe_customer_id: customerId,
      attending_event: attendingEvent,
      auth_user_id: authUserId,
    })
    if (insertErr) {
      console.error('Bidder insert failed:', insertErr)
      return new Response(JSON.stringify({ error: 'Registration failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  })

  return new Response(
    JSON.stringify({
      clientSecret: setupIntent.client_secret,
      publishableKey: STRIPE_PUBLISHABLE,
      customerId,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
