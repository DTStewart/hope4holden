import Stripe from 'npm:stripe@18.5.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'

// Public endpoint the /auction/pay/:token page calls AFTER the Payment Element
// reports a successful confirmation. It replaces the old client-side
// mark_auction_invoice_paid RPC call, which trusted the caller and could be
// used to mark an invoice paid without paying.
//
// Security model: the payment_link_token alone proves nothing about payment, so
// we verify against Stripe server-side before recording anything. We retrieve
// the PaymentIntent and only mark the invoice charged when:
//   (a) the PaymentIntent status is 'succeeded',
//   (b) its amount and currency match the invoice, and
//   (c) its metadata.invoice_id matches the invoice resolved from the token.
// The invoice update is done here under service_role (RLS-bypassing), so the
// SQL RPC no longer needs an anon grant.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  // The auction PaymentIntents are created with the auction Stripe key when one
  // is configured (see auction-pay-fallback / auction-close), so retrieval must
  // use the same key resolution or the lookup would 404. Falls back to the
  // shared STRIPE_SECRET_KEY when no dedicated auction key is set.
  const STRIPE_SECRET =
    Deno.env.get('STRIPE_AUCTION_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')

  if (!STRIPE_SECRET) {
    return json({ error: 'Stripe not configured' }, 500)
  }

  let token: unknown
  let paymentIntentId: unknown
  try {
    const body = await req.json()
    token = body?.token ?? body?.payment_link_token
    paymentIntentId = body?.payment_intent_id
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof token !== 'string' || token.length < 16) {
    return json({ ok: false, error: 'invalid_token' }, 400)
  }
  if (typeof paymentIntentId !== 'string' || paymentIntentId.length === 0) {
    return json({ ok: false, error: 'missing_payment_intent' }, 400)
  }

  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY)
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' })

  // Resolve the invoice from the token. Service_role bypasses RLS.
  const { data: invoice, error: invoiceErr } = await supabase
    .from('auction_invoices')
    .select('id, amount, status')
    .eq('payment_link_token', token)
    .maybeSingle()

  if (invoiceErr) {
    console.error('Invoice lookup failed:', invoiceErr)
    return json({ ok: false, error: 'lookup_failed' }, 500)
  }
  if (!invoice) {
    return json({ ok: false, error: 'not_found' }, 404)
  }

  // Retrieve the PaymentIntent server-side and verify it against the invoice.
  let pi: Stripe.PaymentIntent
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId)
  } catch (err) {
    console.error('PaymentIntent retrieve failed:', err)
    return json({ ok: false, error: 'payment_intent_not_found' }, 400)
  }

  // (a) must have actually succeeded
  if (pi.status !== 'succeeded') {
    return json({ ok: false, error: 'payment_not_succeeded', status: pi.status }, 400)
  }
  // (b) amount (cents) and currency must match the invoice
  if (pi.amount !== invoice.amount * 100 || pi.currency !== 'cad') {
    console.warn(
      `Payment mismatch for invoice ${invoice.id}: pi.amount=${pi.amount} pi.currency=${pi.currency} expected=${invoice.amount * 100} cad`
    )
    return json({ ok: false, error: 'amount_or_currency_mismatch' }, 400)
  }
  // (c) the PaymentIntent must reference this exact invoice
  if (pi.metadata?.invoice_id !== invoice.id) {
    console.warn(
      `PaymentIntent ${pi.id} metadata.invoice_id=${pi.metadata?.invoice_id} does not match invoice ${invoice.id}`
    )
    return json({ ok: false, error: 'invoice_mismatch' }, 400)
  }

  // Verified. Record the payment. Status guard mirrors the old RPC so a
  // re-submit of an already-charged invoice is a no-op rather than a re-write.
  const { error: updateErr } = await supabase
    .from('auction_invoices')
    .update({
      status: 'charged',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
      error_message: null,
    })
    .eq('payment_link_token', token)
    .in('status', ['pending', 'requires_action', 'failed'])

  if (updateErr) {
    console.error('Invoice update failed:', updateErr)
    return json({ ok: false, error: 'update_failed' }, 500)
  }

  return json({ ok: true })
})
