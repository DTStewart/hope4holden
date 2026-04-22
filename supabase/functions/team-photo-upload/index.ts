import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

// PUT /team-photo-upload?token=UUID&filename=photo.jpg
// Body: raw image bytes (PNG / JPEG / HEIC)
// Auth: score_token (the captain's private team link)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'PUT') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const filename = url.searchParams.get('filename') || 'team.jpg'
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, paid')
    .eq('score_token', token)
    .maybeSingle()

  if (!reg || !reg.paid) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const fileData = await req.arrayBuffer()
  const contentType = req.headers.get('content-type') || 'application/octet-stream'

  if (fileData.byteLength > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/heic', 'image/heif']
  if (!allowedTypes.includes(contentType)) {
    return new Response(JSON.stringify({ error: 'Only PNG, JPG, or HEIC photos.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const allowedExts = ['png', 'jpg', 'jpeg', 'heic', 'heif']
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const safeExt = allowedExts.includes(ext) ? ext : 'jpg'
  const path = `${reg.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from('team-photos')
    .upload(path, fileData, { contentType, upsert: false })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return new Response(JSON.stringify({ error: 'Upload failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(path)

  return new Response(JSON.stringify({ url: urlData.publicUrl }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
