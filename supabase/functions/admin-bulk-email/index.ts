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

type Recipient = { email: string; name?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

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

  const supabase = createClient(supabaseUrl, serviceKey)

  // Accept either an admin JWT or a direct service-role call
  let isAuthorized = claims?.role === 'service_role' || token === serviceKey
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

  // Parse body
  let recipientGroup: string
  let subject: string
  let body: string
  let dryRun: boolean
  let templateName: string
  let templateData: Record<string, unknown>
  try {
    const payload = await req.json()
    recipientGroup = String(payload.recipientGroup || '')
    subject = String(payload.subject || '').trim()
    body = String(payload.body || '').trim()
    dryRun = Boolean(payload.dryRun)
    templateName = String(payload.templateName || 'bulk-announcement')
    templateData =
      payload.templateData && typeof payload.templateData === 'object'
        ? (payload.templateData as Record<string, unknown>)
        : {}
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!recipientGroup) {
    return new Response(JSON.stringify({ error: 'recipientGroup is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // For bulk-announcement subject+body are required; other templates rely
  // solely on templateData so only enforce when using the default.
  if (!dryRun && templateName === 'bulk-announcement' && (!subject || !body)) {
    return new Response(JSON.stringify({ error: 'subject and body are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Collect recipients, deduplicated by lowercase email
  const recipientMap = new Map<string, Recipient>()
  const add = (email: unknown, name?: unknown) => {
    if (typeof email !== 'string') return
    const clean = email.trim().toLowerCase()
    if (!clean || !clean.includes('@')) return
    if (!recipientMap.has(clean)) {
      recipientMap.set(clean, {
        email: clean,
        name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      })
    }
  }

  const includeRegs = recipientGroup === 'registrations' || recipientGroup === 'all_attendees'
  const includeSponsors = recipientGroup === 'sponsors' || recipientGroup === 'all_attendees'
  const includeDinners = recipientGroup === 'dinners' || recipientGroup === 'all_attendees'
  const includeDonations = recipientGroup === 'donations'
  const includeSubscribers = recipientGroup === 'subscribers'

  if (includeRegs) {
    const { data } = await supabase
      .from('registrations')
      .select('captain_email, captain_name')
      .eq('paid', true)
    for (const r of data ?? []) add((r as any).captain_email, (r as any).captain_name)
  }
  if (includeSponsors) {
    const { data } = await supabase
      .from('sponsors')
      .select('contact_email, contact_name')
      .eq('paid', true)
    for (const s of data ?? []) add((s as any).contact_email, (s as any).contact_name)
  }
  if (includeDinners) {
    const { data } = await supabase
      .from('dinners')
      .select('guest_email, guest_name')
      .eq('paid', true)
    for (const d of data ?? []) add((d as any).guest_email, (d as any).guest_name)
  }
  if (includeDonations) {
    const { data } = await supabase
      .from('donations')
      .select('donor_email, donor_name')
      .eq('paid', true)
    for (const d of data ?? []) add((d as any).donor_email, (d as any).donor_name)
  }
  if (includeSubscribers) {
    const { data } = await supabase.from('email_subscribers').select('email')
    for (const s of data ?? []) add((s as any).email)
  }

  const recipients = Array.from(recipientMap.values())

  if (dryRun) {
    return new Response(JSON.stringify({ count: recipients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Send via send-transactional-email in parallel batches.
  // Each call is ~200ms — 10 concurrent keeps it under the 150s edge timeout
  // for bulk sends up to ~500 recipients.
  const runId = crypto.randomUUID()
  const batchSize = 10
  let queued = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (r) => {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
              apikey: serviceKey,
            },
            body: JSON.stringify({
              templateName,
              recipientEmail: r.email,
              idempotencyKey: `bulk-${runId}-${r.email}`,
              templateData: {
                // bulk-announcement fields — ignored by other templates
                subject,
                body,
                // shared: every template reads recipientName for the greeting
                recipientName: r.name,
                // caller-provided overrides (event-recap totalRaised, etc.)
                ...templateData,
              },
            }),
          })
          if (resp.ok) queued++
          else {
            failed++
            const text = await resp.text().catch(() => '')
            console.error('Bulk email queue failed', { email: r.email, status: resp.status, body: text.slice(0, 200) })
          }
        } catch (e) {
          failed++
          console.error('Bulk email queue threw', { email: r.email, error: e })
        }
      })
    )
  }

  console.log(`Bulk email run ${runId}: queued=${queued} failed=${failed} total=${recipients.length}`)

  return new Response(
    JSON.stringify({ queued, failed, total: recipients.length, runId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
