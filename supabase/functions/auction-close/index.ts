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
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// CRA split-receipting: receipt = bid - FMV when FMV ≤ 80% of bid.
function taxReceiptAmount(bid: number, fmv: number): number {
  if (fmv <= 0 || bid <= 0) return 0
  if (fmv / bid > 0.8) return 0
  return bid - fmv
}

type Stats = {
  processed: number
  charged: number
  requires_action: number
  failed: number
  skipped_no_bids: number
}

// Thrown when the post-charge invoice update fails. By that point the charge
// has already succeeded at Stripe, so the per-item catch below must NOT mark
// the invoice 'failed' (that would mask a real charge). We rethrow this out of
// the loop instead, aborting loudly so the inconsistency is investigated
// rather than silently left for a rerun to charge a second time.
class InvoiceUpdateError extends Error {}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const SITE_URL = Deno.env.get('SITE_URL') || 'https://hope4holden.com'
  const STRIPE_SECRET =
    Deno.env.get('STRIPE_AUCTION_SECRET_KEY') || Deno.env.get('STRIPE_SECRET_KEY')

  if (!STRIPE_SECRET) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' })

  // Auth: admin only
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  let isAuthorized = claims?.role === 'service_role' || token === SERVICE_KEY
  if (!isAuthorized && claims?.role === 'authenticated' && typeof claims.sub === 'string') {
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: claims.sub,
      _role: 'admin',
    })
    isAuthorized = isAdmin === true
  }
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Optional body: { itemIds?: string[], dryRun?: boolean }
  let itemIds: string[] | null = null
  let dryRun = false
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body.itemIds)) itemIds = body.itemIds.filter((x: unknown) => typeof x === 'string')
    dryRun = Boolean(body.dryRun)
  } catch {
    /* empty body is fine */
  }

  const { data: settings } = await supabase.from('auction_settings').select('*').eq('id', 1).single()
  const nowIso = new Date().toISOString()

  // Find items ready to close: status = 'open' AND (ends_at OR global close) <= now
  // If itemIds provided, filter to those.
  let query = supabase
    .from('auction_items')
    .select('id, title, starting_bid, market_value, status, ends_at, pickup_option, pickup_notes')
    .eq('status', 'open')
  if (itemIds && itemIds.length > 0) query = query.in('id', itemIds)
  const { data: openItems, error: itemsErr } = await query
  if (itemsErr) {
    console.error('Failed to load open items:', itemsErr)
    return new Response(JSON.stringify({ error: 'DB error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const globalClose = settings?.bidding_closes_at ? new Date(settings.bidding_closes_at) : null
  const eligible = (openItems || []).filter((item: any) => {
    const end = item.ends_at ? new Date(item.ends_at) : globalClose
    return end && end.getTime() <= Date.now()
  })

  const stats: Stats = { processed: 0, charged: 0, requires_action: 0, failed: 0, skipped_no_bids: 0 }
  const details: Array<Record<string, unknown>> = []

  for (const item of eligible) {
    stats.processed++

    // Find highest bid for this item
    const { data: bids } = await supabase
      .from('auction_bids')
      .select('id, bidder_id, amount')
      .eq('item_id', item.id)
      .order('amount', { ascending: false })
      .limit(1)

    const winningBid = bids?.[0]
    if (!winningBid) {
      stats.skipped_no_bids++
      if (!dryRun) {
        await supabase.from('auction_items').update({ status: 'closed' }).eq('id', item.id)
      }
      details.push({ item_id: item.id, title: item.title, outcome: 'no_bids' })
      continue
    }

    // Load winner bidder with Stripe ids
    const { data: bidder } = await supabase
      .from('auction_bidders')
      .select('id, email, phone, display_name, stripe_customer_id, payment_method_id')
      .eq('id', winningBid.bidder_id)
      .single()

    if (!bidder) {
      stats.failed++
      details.push({ item_id: item.id, title: item.title, outcome: 'bidder_not_found' })
      continue
    }

    const receiptAmount = taxReceiptAmount(winningBid.amount, item.market_value)

    if (dryRun) {
      details.push({
        item_id: item.id,
        title: item.title,
        winner: bidder.display_name,
        email: bidder.email,
        amount: winningBid.amount,
        receipt: receiptAmount,
        outcome: 'dry_run',
      })
      continue
    }

    // Close the item (so no new bids)
    await supabase.from('auction_items').update({ status: 'closed' }).eq('id', item.id)

    // Upsert invoice (idempotent if admin re-runs close)
    const { data: existingInvoice } = await supabase
      .from('auction_invoices')
      .select('*')
      .eq('item_id', item.id)
      .maybeSingle()

    let invoice: any
    if (existingInvoice && existingInvoice.status === 'charged') {
      details.push({ item_id: item.id, title: item.title, outcome: 'already_charged' })
      stats.charged++
      continue
    }

    if (!existingInvoice) {
      const paymentLinkToken = randomToken(24)
      const { data: inserted, error: invoiceErr } = await supabase
        .from('auction_invoices')
        .insert({
          item_id: item.id,
          bidder_id: bidder.id,
          amount: winningBid.amount,
          tax_receipt_amount: receiptAmount,
          status: 'pending',
          payment_link_token: paymentLinkToken,
        })
        .select('*')
        .single()
      if (invoiceErr) {
        stats.failed++
        console.error('Invoice insert failed:', invoiceErr)
        details.push({ item_id: item.id, outcome: 'invoice_error', error: invoiceErr.message })
        continue
      }
      invoice = inserted
    } else {
      invoice = existingInvoice
    }

    if (!bidder.stripe_customer_id || !bidder.payment_method_id) {
      // Shouldn't happen — place_bid enforces this — but belt and suspenders.
      await supabase
        .from('auction_invoices')
        .update({ status: 'failed', error_message: 'No payment method on file' })
        .eq('id', invoice.id)
      stats.failed++
      details.push({ item_id: item.id, outcome: 'no_payment_method' })
      await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'failed')
      continue
    }

    // Off-session charge
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: winningBid.amount * 100, // cents
          currency: 'cad',
          customer: bidder.stripe_customer_id,
          payment_method: bidder.payment_method_id,
          off_session: true,
          confirm: true,
          description: `Hope 4 Holden Silent Auction — ${item.title}`,
          metadata: {
            invoice_id: invoice.id,
            item_id: item.id,
            bidder_id: bidder.id,
            bidder_email: bidder.email,
          },
        },
        // Keyed on the invoice so a retry (DB update failed, function timed
        // out, etc.) reuses the same PaymentIntent instead of creating a second
        // charge against the winner.
        { idempotencyKey: `auction-invoice-${invoice.id}` }
      )

      if (pi.status === 'succeeded') {
        const { error: chargedUpdateErr } = await supabase
          .from('auction_invoices')
          .update({
            status: 'charged',
            stripe_payment_intent_id: pi.id,
            paid_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', invoice.id)
        if (chargedUpdateErr) {
          // Charge succeeded but we could not record it. Do not swallow this:
          // a rerun would see a non-charged invoice and double-charge.
          throw new InvoiceUpdateError(
            `Charged invoice ${invoice.id} (PI ${pi.id}) but failed to record it: ${chargedUpdateErr.message}`
          )
        }
        stats.charged++
        details.push({ item_id: item.id, outcome: 'charged', amount: winningBid.amount })
        await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'charged', pi.id)
      } else if (pi.status === 'requires_action' || pi.status === 'requires_payment_method') {
        await supabase
          .from('auction_invoices')
          .update({
            status: 'requires_action',
            stripe_payment_intent_id: pi.id,
            error_message: `PI status: ${pi.status}`,
          })
          .eq('id', invoice.id)
        stats.requires_action++
        details.push({ item_id: item.id, outcome: 'requires_action' })
        await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'requires_action', pi.id)
      } else {
        await supabase
          .from('auction_invoices')
          .update({
            status: 'failed',
            stripe_payment_intent_id: pi.id,
            error_message: `Unexpected PI status: ${pi.status}`,
          })
          .eq('id', invoice.id)
        stats.failed++
        details.push({ item_id: item.id, outcome: 'unexpected_pi_status', status: pi.status })
        await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'requires_action')
      }
    } catch (err: any) {
      // A failed post-charge invoice update is not a charge failure: rethrow it
      // so it surfaces instead of being recorded as 'failed' over a real charge.
      if (err instanceof InvoiceUpdateError) throw err
      const errorMsg = err?.raw?.message || err?.message || 'Charge failed'
      const errorCode = err?.code || err?.raw?.code
      const piId = err?.raw?.payment_intent?.id || err?.payment_intent?.id

      // authentication_required: the card needs SCA/3DS — generate fallback link
      if (errorCode === 'authentication_required') {
        await supabase
          .from('auction_invoices')
          .update({
            status: 'requires_action',
            stripe_payment_intent_id: piId,
            error_message: errorMsg,
          })
          .eq('id', invoice.id)
        stats.requires_action++
        details.push({ item_id: item.id, outcome: 'auth_required' })
        await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'requires_action', piId)
      } else {
        await supabase
          .from('auction_invoices')
          .update({
            status: 'failed',
            stripe_payment_intent_id: piId ?? null,
            error_message: errorMsg,
          })
          .eq('id', invoice.id)
        stats.failed++
        details.push({ item_id: item.id, outcome: 'charge_failed', error: errorMsg })
        await notifyWinner(supabase, SUPABASE_URL, SERVICE_KEY, SITE_URL, invoice, item, bidder, 'failed')
      }
    }
  }

  return new Response(JSON.stringify({ stats, details }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function notifyWinner(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  siteUrl: string,
  invoice: any,
  item: any,
  bidder: any,
  kind: 'charged' | 'requires_action' | 'failed',
  stripePaymentIntentId?: string
) {
  try {
    const pickupLabels: Record<string, string> = {
      thursday_dinner: 'Thursday dinner (June 18)',
      friday_checkin: 'Friday tournament check-in (June 19)',
      contact_winner: 'We\'ll contact you to arrange pickup',
      shippable: 'Shipping — we\'ll email you for the address',
    }

    const payUrl = invoice.payment_link_token
      ? `${siteUrl}/auction/pay/${invoice.payment_link_token}`
      : undefined

    const templateName =
      kind === 'charged' ? 'auction-winner-paid' : 'auction-winner-action-required'

    const templateData: Record<string, any> = {
      recipientName: bidder.display_name,
      itemTitle: item.title,
      amount: invoice.amount,
      taxReceiptAmount: invoice.tax_receipt_amount || 0,
      pickupText: pickupLabels[item.pickup_option] || item.pickup_option,
      pickupNotes: item.pickup_notes || '',
    }
    if (kind === 'charged') {
      // nothing extra
    } else {
      templateData.payUrl = payUrl
      templateData.reason = kind === 'requires_action' ? 'needs_verification' : 'failed'
    }

    await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail: bidder.email,
        idempotencyKey: `auction-win-${invoice.id}-${kind}-${stripePaymentIntentId || 'none'}`,
        templateData,
      }),
    })

    await supabase.from('auction_invoices').update({ notified_at: new Date().toISOString() }).eq('id', invoice.id)
  } catch (err) {
    console.error('Winner notification failed:', err)
  }
}
