import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Very light normalization — not strict E.164 validation.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : digits
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_PUBLISHABLE = Deno.env.get('STRIPE_PUBLISHABLE_KEY')

  if (!STRIPE_SECRET || !STRIPE_PUBLISHABLE) {
    console.error('Missing Stripe env vars')
    return new Response(JSON.stringify({ error: 'Payment system not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let email = ''
  let phone = ''
  let displayName = ''
  let existingSessionToken = ''
  try {
    const body = await req.json()
    email = String(body.email || '').trim().toLowerCase()
    phone = normalizePhone(String(body.phone || ''))
    displayName = String(body.displayName || '').trim()
    existingSessionToken = String(body.sessionToken || '').trim()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!email.includes('@') || phone.length < 7 || displayName.length < 2) {
    return new Response(
      JSON.stringify({ error: 'Email, phone, and display name are required.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' })

  // Find existing bidder either by session token (fresh device with same account) or email
  let bidder: any | null = null
  if (existingSessionToken) {
    const { data } = await supabase
      .from('auction_bidders')
      .select('*')
      .eq('session_token', existingSessionToken)
      .maybeSingle()
    bidder = data
  }
  if (!bidder) {
    const { data } = await supabase
      .from('auction_bidders')
      .select('*')
      .ilike('email', email)
      .maybeSingle()
    bidder = data
  }

  let customerId: string
  let sessionToken: string

  if (bidder) {
    // Update fields in case they changed
    await supabase
      .from('auction_bidders')
      .update({ phone, display_name: displayName })
      .eq('id', bidder.id)
    customerId = bidder.stripe_customer_id
    sessionToken = bidder.session_token

    if (!customerId) {
      const customer = await stripe.customers.create({ email, phone, name: displayName })
      customerId = customer.id
      await supabase
        .from('auction_bidders')
        .update({ stripe_customer_id: customerId })
        .eq('id', bidder.id)
    } else {
      // Keep Stripe customer fresh
      await stripe.customers.update(customerId, { email, phone, name: displayName })
    }
  } else {
    // Create new bidder + Stripe customer
    const customer = await stripe.customers.create({ email, phone, name: displayName })
    customerId = customer.id
    sessionToken = randomToken(32)

    const { error: insertErr } = await supabase.from('auction_bidders').insert({
      email,
      phone,
      display_name: displayName,
      stripe_customer_id: customerId,
      session_token: sessionToken,
    })
    if (insertErr) {
      // Email uniqueness race — look them up and reuse
      if (insertErr.code === '23505') {
        const { data } = await supabase
          .from('auction_bidders')
          .select('*')
          .ilike('email', email)
          .maybeSingle()
        if (data) {
          sessionToken = data.session_token
          customerId = data.stripe_customer_id
        } else {
          console.error('Bidder insert race — could not recover:', insertErr)
          return new Response(JSON.stringify({ error: 'Registration failed, please try again.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        console.error('Bidder insert failed:', insertErr)
        return new Response(JSON.stringify({ error: 'Registration failed, please try again.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  // Fresh SetupIntent — lets the frontend collect / update the card on file
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  })

  return new Response(
    JSON.stringify({
      sessionToken,
      clientSecret: setupIntent.client_secret,
      publishableKey: STRIPE_PUBLISHABLE,
      customerId,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
