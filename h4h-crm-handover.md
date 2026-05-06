# Hope 4 Holden — CRM Build Handover (Revision 2)

**Use this as the first message of a new Claude conversation when you're ready to start the CRM build. It contains everything the next session needs to pick up where we left off.**

**Revision 2 changes (May 2026):** Added outbound_links table for sent-link tracking, added payment_method and link-attribution columns to contact_activities, added Session 1.5 (link tracking schema), expanded Session 6 (manual-entry dialogs and outbound links admin tab). Supersedes BACKLOG.md item #2 (walk-up donations).

---

## What I want to build

A real CRM for Hope 4 Holden, replacing the current pattern of person-data-scattered-across-transaction-tables with a unified contacts model that lets me track every person who has interacted with us across all years, all transaction types, and (eventually) all events I run. Plus a layer on top for tracking outbound payment links — who I sent them to, whether they redeemed, and attribution back to the sender when the paying entity differs from the recipient.

The architecture decision is locked in: Pattern 3 — a `contacts` table plus a `contact_activities` table, plus an `outbound_links` table for link tracking. This is documented in detail below.

## Why now

I'm running this tournament again in 2026 and beyond, and want cross-year and cross-event tracking. The current schema has nine different tables holding name+email pairs with overlapping but inconsistent shapes. Every new feature that needs "who supported us" has to union across them. I want to fix this once and have the right foundation for the next 5 years of fundraising operations.

There's also a pre-tournament timing factor: I want to start collecting marketing consents soon because there will be significant outreach in the weeks leading up to June 18-19. Consent collection itself moves up in the build sequence to enable that.

The link-tracking layer was added in Revision 2 because manual workflow during the season needs visibility: when I send a Stripe checkout link to a sponsor prospect, I need to know whether they've paid, and if a different entity ends up paying (Bob sent it, ACME paid), I need both names captured for relationship and attribution reporting.

## What's been built leading up to this

In the conversation that preceded this one, I:

- Hardened admin authentication (isolated Supabase client storage key, removed a refresh race in useAuth, narrowed error handling so transient failures don't demote admins)
- Built `AdminDataTable`, a shared component giving sort/filter/search/CSV export/mobile cards across most admin tabs (Phase 1 + Phase 2 shipped)
- Investigated and resolved two Lovable security warnings (registrations RLS confirmed correct, extra_golfer_invites correctly uses a SECURITY DEFINER lookup function)
- Tightened explicit grants on `lookup_extra_golfer_invite` (committed as a migration)
- Confirmed with ATCP that they will issue tax receipts directly, updated public copy accordingly
- Built a public donation ticker on the homepage and `/register#donate`: opt-in consent flow, RPC for recent donors, RPC for supporter count, "A friend of Holden" label for non-consenting donors, header line showing "[N] supporters this year"
- Identified that `extra_golfer_invites.price_per_golfer` is the only cents-denominated column in a codebase that otherwise uses integer dollars (latent bug, separate cleanup item)
- Identified that `get_fundraising_total()` undercounts/overcounts when extra-golfer rows exist (separate cleanup item)
- Identified that email uniqueness is inconsistent across tables, case-sensitive in some, case-insensitive in others (this is part of the CRM work)

The donation ticker work currently uses `donations.public_display_consent` and `donations.public_display_name` columns. When the CRM is built, this consent should migrate to live on the `contacts` row instead of per-transaction. That's one of the planned migration steps.

## CASL framing for pre-tournament outreach

Before any of the technical work, the legal frame matters because it shapes the build sequence:

**Pre-tournament emails to people already in 2026 transaction tables** (donors, registered captains, sponsors, dinner attendees) are permitted under CASL's implied consent for operational and transactional communications related to the current tournament they're already engaged with. You do NOT need express consent before sending pre-tournament updates, schedule reminders, day-of info, etc. to people already in 2026 transactions.

**Express consent is required for**:
- Marketing communications to people who haven't transacted yet this year
- Year-2027 save-the-date and future-year fundraising appeals
- Outreach about other Stewart family events outside H4H golf
- Any communication to teammates whose info was entered by a captain (those teammates didn't personally consent — only the captain did, and consent is non-transferable under CASL)

Implied consent expires 2 years after the transactional relationship ends. So 2026 donors can be contacted under implied consent through 2028 about H4H matters, but year-2027 marketing should still ideally be backed by express consent for cleaner legal posture.

This means: collecting express consents now is high-value because it preserves your right to market beyond the implied-consent window. But you don't need to wait for consents before sending pre-tournament communications to your existing 2026 list.

## Audit findings (the foundation for this build)

A schema audit was run before this handover. Key findings:

**Amount storage convention**: every transactional table uses integer dollars (donations.amount, sponsors.amount, dinners.amount, auction_bids.amount, auction_invoices.amount, pending_orders.total_amount). One exception: `extra_golfer_invites.price_per_golfer` stores cents (default 15000 = $150). This is a known footgun that should be migrated to dollars or renamed `price_per_golfer_cents` for clarity. Track as cleanup, not part of CRM build.

**Registrations has no amount column**. Revenue is derived as `paid_count * 600` for regular registrations plus `golfer_count * 150` for extras (which requires joining to `extra_golfer_invites` via `parent_token`). The `get_fundraising_total()` RPC currently uses a flat `count * 600` shortcut and silently miscounts. Add an `amount_paid` integer dollars column to registrations as part of the CRM build, backfill existing rows.

**Person data is fragmented across 11 tables**:

| Table | Email column | Name column | Phone | Email uniqueness |
|---|---|---|---|---|
| registrations | captain_email | captain_name | captain_phone | none |
| registrations.team_members (jsonb) | team_members[i].email | team_members[i].name | none | none (nested) |
| donations | donor_email | donor_name | none | none |
| sponsors | contact_email | contact_name + business_name | contact_phone | none |
| dinners | guest_email | guest_name | guest_phone | none |
| auction_bidders | email | display_name | phone | UNIQUE(lower(email)) |
| email_subscribers | email | none | none | UNIQUE(email) case-sensitive |
| waitlist | email | name | phone | none |
| next_year_interest | email | name | none | UNIQUE(lower(email)) |
| messages | sender_email | sender_name | none | none |
| suppressed_emails | email | none | none | UNIQUE(email) case-sensitive |

Names are always single-field (no first/last split). Email uniqueness is enforced on only 5 of 11 tables, and the convention split between case-sensitive and case-insensitive is inconsistent. The new `contacts` table should use case-insensitive email matching as the canonical pattern.

**Note**: `auction_winners` does NOT exist in the schema. The actual table is `auction_invoices`. PROJECT_STATUS.md has the wrong table name and should be corrected during this build. `auction_invoices.tax_receipt_amount` is a separate column tracking only the tax-receipt-eligible portion of an auction win, important for ATCP receipt generation, must be preserved in contact_activities.

**The 35 pre-launch registrations imported from Stripe Payment Links**:
- Inserted via SQL with `paid=true` and `stripe_session_id` populated (real Stripe IDs starting with `cs_live_`)
- All paid $600
- No team rosters (team_members JSON is empty)
- Stripe API access works on these sessions, you can retrieve `stripe.checkout.sessions.retrieve(id, { expand: ['custom_fields', 'customer_details', 'line_items'] })` to pull back any custom fields the original Payment Link captured plus session.amount_total in cents
- What the Payment Links actually captured in custom fields is unknown until queried, likely just team name and maybe a free-text "golfer names" field. Whatever's not there cannot be reconstructed and would need separate manual capture.

**`pending_orders.items` jsonb is gold for backfill**. For any order that came through the live webhook flow, the full per-item breakdown (amount, type, formData) is in `pending_orders.items`. You don't need Stripe API calls for these, your own database has the data. Stripe API is only needed for the 35 pre-launch imports.

**`sponsor_invites` is the precursor to `outbound_links`**. The existing tokenized sponsor invite flow does roughly what outbound_links generalizes. Plan: keep sponsor_invites running through the 2026 tournament, migrate any unredeemed invites into outbound_links in Session 6, deprecate post-event. Don't try to rip it out mid-season.

**Stripe SDK**: version 18.5.0, accessed via `STRIPE_SECRET_KEY` env var in edge functions. Works for the backfill.

## Architectural decisions (locked in)

1. **Pattern 3**: separate `contacts` table + `contact_activities` table, not a `golfers` table.

2. **Outbound links as a first-class object**, not bolted onto each transaction type. One table covers registration links, sponsorship links, dinner links, donation links, and generic checkout links. Single-use, locked after redemption at the application layer (not DB level, so admin can void and reissue).

3. **Placeholder name preservation**. When a link is redeemed and the paying entity differs from the recipient (Bob sent it, ACME paid), both names are captured. The activity row's `contact_id` points to the paying entity (ACME). The activity's `sent_to_contact_id` points to the recipient (Bob). The outbound_links row records the original `sent_to_name` as a permanent free-text record even if no contact row was created at send time.

4. **Payment method on every activity**. `payment_method` enum: stripe, cash, cheque, eft, in_kind, other. Plus `payment_reference` free-text for cheque numbers, EFT confirmations, etc. Reconciliation is essential — Derrick deals with cash and cheques at the event.

5. **CASL consent for marketing**: `marketing_consent BOOLEAN DEFAULT false` with `consent_recorded_at TIMESTAMPTZ` and `consent_source TEXT`. Default is unchecked (true opt-in, not opt-out, pre-checked boxes are not CASL-compliant). User must actively tick.

6. **Captain cannot consent for teammates**. Each individual must consent for themselves. Captain enters teammate operational info (name, email used for tournament logistics under implied consent), but marketing consent for teammates is collected separately via direct email to each teammate.

7. **Single name field**, no first/last split. Match the existing convention.

8. **Case-insensitive email** as the canonical dedup key. `lower(trim(email))` with a UNIQUE constraint on contacts.

9. **Email-based dedup on insert**. When a new transaction comes in, check for existing contact by email. If found, link new activity to existing contact. If not, create new contact then link. No fuzzy name matching, that's where CRMs go wrong.

10. **Cross-event support from day one**. The schema needs to handle other Stewart family fundraising events beyond H4H golf, not just this tournament. Use `event_type` and `tournament_year` (or event_date) on contact_activities.

11. **Anonymous label**: "A friend of Holden" already deployed in the donation ticker, should remain consistent across any future displays.

## Schema (proposed, refine in the audit)

### contacts table

```sql
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,  -- canonical lower-cased
  name TEXT NOT NULL,
  phone TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,

  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at TIMESTAMPTZ,
  consent_source TEXT,
  unsubscribed_at TIMESTAMPTZ,

  notes TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contacts_email_lower
  ON contacts(lower(trim(email))) WHERE email IS NOT NULL;
```

### contact_activities table

```sql
CREATE TABLE public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL,
  -- enum values:
  --   'team_registration'   (paid to play, captain or roster member)
  --   'extra_golfer'        (paid to be added beyond the team of 4)
  --   'donation'            (gave money outside any other transaction)
  --   'sponsorship'         (gave money in exchange for sponsor recognition)
  --   'dinner_ticket'       (bought one or more dinner tickets)
  --   'auction_bid'         (placed a bid, won or lost)
  --   'auction_win'         (won an auction item)
  --   'manual_note'         (admin-added interaction)

  tournament_year INTEGER,
  event_type TEXT DEFAULT 'h4h_golf',

  amount_cents BIGINT,  -- standardize to cents on contact_activities even though source tables use dollars; this is a one-time conversion at write time
  tax_receipt_amount_cents BIGINT,  -- nullable, only populated for auction wins where this differs

  -- Payment reconciliation
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  -- enum: 'stripe', 'cash', 'cheque', 'eft', 'in_kind', 'other'
  payment_reference TEXT,  -- cheque #, EFT confirmation, etc.

  -- Source linking, at most one of these is set
  registration_id UUID REFERENCES registrations(id),
  donation_id UUID REFERENCES donations(id),
  sponsor_id UUID REFERENCES sponsors(id),
  dinner_id UUID REFERENCES dinners(id),
  auction_invoice_id UUID REFERENCES auction_invoices(id),
  auction_bid_id UUID REFERENCES auction_bids(id),

  -- Link attribution (added Rev 2)
  outbound_link_id UUID REFERENCES outbound_links(id),
  sent_to_contact_id UUID REFERENCES contacts(id),
  -- The contact who received the link, if different from the paying contact_id.
  -- Bob sent the link, ACME paid: contact_id = ACME, sent_to_contact_id = Bob.

  -- Manual entry tracking (added Rev 2)
  entered_manually BOOLEAN NOT NULL DEFAULT false,
  entered_by UUID REFERENCES auth.users(id),

  role_detail TEXT,
  -- 'captain', 'golfer', 'extra_golfer', 'donor', 'sponsor_primary',
  -- 'sponsor_contact', 'dinner_attendee', 'auction_bidder', 'auction_winner'

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_activities_contact ON contact_activities(contact_id);
CREATE INDEX idx_contact_activities_type ON contact_activities(activity_type, tournament_year);
CREATE INDEX idx_contact_activities_year ON contact_activities(tournament_year);
CREATE INDEX idx_contact_activities_sent_to ON contact_activities(sent_to_contact_id);
CREATE INDEX idx_contact_activities_outbound_link ON contact_activities(outbound_link_id);
```

### outbound_links table (added Rev 2)

```sql
CREATE TABLE public.outbound_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,

  -- Who I sent it to (placeholder, may differ from who actually pays)
  sent_to_name TEXT NOT NULL,
  sent_to_email TEXT,
  sent_to_phone TEXT,
  sent_to_contact_id UUID REFERENCES contacts(id),
  -- Optional: if I send to a known existing contact, link it. If unknown, just store the name.

  -- What the link is for
  link_type TEXT NOT NULL,
  -- enum: 'registration', 'sponsorship', 'dinner', 'donation', 'generic_checkout'

  intended_amount_cents BIGINT,
  intended_tier_id UUID,  -- references sponsorship_tiers when link_type='sponsorship'
  notes TEXT,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'sent',
  -- enum: 'sent', 'opened', 'redeemed', 'expired', 'voided'

  redeemed_at TIMESTAMPTZ,
  redeemed_by_contact_id UUID REFERENCES contacts(id),
  redeemed_activity_id UUID REFERENCES contact_activities(id),
  void_reason TEXT,

  tournament_year INTEGER,
  event_type TEXT DEFAULT 'h4h_golf',

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_links_token ON outbound_links(token);
CREATE INDEX idx_outbound_links_status ON outbound_links(status, tournament_year);
CREATE INDEX idx_outbound_links_sent_to ON outbound_links(sent_to_contact_id);
```

### Helper functions

- `upsert_contact(email, name, phone, ...) returns uuid` — returns existing contact_id if email matches (case-insensitive), inserts new contact and returns new id otherwise.
- `void_outbound_link(token, reason) returns void` — sets status to 'voided' with reason.
- `mark_link_opened(token) returns void` — sets status to 'opened' if currently 'sent', no-op otherwise.
- `redeem_outbound_link(token, activity_id, paying_contact_id) returns void` — called by stripe-webhook, sets status 'redeemed', stamps redeemed_at, redeemed_by_contact_id, redeemed_activity_id. Throws if status is already 'redeemed' (single-use enforcement).

Refine if the audit reveals anything that contradicts this shape.

## Build sequence (revised, Rev 2)

The work splits into distinct sessions. Pre-tournament consent collection still drives the early ordering. Link tracking is inserted as Session 1.5.

**Session 1**: Audit refresh + schema migrations for contacts and contact_activities. Pull the latest data state with a quick `git fetch`, re-confirm the audit findings (the data may have moved since), write and apply the contacts + contact_activities migrations, write the upsert_contact helper. Don't add the link-attribution columns yet, those come in 1.5 alongside the outbound_links table.

**Session 1.5** (new in Rev 2): outbound_links table migration. Add `payment_method`, `payment_reference`, `outbound_link_id`, `sent_to_contact_id`, `entered_manually`, `entered_by` columns to contact_activities. Write the void_outbound_link, mark_link_opened, redeem_outbound_link RPCs. Build before backfill so Session 2 can stamp `sent_to_contact_id` on activities for the 35 pre-launch Stripe Payment Link recipients where I remember who I sent each one to.

**Session 2**: Backfill from existing data. Walk every registration, donation, sponsor, dinner, auction_bid, auction_invoice row and create corresponding contact + activity rows. Use the upsert_contact helper. Convert dollars to cents at write time. Stamp `payment_method='stripe'` on everything (it's all Stripe to date), `entered_manually=false`. For the 35 pre-launch imports, also create outbound_links rows where I can identify the recipient, and stamp sent_to_contact_id on those activities. Test against the live database in dry-run mode first before doing the real backfill. Backfill from Stripe API for the 35 pre-launch imports (one-time edge function in `supabase/functions/_admin/`, dry-run flag, real run with explicit flag).

**Session 3**: Build the consent-collection email and tokenized one-click consent page. Each existing contact gets an email asking if they'd like to receive future communications about Hope 4 Holden and other Stewart family fundraising. One-click yes button on a tokenized landing page. Sets `contact.marketing_consent = true`, `consent_source = 'pre_tournament_email_2026'`, records timestamp. Same pattern as the existing unsubscribe and team-manage flows. Run this BEFORE updating forward-looking writes so the consent flow is tested in isolation.

**Session 4**: Update forward-looking writes. stripe-webhook updated to (a) call upsert_contact, (b) insert contact_activity, (c) check for outbound_link_token in checkout metadata, look up outbound_links row, set outbound_link_id and sent_to_contact_id on the activity, call redeem_outbound_link. Plus create-checkout function updated to accept `outbound_link_token` parameter and pass it through to Stripe metadata. Team-manage flow updated to write contacts + activities for each golfer added (with per-golfer marketing_consent collection). Extra-golfer flow updated to insert into contacts + activities (deprecate the parent_token / is_extra_golfers fields on registrations once contacts is canonical, or keep them as legacy data until next year).

**Session 5**: Migrate donation_ticker consent. The `public_display_consent` and `public_display_name` fields currently on the donations table should move to contacts. Refactor the get_public_recent_donors RPC to read from contacts. Backfill the consent flags from donations to contacts (existing donations have donations.public_display_consent=false default, so the migration is non-destructive).

**Session 6** (expanded in Rev 2): Admin UI. Three new pieces:

1. **Contacts tab** with dedup'd contacts, lifetime activity (sum across all activities, count of years active, last activity date), per-contact detail view showing every activity in chronological order. Existing per-table tabs (Registrations, Sponsors, etc.) stay for transactional views. Includes a "merge contacts" tool for the inevitable manual cleanup of duplicates. Bulk-email tooling that segments by marketing_consent + tags.

2. **Send Link dialog** available on every transaction tab and from the new Contacts tab. Pick recipient (existing contact or new free-text name), pick link type, pick amount or tier, generate tokenized URL, copy to clipboard. Optionally email the link directly via send-transactional-email.

3. **Manual Entry dialog** available on every transaction tab using the same component shape. Pick or create contact, select transaction type, enter amount, pick payment_method (cash/cheque/EFT/in-kind/other), enter payment_reference. Routes through upsert_contact + contact_activities with `entered_manually=true` and `entered_by=auth.uid()`. Optionally trigger a thank-you email.

4. **Outbound Links tab** showing all sent links with status, days outstanding since send, conversion rate per recipient. Filter by status='sent' and sort by created_at to see who hasn't responded. Action buttons: copy link, resend email, void link.

Migrate any unredeemed sponsor_invites into outbound_links during this session. Mark sponsor_invites read-only post-migration.

**Session 7** (optional, post-tournament): Year-2027 save-the-date and other forward-looking marketing infrastructure that uses the consent list built in Session 3.

The build is sequential, don't try to compress it. Each session takes 1-3 hours of focused Claude Code work. Sessions 3 and 6 are Lovable rather than Claude Code (UI-heavy work).

## Tool split (Rev 2)

**Claude Code** (precise, multi-file, schema-touching):
- Session 1: contacts + contact_activities migrations, upsert_contact helper
- Session 1.5: outbound_links migration, contact_activities column additions, link RPCs
- Session 2: backfill scripts and dry-run edge function
- Session 4: stripe-webhook edits, create-checkout edits, team-manage edits, extra-golfer edits
- Session 5: donation_ticker consent migration

**Lovable** (visual, multi-component, UI polish):
- Session 3: consent-collection email template + tokenized landing page
- Session 6: Contacts tab, Send Link dialog, Manual Entry dialog, Outbound Links tab

**Sequencing rule**: do not run a Lovable session until all preceding Claude Code sessions are merged AND Lovable has pulled the new schema. Specifically, Session 3 needs Session 1 + 1.5 merged. Session 6 needs Sessions 1, 1.5, 2, 4, 5 all merged. Otherwise Lovable will write UI against a schema that doesn't exist yet and credits will burn on rework.

## What this supersedes

- **BACKLOG.md item #2 (walk-up donation capture)**: replaced by the Manual Entry dialog in Session 6, which generalizes manual entry to all transaction types and adds payment_method + payment_reference at the contact_activities level rather than as donation-specific columns. Mark item #2 as superseded.
- **sponsor_invites table**: deprecated post-2026 tournament. Migrated into outbound_links in Session 6.
- **donations.public_display_consent / public_display_name**: migrated to contacts.marketing_consent (or a new `public_display_consent` column on contacts if separation is needed) in Session 5.

## Working rules for this project

These are durable rules saved to my Claude memory and apply to every session on this project:

- Lovable reliably completes refactor prompts covering 4-5 files; 8+ files tend to stall. Split multi-file refactors into batches.
- Every Claude Code session must start with `git fetch` then `git status` to detect origin moves before doing any new work.
- `git fetch` immediately before every push.
- Push small, push often. Don't let local commits sit unpushed.
- Lovable notifies when it pulls in changes from GitHub. Confirm Lovable has ingested any recent Claude Code commits before starting a new Lovable session.
- Never run schema changes directly in Lovable Cloud SQL. Always go through migration files in `supabase/migrations/`.
- Migration files in `supabase/migrations/` are NOT auto-applied by Lovable Cloud. Must explicitly ask Lovable to apply them.
- Don't run Lovable and Claude Code concurrently on the same repo. Pick one at a time.
- Edge functions type Supabase clients as `createClient<Database>` importing from `supabase/functions/_shared/database.types.ts`. Apply to every new edge function. Lovable will sometimes revert hand-typed Database usages to `any` after schema regeneration; re-apply post-tournament when extracting typed client wrappers to `_shared/`.

## Files Claude Code should not touch in this build

These are recently hardened and should not be modified:

- `src/hooks/useAuth.tsx`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/anonClient.ts`
- `src/integrations/supabase/bidderClient.ts`
- `src/components/ProtectedRoute.tsx`
- `src/components/admin/AdminDataTable.tsx`

## Working style

I'm Derrick, CLO of J&G Group in Brandon, Manitoba. I work in voice dictation often, so transcription errors happen. Push back on my reasoning when I'm wrong. Direct recommendations first, reasoning second. No filler openers, no padding, no restating the question. No bullet points unless content is genuinely list-like. No em dashes. Match length to complexity. Builder-protective drafting on legal items.

When I ask for changes, determine which tool fits and provide a ready-to-paste prompt. Lovable for UI/visual work. Claude Code for migrations, edge functions, security, anything precise. Don't burn Lovable credits on things Claude Code can do for free.

## Starting prompt for the next session

Paste this handover document as the first message. Then:

> Read this handover doc. Confirm you understand the architectural decisions including the Rev 2 additions for outbound_links and manual-entry. Then start with Session 1: run `git fetch && git status`, then verify the schema findings still match what's in the codebase today (some time may have passed). Report any drift, and once verified, write the migration files for contacts + contact_activities + the upsert_contact helper. Do not apply them, I'll have Lovable apply. Session 1.5 (outbound_links) will follow as a separate migration once Session 1 is merged.
