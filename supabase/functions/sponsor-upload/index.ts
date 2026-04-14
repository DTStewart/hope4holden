import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // GET: validate token
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sponsor, error } = await supabase
      .from("sponsors")
      .select("id, business_name, tier_name, logo_url, brand_assets")
      .eq("logo_upload_token", token)
      .single();

    if (error || !sponsor) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sponsor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PUT: upload a single file (called per file from the client)
  if (req.method === "PUT") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const filename = url.searchParams.get("filename") || "file.png";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: sponsor, error: findError } = await supabase
      .from("sponsors")
      .select("id")
      .eq("logo_upload_token", token)
      .single();

    if (findError || !sponsor) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read file from request body
    const fileData = await req.arrayBuffer();
    const contentType = req.headers.get("content-type") || "application/octet-stream";

    // Validate file size (10MB)
    if (fileData.byteLength > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large (max 10MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate content type
    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!allowedTypes.includes(contentType)) {
      return new Response(JSON.stringify({ error: "Invalid file type. Only PNG, JPG, SVG allowed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = filename.split(".").pop() || "png";
    const path = `${sponsor.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("sponsor-logos")
      .upload(path, fileData, { contentType, upsert: true });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Upload failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: urlData } = supabase.storage.from("sponsor-logos").getPublicUrl(path);

    return new Response(JSON.stringify({ url: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST: save uploaded assets metadata to sponsor record
  if (req.method === "POST") {
    const { token, logoUrl, assets } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sponsor, error: findError } = await supabase
      .from("sponsors")
      .select("id, brand_assets")
      .eq("logo_upload_token", token)
      .single();

    if (findError || !sponsor) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingAssets = Array.isArray(sponsor.brand_assets) ? sponsor.brand_assets : [];
    const newAssets = Array.isArray(assets) ? assets : [];
    const allAssets = [...existingAssets, ...newAssets];

    const primaryLogo = logoUrl || (allAssets.length > 0 ? (allAssets[0] as any).url : null);

    const updateData: Record<string, any> = { brand_assets: allAssets };
    if (primaryLogo) {
      updateData.logo_url = primaryLogo;
    }

    const { error: updateError } = await supabase
      .from("sponsors")
      .update(updateData)
      .eq("id", sponsor.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
