import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Public endpoint the /auction/pay/:token page calls.
// GET ?token=xxx → returns { invoice, clientSecret, publishableKey } so the
// Payment Element can re-auth and retry the charge.
//
// Token is the invoice.payment_link_token — a 48-char hex string generated at
// auction close. Anyone with the token can pay, which is fine: paying the
// invoice is the intended action for that link.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const STRIPE_SECRET =
    Deno.env.get('STRIPE_AUCTION_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_PUBLISHABLE =
    Deno.env.get('STRIPE_AUCTION_PUBLISHABLE_KEY') || Deno.env.get('STRIPE_PUBLISHABLE_KEY')

  if (!STRIPE_SECRET || !STRIPE_PUBLISHABLE) {
    return new Response(JSON.stringify({ error: 'Auction payments not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' })

  // Use the public RPC (so the function doesn't need elevated perms),
  // but we're service_role here anyway. Use the RPC for consistency and to
  // benefit from its status filter.
  const { data: rows } = await supabase.rpc('lookup_auction_invoice_by_token', { _token: token })
  const invoice = Array.isArray(rows) ? rows[0] : rows

  if (!invoice) {
    return new Response(JSON.stringify({ error: 'Invoice not found or already paid' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // If a PaymentIntent already exists, retrieve its client_secret so the
  // Payment Element can continue the existing intent (handles 3DS re-auth).
  // If none exists (shouldn't normally happen, but defensive), create a new
  // PaymentIntent on the bidder's customer.
  let clientSecret: string | undefined
  if (invoice.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id)
      if (pi.status === 'succeeded') {
        return new Response(
          JSON.stringify({ invoice: { ...invoice, status: 'charged' }, alreadyPaid: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      clientSecret = pi.client_secret || undefined
    } catch (err) {
      console.error('PaymentIntent retrieve failed:', err)
    }
  }

  if (!clientSecret) {
    // Fallback: create a fresh PaymentIntent tied to the bidder's customer + saved PM.
    const { data: inv } = await supabase
      .from('auction_invoices')
      .select('item_id, bidder_id, amount')
      .eq('payment_link_token', token)
      .maybeSingle()
    if (!inv) {
      return new Response(JSON.stringify({ error: 'Invoice lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: bidder } = await supabase
      .from('auction_bidders')
      .select('stripe_customer_id, payment_method_id')
      .eq('id', inv.bidder_id)
      .single()

    const pi = await stripe.paymentIntents.create({
      amount: inv.amount * 100,
      currency: 'cad',
      customer: bidder?.stripe_customer_id || undefined,
      payment_method: bidder?.payment_method_id || undefined,
      description: `Hope 4 Holden Silent Auction — ${invoice.item_title}`,
      automatic_payment_methods: { enabled: true },
      metadata: {
        invoice_id: invoice.id,
        item_id: invoice.item_id,
        bidder_id: inv.bidder_id,
      },
    })
    clientSecret = pi.client_secret || undefined

    await supabase
      .from('auction_invoices')
      .update({ stripe_payment_intent_id: pi.id })
      .eq('payment_link_token', token)
  }

  return new Response(
    JSON.stringify({
      invoice,
      clientSecret,
      publishableKey: STRIPE_PUBLISHABLE,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
