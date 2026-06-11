import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Server-authoritative pricing for admin-generated registration links.
// Mirrors the public $600 team price plus $150 per extra golfer above 4.
// Hard max 6 — any teamSize not in this map is rejected.
const TEAM_PRICE: Record<number, number> = { 4: 600, 5: 750, 6: 900 };

// Local JWT payload decode (no extra deps) — same approach as admin-bulk-email.
function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Short reference id so a "Ref: abc123" complaint can be grep'd from logs.
  const refId = crypto.randomUUID().slice(0, 8);

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- Auth: admin only (mirrors admin-bulk-email exactly) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const claims = parseJwtClaims(token);

    // Accept either an admin JWT or a direct service-role call.
    let isAuthorized =
      claims?.role === "service_role" || token === SUPABASE_SERVICE_ROLE_KEY;
    if (!isAuthorized && claims?.role === "authenticated" && typeof claims.sub === "string") {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: claims.sub,
        _role: "admin",
      });
      isAuthorized = isAdmin === true;
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Inputs ----
    const { captainName, captainEmail, captainPhone, teamName, teamSize, returnUrl } =
      await req.json();

    // Validate teamSize server-side: must be 4, 5, or 6 (hard max 6).
    const size = Number(teamSize);
    if (!TEAM_PRICE[size]) {
      return new Response(
        JSON.stringify({ error: "teamSize must be 4, 5, or 6" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!captainEmail || typeof captainEmail !== "string") {
      return new Response(
        JSON.stringify({ error: "captainEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-authoritative amount (dollars) — never trust the client.
    const amount = TEAM_PRICE[size];

    // ---- Build the order item in the EXACT shape the webhook reads ----
    // formData keys match stripe-webhook's registration branch. registration_source
    // is stamped on the ITEM (the webhook reads item.registration_source).
    const teamLabel = teamName || "Unknown Team";
    const item = {
      type: "registration",
      description: `Team Registration — ${teamLabel}`,
      amount,
      registration_source: "admin_link",
      formData: {
        teamName: teamLabel,
        captainName: captainName || "",
        captainEmail,
        captainPhone: captainPhone || "",
        teamSize: size,
      },
    };
    const validatedItems = [item];
    const totalAmount = amount;

    // ---- pending_orders insert: EXACT columns create-checkout uses ----
    const { data: orderData, error: orderError } = await supabase
      .from("pending_orders")
      .insert({
        items: validatedItems,
        total_amount: totalAmount,
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError) throw new Error(`Failed to create pending order: ${orderError.message}`);

    // ---- Stripe checkout session (mirrors create-checkout) ----
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    const lineItems = validatedItems.map((it: any) => ({
      price_data: {
        currency: "cad",
        product_data: {
          name: it.description,
          metadata: { type: it.type },
        },
        unit_amount: Math.round(it.amount * 100),
      },
      quantity: 1,
    }));

    // No cart page for an admin-generated link — default to the bare homepage.
    const base = (returnUrl && typeof returnUrl === "string" ? returnUrl : "https://hope4holden.com/");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${base}?success=true&order_id=${orderData.id}`,
      cancel_url: `${base}?canceled=true`,
      metadata: {
        pending_order_id: orderData.id,
        // Mirrored for future CRM use; Part B reads the source off the item, not here.
        registration_source: "admin_link",
      },
    });

    // Link the session id back so the success page can find the row.
    const { error: sessionLinkError } = await supabase
      .from("pending_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderData.id);
    if (sessionLinkError) {
      console.error(`[${refId}] Failed to link pending_order to stripe session:`, sessionLinkError.message);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${refId}] create-registration-link error:`, error);
    return new Response(
      JSON.stringify({ error: `Failed to create registration link. Please try again. (Ref: ${refId})` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
