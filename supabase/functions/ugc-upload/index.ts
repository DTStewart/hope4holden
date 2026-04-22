import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
}

// Auth: token is the team's score_token (same private link captains already use).
// PUT /ugc-upload?token=UUID&filename=photo.jpg
//   Body: raw image bytes (PNG / JPEG / HEIC)
//   Returns: { url }
// POST /ugc-upload
//   Body: { token, photo_url, caption? }
//   Records the submission in ugc_photos (status='pending').

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  if (req.method === 'PUT') {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const filename = url.searchParams.get('filename') || 'photo.jpg'
    if (!token) {
      return json({ error: 'Missing token' }, 400)
    }

    const { data: reg } = await supabase
      .from('registrations')
      .select('id, paid')
      .eq('score_token', token)
      .maybeSingle()

    if (!reg || !reg.paid) {
      return json({ error: 'Invalid token' }, 404)
    }

    const fileData = await req.arrayBuffer()
    const contentType = req.headers.get('content-type') || 'application/octet-stream'

    if (fileData.byteLength > 10 * 1024 * 1024) {
      return json({ error: 'File too large (max 10MB)' }, 400)
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(contentType)) {
      return json({ error: 'Only PNG, JPG, or HEIC photos.' }, 400)
    }

    const allowedExts = ['png', 'jpg', 'jpeg', 'heic', 'heif']
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = allowedExts.includes(ext) ? ext : 'jpg'
    const path = `${reg.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

    const { error: uploadError } = await supabase.storage
      .from('ugc-photos')
      .upload(path, fileData, { contentType, upsert: false })

    if (uploadError) {
      console.error('UGC upload error:', uploadError)
      return json({ error: 'Upload failed' }, 500)
    }

    const { data: urlData } = supabase.storage.from('ugc-photos').getPublicUrl(path)
    return json({ url: urlData.publicUrl })
  }

  if (req.method === 'POST') {
    let body: { token?: string; photo_url?: string; caption?: string }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const token = body.token
    const photoUrl = body.photo_url
    const caption = body.caption ?? null
    if (!token || !photoUrl) {
      return json({ error: 'Missing fields' }, 400)
    }

    const { data, error } = await supabase.rpc('submit_team_ugc', {
      _token: token,
      _photo_url: photoUrl,
      _caption: caption,
    })
    if (error) {
      console.error('submit_team_ugc failed:', error)
      return json({ error: error.message }, 500)
    }
    const result = data as { ok?: boolean; error?: string } | null
    if (!result?.ok) {
      return json({ error: result?.error || 'submit_failed' }, 400)
    }
    return json({ ok: true })
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
