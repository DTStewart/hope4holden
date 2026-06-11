import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Server-authoritative pricing for admin-generated registration links.
// Mirrors the public $600 team price plus $150 per extra golfer above 4.
// Hard max 6: any teamSize not in this map is rejected.
const TEAM_PRICE: Record<number, number> = { 4: 600, 5: 750, 6: 900 };

// Local JWT payload decode (no extra deps), same approach as admin-bulk-email.
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- Auth: admin only (unchanged, mirrors admin-bulk-email) ----
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

    // ---- Input: only teamSize. Captain/team details are NOT collected here;
    // the payer fills those in at /register-invite/{token}, sponsor-style. ----
    const { teamSize } = await req.json();

    // Validate teamSize server-side: must be 4, 5, or 6 (hard max 6).
    const size = Number(teamSize);
    if (!TEAM_PRICE[size]) {
      return new Response(
        JSON.stringify({ error: "teamSize must be 4, 5, or 6" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-authoritative amount (dollars), never from the client.
    const amount = TEAM_PRICE[size];

    // ---- Create the invite row. team_size and amount are admin-set and
    // payer-proof: create-checkout re-reads them server-side by token. ----
    const { data: invite, error: inviteError } = await supabase
      .from("registration_invites")
      .insert({ team_size: size, amount })
      .select("token")
      .single();
    if (inviteError) throw new Error(`Failed to create registration invite: ${inviteError.message}`);

    const url = `https://hope4holden.com/register-invite/${invite.token}`;
    return new Response(JSON.stringify({ url }), {
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
