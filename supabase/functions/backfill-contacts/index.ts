// =============================================================================
// SESSION 2 BACKFILL — Hope 4 Holden contacts + contact_activities
//
// Walks every paid transactional row in the database and writes the
// corresponding contacts + contact_activities records, deduplicating
// contacts on lower(trim(email)) via the upsert_contact RPC.
//
// Invocation:
//   POST { "dry_run": true|false (default true), "source": "all"|<one of below> }
//   sources: donations | sponsors | dinners | auction_invoices
//          | registrations | extra_golfers | all
//   Auth: service-role key OR an admin JWT (gated by has_role).
//
// Returns a structured JSON report with per-source counts, sum totals,
// validation cross-checks, and any per-row errors.
//
// -----------------------------------------------------------------------------
// Tax-receipt policy (LOCKED for this backfill)
// -----------------------------------------------------------------------------
// Both tax_receipt_eligible and receipt_requested are set together — if the
// row is eligible, the receipt is treated as requested. Per Session 2 spec.
//
//   donation             → both true   (gifts are receiptable; donors who
//                                       didn't realize they were eligible
//                                       benefit from getting the receipt)
//   sponsorship          → both false  (exchange of value for recognition,
//                                       not receiptable under Cdn charity law)
//   dinner_ticket        → both false  (meal received at FMV)
//   team_registration    → both false  (round of golf received)
//   extra_golfer         → both false  (round of golf received)
//   silent_auction_win   → both equal to (tax_receipt_amount_cents > 0)
//                                       i.e. "above-FMV portion exists"
//
// -----------------------------------------------------------------------------
// Amount conversion
// -----------------------------------------------------------------------------
// Source tables store integer dollars; contact_activities.amount_cents is
// BIGINT cents. Multiply by 100 at every conversion site. THE SINGLE EXCEPTION
// is extra_golfer_invites.price_per_golfer which is already cents (default
// 15000 = $150). See passThroughCents() in _shared/dedup-helpers.ts.
//
// -----------------------------------------------------------------------------
// Walk order
// -----------------------------------------------------------------------------
// donations → sponsors → dinners → auction_invoices → registrations
//   → extra_golfers. Same person can appear across tables; running
// registrations late (it's the largest dedup surface) makes the dry-run
// output easier to read.
//
// -----------------------------------------------------------------------------
// What this function does NOT do
// -----------------------------------------------------------------------------
// - Does not run schema changes.
// - Does not modify source transaction tables.
// - Does not enrich the 35 pre-launch Stripe Payment Link captains via the
//   Stripe API. That enrichment depends on link-tracking columns
//   (sent_to_contact_id, outbound_link_id) that Session 1.5 didn't ship.
//   Deferred to Session 2.5 once Session 1.6 lands those columns.
// - Does not write payment_method, payment_reference, entered_manually,
//   entered_by, outbound_link_id, sent_to_contact_id — none exist on
//   contact_activities in the current schema.
// - Does not walk auction_bids. Bid history is computed at query time
//   (contacts → auction_bidders → auction_bids); only auction_invoices
//   (winners) get activities here.
// =============================================================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  dollarsToCents,
  normalizeEmail,
  passThroughCents,
} from "../_shared/dedup-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SourceName =
  | "donations"
  | "sponsors"
  | "dinners"
  | "auction_invoices"
  | "registrations"
  | "extra_golfers";

const ALL_SOURCES: SourceName[] = [
  "donations",
  "sponsors",
  "dinners",
  "auction_invoices",
  "registrations",
  "extra_golfers",
];

const EXPECTED_BAND: [number, number] = [86, 96]; // 91 ± 5

type SourceReport = {
  rows_scanned: number;
  contacts_to_create: number; // dry-run only
  contacts_to_match: number; // dry-run only (existing contact OR seen earlier in this run)
  contacts_created: number; // real run only
  contacts_matched: number; // real run only
  activities_created: number;
  sum_amount_cents: number;
  validation_sum_cents: number | null;
  validation_match: boolean | null;
  errors: { row_id: string; message: string }[];
};

function blankReport(): SourceReport {
  return {
    rows_scanned: 0,
    contacts_to_create: 0,
    contacts_to_match: 0,
    contacts_created: 0,
    contacts_matched: 0,
    activities_created: 0,
    sum_amount_cents: 0,
    validation_sum_cents: null,
    validation_match: null,
    errors: [],
  };
}

type WalkCtx = {
  supabase: SupabaseClient;
  dryRun: boolean;
  perSource: Record<SourceName, SourceReport>;
  existingEmailMap: Map<string, string>; // lower-email → existing contact_id
  dryRunWouldCreateEmails: Set<string>; // dry-run only
  allEmailsSeen: Map<
    string,
    { contact_id?: string; sources: SourceName[] }
  >;
};

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  const claims = parseJwtClaims(token);
  const supabase = createClient(supabaseUrl, serviceKey);

  let isAuthorized = claims?.role === "service_role" || token === serviceKey;
  if (
    !isAuthorized &&
    claims?.role === "authenticated" &&
    typeof claims.sub === "string"
  ) {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: claims.sub,
      _role: "admin",
    });
    isAuthorized = isAdmin === true;
  }
  if (!isAuthorized) {
    return jsonResponse(403, { error: "Forbidden" });
  }

  let dryRun = true;
  let sourcesRequested: SourceName[] = ALL_SOURCES;
  if (req.method === "POST") {
    let payload: Record<string, unknown> = {};
    try {
      payload = (await req.json()) ?? {};
    } catch {
      // No body or invalid JSON: fall back to defaults (dry_run=true, source=all).
    }
    if (typeof payload.dry_run === "boolean") dryRun = payload.dry_run;
    if (typeof payload.source === "string") {
      if (payload.source === "all") {
        sourcesRequested = ALL_SOURCES;
      } else if (ALL_SOURCES.includes(payload.source as SourceName)) {
        sourcesRequested = [payload.source as SourceName];
      } else {
        return jsonResponse(400, {
          error: `Unknown source '${payload.source}'. Allowed: all, ${
            ALL_SOURCES.join(", ")
          }`,
        });
      }
    }
  }

  const existingEmailMap = await loadExistingEmailMap(supabase);

  const ctx: WalkCtx = {
    supabase,
    dryRun,
    perSource: Object.fromEntries(
      ALL_SOURCES.map((s) => [s, blankReport()]),
    ) as Record<SourceName, SourceReport>,
    existingEmailMap,
    dryRunWouldCreateEmails: new Set<string>(),
    allEmailsSeen: new Map(),
  };

  for (const source of sourcesRequested) {
    try {
      switch (source) {
        case "donations":
          await walkDonations(ctx);
          break;
        case "sponsors":
          await walkSponsors(ctx);
          break;
        case "dinners":
          await walkDinners(ctx);
          break;
        case "auction_invoices":
          await walkAuctionInvoices(ctx);
          break;
        case "registrations":
          await walkRegistrations(ctx);
          break;
        case "extra_golfers":
          await walkExtraGolfers(ctx);
          break;
      }
    } catch (err) {
      ctx.perSource[source].errors.push({
        row_id: "<source-level>",
        message: errMsg(err),
      });
    }
  }

  // Aggregate
  let totalActivities = 0;
  let totalErrors = 0;
  for (const s of sourcesRequested) {
    totalActivities += ctx.perSource[s].activities_created;
    totalErrors += ctx.perSource[s].errors.length;
  }
  const uniqueEmails = ctx.allEmailsSeen.size;
  const inBand = uniqueEmails >= EXPECTED_BAND[0] &&
    uniqueEmails <= EXPECTED_BAND[1];

  // Spot-check helpers: contacts that appeared in 2+ sources, capped at 10.
  const multiSource: { email: string; sources: SourceName[] }[] = [];
  for (const [email, info] of ctx.allEmailsSeen) {
    if (info.sources.length >= 2) {
      multiSource.push({ email, sources: info.sources });
      if (multiSource.length >= 10) break;
    }
  }

  const perSourceOutput: Record<string, SourceReport> = {};
  for (const s of sourcesRequested) perSourceOutput[s] = ctx.perSource[s];

  return jsonResponse(200, {
    ok: totalErrors === 0 && (dryRun ? inBand : true),
    dry_run: dryRun,
    sources_run: sourcesRequested,
    per_source: perSourceOutput,
    totals: {
      unique_contacts_seen: uniqueEmails,
      total_activities: totalActivities,
      total_errors: totalErrors,
    },
    validation: {
      unique_contacts_expected_band: EXPECTED_BAND,
      unique_contacts_in_band: inBand,
      hard_stop_required: !inBand,
    },
    spot_check: {
      multi_source_contacts_sample: multiSource,
      tip:
        "Pick 5 of these (or any from per_source) and verify by email lookup before invoking with dry_run=false.",
    },
    note: dryRun
      ? "Dry run. No rows written. Re-invoke with { \"dry_run\": false } to commit. Hard stop if unique_contacts_in_band is false."
      : "Committed. Run the verification SQL queries from the Session 2 spec to confirm.",
  });
});

// ---------------------------------------------------------------------------
// Source walkers
// ---------------------------------------------------------------------------

async function walkDonations(ctx: WalkCtx): Promise<void> {
  const r = ctx.perSource.donations;
  const { data, error } = await ctx.supabase
    .from("donations")
    .select(
      "id, donor_email, donor_name, donor_address, donor_city, donor_province, donor_postal_code, amount, tournament_year, paid",
    )
    .eq("paid", true)
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;

  // Validation: Σ(amount × 100) for paid rows
  r.validation_sum_cents =
    rows.reduce((acc, row) => acc + (row.amount ?? 0), 0) * 100;

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.donor_email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "donations.donor_email blank/invalid",
        });
        continue;
      }
      // dollars → cents (×100). Donations source-table convention is integer dollars.
      const cents = dollarsToCents(row.amount);
      if (cents == null) {
        r.errors.push({
          row_id: row.id,
          message: "donations.amount missing/invalid",
        });
        continue;
      }
      const contactId = await resolveContact(ctx, r, email, {
        name: row.donor_name,
        street: row.donor_address,
        city: row.donor_city,
        province: row.donor_province,
        postal_code: row.donor_postal_code,
      }, "donations");

      if (!ctx.dryRun && contactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            activity_type: "donation",
            tournament_year: row.tournament_year ?? null,
            amount_cents: cents,
            payment_processor: "stripe",
            donation_id: row.id,
            tax_receipt_eligible: true,
            receipt_requested: true,
            role_detail: "donor",
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += cents;
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  r.validation_match = r.sum_amount_cents === r.validation_sum_cents;
}

async function walkSponsors(ctx: WalkCtx): Promise<void> {
  const r = ctx.perSource.sponsors;
  const { data, error } = await ctx.supabase
    .from("sponsors")
    .select(
      "id, contact_email, contact_name, contact_phone, business_name, amount, tournament_year, paid",
    )
    .eq("paid", true)
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;
  r.validation_sum_cents =
    rows.reduce((acc, row) => acc + (row.amount ?? 0), 0) * 100;

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.contact_email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "sponsors.contact_email blank/invalid",
        });
        continue;
      }
      // dollars → cents (×100).
      const cents = dollarsToCents(row.amount);
      if (cents == null) {
        r.errors.push({
          row_id: row.id,
          message: "sponsors.amount missing/invalid",
        });
        continue;
      }
      const contactId = await resolveContact(ctx, r, email, {
        name: row.contact_name,
        phone: row.contact_phone,
      }, "sponsors");

      if (!ctx.dryRun && contactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            activity_type: "sponsorship",
            tournament_year: row.tournament_year ?? null,
            amount_cents: cents,
            payment_processor: "stripe",
            sponsor_id: row.id,
            tax_receipt_eligible: false,
            receipt_requested: false,
            role_detail: "sponsor_primary",
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += cents;
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  r.validation_match = r.sum_amount_cents === r.validation_sum_cents;
}

async function walkDinners(ctx: WalkCtx): Promise<void> {
  const r = ctx.perSource.dinners;
  const { data, error } = await ctx.supabase
    .from("dinners")
    .select(
      "id, guest_email, guest_name, guest_phone, amount, tournament_year, paid",
    )
    .eq("paid", true)
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;
  r.validation_sum_cents =
    rows.reduce((acc, row) => acc + (row.amount ?? 0), 0) * 100;

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.guest_email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "dinners.guest_email blank/invalid",
        });
        continue;
      }
      // dollars → cents (×100).
      const cents = dollarsToCents(row.amount);
      if (cents == null) {
        r.errors.push({
          row_id: row.id,
          message: "dinners.amount missing/invalid",
        });
        continue;
      }
      const contactId = await resolveContact(ctx, r, email, {
        name: row.guest_name,
        phone: row.guest_phone,
      }, "dinners");

      if (!ctx.dryRun && contactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            activity_type: "dinner_ticket",
            tournament_year: row.tournament_year ?? null,
            amount_cents: cents,
            payment_processor: "stripe",
            dinner_id: row.id,
            tax_receipt_eligible: false,
            receipt_requested: false,
            role_detail: "dinner_attendee",
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += cents;
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  r.validation_match = r.sum_amount_cents === r.validation_sum_cents;
}

async function walkAuctionInvoices(ctx: WalkCtx): Promise<void> {
  // Build bidder_id → {email, display_name, phone} map up front.
  const { data: bidders, error: bErr } = await ctx.supabase
    .from("auction_bidders")
    .select("id, email, display_name, phone")
    .limit(10000);
  if (bErr) throw bErr;
  const bidderMap = new Map<
    string,
    { email: string; display_name: string; phone: string | null }
  >();
  for (const b of bidders ?? []) {
    bidderMap.set(b.id, {
      email: b.email,
      display_name: b.display_name,
      phone: b.phone,
    });
  }

  const r = ctx.perSource.auction_invoices;
  // auction_invoices has paid_at (timestamptz, nullable) rather than a `paid`
  // boolean. Treat paid_at IS NOT NULL as the paid filter.
  const { data, error } = await ctx.supabase
    .from("auction_invoices")
    .select("id, bidder_id, amount, tax_receipt_amount, paid_at")
    .not("paid_at", "is", null)
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;
  r.validation_sum_cents =
    rows.reduce((acc, row) => acc + (row.amount ?? 0), 0) * 100;

  for (const row of rows) {
    try {
      const bidder = bidderMap.get(row.bidder_id);
      if (!bidder) {
        r.errors.push({
          row_id: row.id,
          message: `bidder_id ${row.bidder_id} not found in auction_bidders`,
        });
        continue;
      }
      const email = normalizeEmail(bidder.email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "auction_bidders.email blank/invalid",
        });
        continue;
      }
      // dollars → cents (×100) for both the win amount and the receipt portion.
      const cents = dollarsToCents(row.amount);
      if (cents == null) {
        r.errors.push({
          row_id: row.id,
          message: "auction_invoices.amount missing/invalid",
        });
        continue;
      }
      const taxCentsRaw = row.tax_receipt_amount != null
        ? dollarsToCents(row.tax_receipt_amount)
        : null;
      const eligible = taxCentsRaw != null && taxCentsRaw > 0;
      const taxCents = eligible ? taxCentsRaw : null;

      const contactId = await resolveContact(ctx, r, email, {
        name: bidder.display_name,
        phone: bidder.phone ?? undefined,
      }, "auction_invoices");

      if (!ctx.dryRun && contactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            // Session 1.5 added 'silent_auction_win' as a more specific value.
            // H4H is silent-auction only; use the specific value over the
            // generic 'auction_win' (still valid in the CHECK enum).
            activity_type: "silent_auction_win",
            // TEMPORARY DERIVATION: tournament_year is not stored on
            // auction_invoices or auction_items directly. We derive it from
            // paid_at (the timestamp we filter on, so always present here).
            // Edge case: a 2026 invoice paid in 2027 would be tagged 2027.
            // Not a real risk for H4H given the close-to-payment turnaround,
            // and the tournament has only run in 2026 so far. Session 1.6
            // backlog: add a real tournament_year column on auction_invoices
            // (bundle with the outbound_links migration) and remove this
            // derivation in favor of the column read.
            tournament_year: deriveYearFromTimestamp(row.paid_at),
            amount_cents: cents,
            tax_receipt_amount_cents: taxCents,
            payment_processor: "stripe",
            auction_invoice_id: row.id,
            // Both flags move together: eligible iff above-FMV > 0.
            tax_receipt_eligible: eligible,
            receipt_requested: eligible,
            role_detail: "auction_winner",
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += cents;
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  r.validation_match = r.sum_amount_cents === r.validation_sum_cents;
}

async function walkRegistrations(ctx: WalkCtx): Promise<void> {
  // Walks registrations rows where is_extra_golfers IS NOT TRUE — i.e. the
  // genuine team-registration rows. The is_extra_golfers=true rows are the
  // redeemed children of extra_golfer_invites and are handled by
  // walkExtraGolfers() with a different activity_type and amount source.
  //
  // Per the Session 2 spec:
  //   - Captain: amount_cents = 60000 (full $600 team fee, attributed to the
  //     captain by convention because a single Stripe charge captured it).
  //   - Each team_member with non-empty email: amount_cents = NULL (captain
  //     paid; storing zero would pollute lifetime-value averages).
  //   - Pre-launch imports (35 rows; team_members IS NULL OR '[]'): captain
  //     only. The Stripe API enrichment to recover lost teammate data is
  //     deferred to Session 2.5.

  const r = ctx.perSource.registrations;
  const { data, error } = await ctx.supabase
    .from("registrations")
    .select(
      "id, captain_email, captain_name, captain_phone, captain_address, captain_city, captain_province, captain_postal_code, team_members, tournament_year, paid, is_extra_golfers",
    )
    .eq("paid", true)
    .or("is_extra_golfers.is.null,is_extra_golfers.eq.false")
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;

  // Validation sum: $600 per registration (the convention the captain
  // activity records). Teammate rows have amount_cents=NULL so they don't
  // contribute. This is not a SELECT sum(amount) cross-check (registrations
  // has no amount column) but it does verify the per-row constant.
  r.validation_sum_cents = rows.length * 60000;

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.captain_email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "registrations.captain_email blank/invalid",
        });
        continue;
      }
      const captainContactId = await resolveContact(ctx, r, email, {
        name: row.captain_name,
        phone: row.captain_phone,
        street: row.captain_address,
        city: row.captain_city,
        province: row.captain_province,
        postal_code: row.captain_postal_code,
      }, "registrations");

      if (!ctx.dryRun && captainContactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: captainContactId,
            activity_type: "team_registration",
            tournament_year: row.tournament_year ?? null,
            // Convention: full $600 team fee attributed to captain.
            amount_cents: 60000,
            payment_processor: "stripe",
            registration_id: row.id,
            tax_receipt_eligible: false,
            receipt_requested: false,
            role_detail: "captain",
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert captain: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += 60000;

      // Teammate rows. team_members is JSONB; defensive parse. Skip silently
      // if absent or empty (pre-launch imports).
      const members = parseTeamMembers(row.team_members);
      for (let i = 0; i < members.length; i++) {
        const m = members[i] ?? {};
        const memberEmail = normalizeEmail(m.email);
        const memberName = (m.name ?? "").toString().trim();
        if (!memberEmail) continue; // empty/missing email → skip silently
        if (!memberName) {
          r.errors.push({
            row_id: `${row.id}#member${i}`,
            message: "team_member has email but blank name",
          });
          continue;
        }
        const memberContactId = await resolveContact(ctx, r, memberEmail, {
          name: memberName,
        }, "registrations");

        if (!ctx.dryRun && memberContactId) {
          const { error: insErr } = await ctx.supabase
            .from("contact_activities")
            .insert({
              contact_id: memberContactId,
              activity_type: "team_registration",
              tournament_year: row.tournament_year ?? null,
              // NULL (not zero): captain paid, not the teammate. Zero would
              // pollute lifetime-value averages and "top contributor" rollups.
              amount_cents: null,
              payment_processor: "stripe",
              registration_id: row.id,
              tax_receipt_eligible: false,
              receipt_requested: false,
              role_detail: "golfer",
            });
          if (insErr) {
            r.errors.push({
              row_id: `${row.id}#member${i}`,
              message: `insert teammate: ${insErr.message}`,
            });
            continue;
          }
        }
        r.activities_created += 1;
      }
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  // Validation match check: only the captain rows carry $600. activities
  // beyond rows.length are teammate NULL-amount rows that don't contribute.
  r.validation_match = r.sum_amount_cents === r.validation_sum_cents;
}

async function walkExtraGolfers(ctx: WalkCtx): Promise<void> {
  // registrations rows where is_extra_golfers=true AND paid=true.
  // Amount comes from extra_golfer_invites.price_per_golfer (looked up via
  // parent_token).
  //
  // CRITICAL: extra_golfer_invites.price_per_golfer is ALREADY in cents
  // (default 15000 = $150). DO NOT multiply by 100. This is the single
  // exception to the dollar→cents convention used everywhere else in this
  // backfill. passThroughCents() is the no-op marker so a future "amount
  // cleanup" PR doesn't silently break this conversion.

  const r = ctx.perSource.extra_golfers;
  const { data: invites, error: invErr } = await ctx.supabase
    .from("extra_golfer_invites")
    .select("token, price_per_golfer, golfer_count")
    .limit(10000);
  if (invErr) throw invErr;
  const inviteMap = new Map<
    string,
    { price_per_golfer: number; golfer_count: number }
  >();
  for (const inv of invites ?? []) {
    inviteMap.set(inv.token, {
      price_per_golfer: inv.price_per_golfer,
      golfer_count: inv.golfer_count,
    });
  }

  const { data, error } = await ctx.supabase
    .from("registrations")
    .select(
      "id, captain_email, captain_name, captain_phone, parent_token, tournament_year, paid, is_extra_golfers",
    )
    .eq("paid", true)
    .eq("is_extra_golfers", true)
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  r.rows_scanned = rows.length;

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.captain_email);
      if (!email) {
        r.errors.push({
          row_id: row.id,
          message: "extra_golfer registration captain_email blank/invalid",
        });
        continue;
      }
      if (!row.parent_token) {
        r.errors.push({
          row_id: row.id,
          message: "extra_golfer registration missing parent_token",
        });
        continue;
      }
      const invite = inviteMap.get(row.parent_token);
      if (!invite) {
        r.errors.push({
          row_id: row.id,
          message:
            `extra_golfer_invites.token=${row.parent_token} not found`,
        });
        continue;
      }

      // EXCEPTION TO DOLLAR→CENT RULE: price_per_golfer is already cents.
      // passThroughCents() is intentional. Do not "fix" this to dollarsToCents()
      // without first migrating the column to a price_per_golfer_cents rename.
      const cents = passThroughCents(invite.price_per_golfer);
      if (cents == null) {
        r.errors.push({
          row_id: row.id,
          message: "extra_golfer_invites.price_per_golfer null",
        });
        continue;
      }

      const contactId = await resolveContact(ctx, r, email, {
        name: row.captain_name,
        phone: row.captain_phone,
      }, "extra_golfers");

      if (!ctx.dryRun && contactId) {
        const { error: insErr } = await ctx.supabase
          .from("contact_activities")
          .insert({
            contact_id: contactId,
            activity_type: "extra_golfer",
            tournament_year: row.tournament_year ?? null,
            amount_cents: cents,
            payment_processor: "stripe",
            // Link to the redeemed child registration row. The parent
            // extra_golfer_invites row has no typed FK column on
            // contact_activities and the source_table whitelist is just a
            // placeholder, so we record the invite token in notes for trace.
            registration_id: row.id,
            tax_receipt_eligible: false,
            receipt_requested: false,
            role_detail: "extra_golfer",
            notes: `extra_golfer_invites.token=${row.parent_token}`,
          });
        if (insErr) {
          r.errors.push({
            row_id: row.id,
            message: `insert: ${insErr.message}`,
          });
          continue;
        }
      }
      r.activities_created += 1;
      r.sum_amount_cents += cents;
    } catch (err) {
      r.errors.push({ row_id: row.id, message: errMsg(err) });
    }
  }
  // No source-table sum cross-check available (price_per_golfer isn't summed
  // in any other rollup), but we record the per-source total for the report.
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadExistingEmailMap(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, email")
    .not("email", "is", null)
    .limit(10000);
  if (error) throw error;
  for (const c of data ?? []) {
    const e = normalizeEmail(c.email);
    if (e) m.set(e, c.id);
  }
  return m;
}

type ContactInput = {
  name: string | null | undefined;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

async function resolveContact(
  ctx: WalkCtx,
  r: SourceReport,
  email: string,
  input: ContactInput,
  source: SourceName,
): Promise<string | null> {
  // Track for the cross-source dedup report.
  const seen = ctx.allEmailsSeen.get(email);
  if (seen) {
    if (!seen.sources.includes(source)) seen.sources.push(source);
  } else {
    ctx.allEmailsSeen.set(email, { sources: [source] });
  }

  if (ctx.dryRun) {
    if (ctx.existingEmailMap.has(email)) {
      r.contacts_to_match += 1;
      return ctx.existingEmailMap.get(email)!;
    }
    if (ctx.dryRunWouldCreateEmails.has(email)) {
      // Already projected for creation by an earlier source in this dry-run.
      r.contacts_to_match += 1;
      return null;
    }
    ctx.dryRunWouldCreateEmails.add(email);
    r.contacts_to_create += 1;
    return null;
  }

  // Real run.
  if (!input.name || String(input.name).trim().length === 0) {
    throw new Error(
      `upsert_contact requires non-empty name (email=${email}, source=${source})`,
    );
  }
  const args: Record<string, unknown> = {
    p_email: email,
    p_name: String(input.name),
  };
  if (input.phone != null && String(input.phone).trim() !== "") {
    args.p_phone = String(input.phone);
  }
  if (input.street != null && String(input.street).trim() !== "") {
    args.p_street = String(input.street);
  }
  if (input.city != null && String(input.city).trim() !== "") {
    args.p_city = String(input.city);
  }
  if (input.province != null && String(input.province).trim() !== "") {
    args.p_province = String(input.province);
  }
  if (
    input.postal_code != null && String(input.postal_code).trim() !== ""
  ) {
    args.p_postal_code = String(input.postal_code);
  }
  if (input.country != null && String(input.country).trim() !== "") {
    args.p_country = String(input.country);
  }

  const { data, error } = await ctx.supabase.rpc("upsert_contact", args);
  if (error) throw error;
  const id = String(data);

  if (ctx.existingEmailMap.has(email)) {
    r.contacts_matched += 1;
  } else {
    r.contacts_created += 1;
    ctx.existingEmailMap.set(email, id); // future lookups in same run match
  }
  const e = ctx.allEmailsSeen.get(email);
  if (e) e.contact_id = id;
  return id;
}

function parseTeamMembers(value: unknown): { name?: string; email?: string }[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value as { name?: string; email?: string }[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Derive a tournament_year integer from a timestamptz string. Used by the
// auction_invoices walker as a temporary measure until Session 1.6 adds a
// real tournament_year column. Returns null when the input is unparseable.
function deriveYearFromTimestamp(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function errMsg(err: unknown): string {
  if (err == null) return "unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
