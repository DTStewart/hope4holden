// Shared utilities for the Session 2 backfill (and any subsequent admin
// data-management edge functions).
//
// Two themes:
//   1. Email normalization, matching the lower(trim(email)) convention
//      enforced by the unique partial index on contacts (idx_contacts_email_lower)
//      and by the upsert_contact RPC.
//   2. Dollars → cents amount conversion. Source transactional tables
//      (donations, sponsors, dinners, auction_invoices, etc.) store amounts
//      as integer DOLLARS. contact_activities standardized on cents (BIGINT)
//      in Session 1. Conversion happens at write time. The single exception
//      is extra_golfer_invites.price_per_golfer which is ALREADY cents
//      (default 15000 = $150) — see passThroughCents below.

export function normalizeEmail(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (trimmed.length === 0) return null;
  return trimmed.toLowerCase();
}

// Convert integer dollars to cents. Use ONLY for amounts read from the
// dollar-denominated source tables (donations.amount, sponsors.amount,
// dinners.amount, auction_invoices.amount, auction_invoices.tax_receipt_amount).
export function dollarsToCents(dollars: number | null | undefined): number | null {
  if (dollars == null) return null;
  if (typeof dollars !== "number" || !Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

// extra_golfer_invites.price_per_golfer is the one exception in the codebase:
// it is already stored in cents (default 15000 = $150) contrary to the rest
// of the schema. This passthrough exists so the call site reads obviously
// different from the dollarsToCents() call sites — a future cleanup pass
// renaming the column to price_per_golfer_cents will not silently break
// this backfill.
export function passThroughCents(cents: number | null | undefined): number | null {
  if (cents == null) return null;
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return cents;
}
