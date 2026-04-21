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

  // GET: validate token OR look up sponsors by order_id
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const orderId = url.searchParams.get("order_id");

    if (orderId) {
      // Look up sponsors created from this pending order's stripe session
      const { data: order } = await supabase
        .from("pending_orders")
        .select("stripe_session_id")
        .eq("id", orderId)
        .single();

      if (!order?.stripe_session_id) {
        return new Response(JSON.stringify({ sponsors: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sponsors } = await supabase
        .from("sponsors")
        .select("id, business_name, tier_name, contact_email, logo_url, brand_assets, logo_upload_token, facebook_handle, instagram_handle")
        .eq("stripe_session_id", order.stripe_session_id);

      return new Response(JSON.stringify({ sponsors: sponsors || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sponsor, error } = await supabase
      .from("sponsors")
      .select("id, business_name, tier_name, contact_email, logo_url, brand_assets, facebook_handle, instagram_handle")
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
    const allowedTypes = ["image/png", "image/jpeg"];
    if (!allowedTypes.includes(contentType)) {
      return new Response(JSON.stringify({ error: "Invalid file type. Only PNG and JPG allowed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedExts = ["png", "jpg", "jpeg"];
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExts.includes(ext)) {
      return new Response(JSON.stringify({ error: "Invalid file extension. Only .png, .jpg, .jpeg allowed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

  // POST: save uploaded assets metadata + social handles to sponsor record
  if (req.method === "POST") {
    const { token, logoUrl, assets, facebookHandle, instagramHandle } = await req.json();
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

    const updateData: Record<string, any> = {};
    if (newAssets.length > 0) updateData.brand_assets = allAssets;
    if (primaryLogo) updateData.logo_url = primaryLogo;
    if (typeof facebookHandle === "string") updateData.facebook_handle = facebookHandle || null;
    if (typeof instagramHandle === "string") updateData.instagram_handle = instagramHandle || null;

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
