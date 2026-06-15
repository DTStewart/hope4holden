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

// idKey disambiguates recipients within a run for idempotency. It defaults to
// the email; roster modes set it to the unique score_token so that test rows
// sharing one captain_email (or a captain managing two teams) each still send.
type Recipient = { email: string; name?: string; data?: Record<string, unknown>; idKey?: string }

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
  // bulk-announcement and roster-request both render a caller-controlled
  // subject + body, so require them. Other templates rely solely on
  // templateData, so the requirement is only enforced for these two.
  const requiresSubjectBody = templateName === 'bulk-announcement' || templateName === 'roster-request'
  if (!dryRun && requiresSubjectBody && (!subject || !body)) {
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

  // Roster-request modes are a separate path: they target paid 2026 team
  // captains, deduplicated by team (score_token) rather than by email, and
  // carry per-recipient teamName + manageUrl. These do NOT mix with the
  // announcement groups below and never touch recipientMap.
  //   roster_2026      -> the real captains (test rows + placeholder excluded)
  //   roster_2026_test -> ONLY the zzz-test- rows, for a safe end-to-end test
  const isRosterProd = recipientGroup === 'roster_2026'
  const isRosterTest = recipientGroup === 'roster_2026_test'
  const isRosterRetry = recipientGroup === 'roster_2026_retry13'
  const isRoster = isRosterProd || isRosterTest || isRosterRetry

  const RETRY_13_TOKENS = [
    'bee83a57-236a-44e1-b5a1-925f1575b6fe',
    '27eb4bbe-c6f8-4f22-895b-53fcce3203ef',
    'cf7287fc-0243-4e49-92a1-569a331e3d7e',
    '30d9c9c5-5d67-426d-80b5-980c2d78561d',
    '536daa84-18b4-403d-8cb1-40708b73c549',
    '882ca5d6-db00-464a-b273-b7bb3c5f6ee0',
    '8965b8b2-b8bb-480b-9107-eaa3053d805f',
    'c2746b5f-8eff-45b9-899e-509578938f9c',
    'bcd9310d-575c-41c0-84fa-d236cad83152',
    '9be35b5f-cb45-4aae-bf37-a5ffc38c23b6',
    '6cf2ff93-b5f7-4301-b03f-5277c9445fbf',
    '798d4c5c-4b30-4c5d-a8f7-3a5eb1c360b9',
    '57c8cf58-5ebb-41ae-9510-b5fcbc75f5b3',
  ]

  const isEveryone = recipientGroup === 'everyone'
  const isAllGolfers = recipientGroup === 'all_golfers'
  const includeRegs = !isRoster && (recipientGroup === 'registrations' || recipientGroup === 'all_attendees' || isEveryone)
  const includeSponsors = !isRoster && (recipientGroup === 'sponsors' || recipientGroup === 'all_attendees' || isEveryone)
  const includeDinners = !isRoster && (recipientGroup === 'dinners' || recipientGroup === 'all_attendees' || isEveryone)
  const includeDonations = !isRoster && (recipientGroup === 'donations' || isEveryone)
  const includeSubscribers = !isRoster && recipientGroup === 'subscribers'
  const includeRosterGolfers = !isRoster && (isAllGolfers || isEveryone)

  if (includeRosterGolfers) {
    const { data: yearData } = await supabase.rpc('get_current_tournament_year')
    const currentYear = typeof yearData === 'number' ? yearData : 2026
    const { data } = await supabase
      .from('registrations')
      .select('captain_email, captain_name, team_members')
      .eq('paid', true)
      .eq('status', 'confirmed')
      .eq('tournament_year', currentYear)
    for (const r of data ?? []) {
      const row = r as Record<string, any>
      add(row.captain_email, row.captain_name)
      const members = Array.isArray(row.team_members) ? row.team_members : []
      for (const m of members) {
        if (m && typeof m === 'object') {
          add((m as any).email, (m as any).name)
        }
      }
    }
  }

  // Built only for roster modes; deduplicated by score_token below.
  const rosterByToken = new Map<string, Recipient>()
  if (isRoster) {
    let query = supabase
      .from('registrations')
      .select('captain_name, captain_email, team_name, score_token, golfer_count')
      .eq('paid', true)
      .eq('tournament_year', 2026)
      .eq('is_extra_golfers', false)
      .neq('captain_email', 'sneath-pending@hope4holden.com')

    // Production: exclude the test rows. Test: target ONLY the test rows.
    query = isRosterTest
      ? query.like('team_slug', 'zzz-test-%')
      : query.not('team_slug', 'like', 'zzz-test-%')

    const { data } = await query
    for (const r of data ?? []) {
      const row = r as Record<string, any>
      const email = typeof row.captain_email === 'string' ? row.captain_email.trim().toLowerCase() : ''
      const token = typeof row.score_token === 'string' ? row.score_token.trim() : ''
      if (!email || !email.includes('@') || !token) continue
      if (rosterByToken.has(token)) continue
      rosterByToken.set(token, {
        email,
        idKey: token,
        name: typeof row.captain_name === 'string' && row.captain_name.trim() ? row.captain_name.trim() : undefined,
        data: {
          teamName: row.team_name ?? undefined,
          manageUrl: `https://hope4holden.com/team/manage/${token}`,
        },
      })
    }
  }

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

  const recipients = isRoster
    ? Array.from(rosterByToken.values())
    : Array.from(recipientMap.values())

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
              idempotencyKey: `bulk-${runId}-${r.idKey ?? r.email}`,
              templateData: {
                // bulk-announcement / roster-request fields (ignored by other templates)
                subject,
                body,
                // shared: every template reads recipientName for the greeting
                recipientName: r.name,
                // caller-provided overrides (event-recap totalRaised, etc.)
                ...templateData,
                // per-recipient merge (roster-request teamName + manageUrl) must win
                ...(r.data ?? {}),
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
