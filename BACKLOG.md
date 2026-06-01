# Hope 4 Holden — Backlog

Work planned but not built. Each item is self-contained enough that a fresh
Claude session (or Lovable) can execute without re-planning.

When you start a session on one of these, brief the assistant with something
like: *"Read BACKLOG.md and build item #4. Current main is at commit X."*

For day-of event logistics, see [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## ⚠️ Before building anything new — apply pending migrations

This project is on **Lovable Cloud**. Migration files in
`supabase/migrations/` are NOT automatically applied. Ask Lovable explicitly:

> *Apply all pending migrations from `supabase/migrations/`. Confirm when
> they're applied and regenerate types.ts from the new schema.*

Signs migrations are pending: types.ts is missing tables for shipped features,
or pages load but error in the console. See
[GO_LIVE_CHECKLIST.md §0](GO_LIVE_CHECKLIST.md) for more.

---

## Priority order (my recommendation)

1. **#4** Live event dashboard — highest impact, most novel, use Thursday night
2. **#UGC** User-generated content capture — natural extension of team photos
3. **#2** Walk-up donation capture — admin convenience, lightweight
4. **#15 + #16** Post-event emails + 2027 save-the-date — ship together before event so they're ready to fire
5. **#6** Mobile admin mode — nice-to-have, bump if time allows
6. (parked from original list) **post-purchase email improvements**, **"case for giving" content** — both Lovable's sweet spot, do when credits reset

---

## ✅ #4 · Live event dashboard — Lovable built this

Lovable built #4 autonomously in commit bcaa5da / 191f10c. Files shipped:
- `supabase/migrations/20260423000000_live_dashboard.sql`
- `src/pages/LiveDashboard.tsx` (public `/live` route)
- `src/pages/admin/LiveDashboardTab.tsx`

Check the resulting implementation matches your Canva/PowerPoint embed
requirement and that the rainbow-auction admin UI works.

Original spec kept below for reference / amendments:

---

### Original spec for #4

**Goal:** a public URL (no auth) you can project on a TV at the Thursday
dinner. Shows real-time auction tops, leaderboard (Friday), rainbow-auction
winners (admin-managed), upcoming schedule items. Must be embeddable in a
Canva slide or PowerPoint — meaning it renders as a self-contained page at
a URL that can be pasted into Canva's "embed" block or PowerPoint's
"Insert → Web Page" feature.

**Acceptance criteria**
- `/live` — public, no auth, no nav chrome (full-screen-ready)
- Renders gracefully at 1920×1080 projector resolution and on iPads
- Sections (tab or rotating carousel):
  1. Top 5 auction items by current bid, with photo + current high
  2. Rainbow auction winners (admin-entered, list of prize + winner name)
  3. Leaderboard (Friday scores — reuse `get_leaderboard` RPC)
  4. Fundraising total (stats strip from DashboardStats pattern)
- Auto-refreshes via Supabase realtime (for bids, scores) + 30s polling (for
  rainbow winners)
- Admin can toggle which sections are visible via auction_settings-style
  table

**Data model**
- New migration: `live_dashboard_settings` (singleton row) + `rainbow_auction_winners` table
  - `rainbow_auction_winners`: id, prize_description, winner_name, amount (optional), sort_order, created_at
  - `live_dashboard_settings`: show_auction, show_leaderboard, show_rainbow, show_fundraising, refresh_interval_seconds
- New RPC `get_live_dashboard_state()` returning everything in one roundtrip
  (items + rainbow winners + settings + totals) so the dashboard page makes
  one fast query

**Files to create**
- `supabase/migrations/20260423000000_live_dashboard.sql`
- `src/pages/LiveDashboard.tsx`
- `src/pages/admin/LiveDashboardTab.tsx` (new admin tab for rainbow winners + toggle visibility)
- Route `/live` added in `src/App.tsx` (outside the `<Layout>` wrapper so
  there's no header/footer)

**Approach notes**
- Tailwind with big type (text-6xl, text-8xl for numbers)
- Inline dark background (matches the event vibe)
- No sidebar, no footer, no nav
- For Canva/PowerPoint embed: they fetch the URL as an iframe. Must be HTTPS
  (Lovable serves it that way). Confirm the URL loads cleanly in an iframe
  by testing in Canva with the embed block.

**Dependencies** — none beyond what exists today.

**Estimated effort** — 1 full day focused.

---

## #UGC · User-generated photo capture

Added mid-session by request. Intent: attendees submit photos from the day
of the event; admin moderates and posts selected ones to socials.

**Goal:** shareable "upload a photo from today" flow. Admin has a moderation
queue. Future: surface approved photos in a small gallery on the live
dashboard (ties into #4).

**Acceptance criteria**
- `/share` or `/team/manage/:token` has an "Upload event photos" section
  (team-tokened, so only registered teams can upload)
- Multi-photo upload (reuse existing pattern from sponsor-upload / scorecard-upload)
- Optional caption per photo
- Admin tab "UGC" shows pending photos with Approve / Reject actions
- Approved photos accessible via an RPC for display (live dashboard ticker,
  post-event gallery)

**Data model**
- New migration: `ugc_photos` table
  - `id UUID pk, registration_id UUID FK, photo_url TEXT, caption TEXT, status TEXT ('pending'|'approved'|'rejected'), submitter_note TEXT, admin_note TEXT, created_at, updated_at`
- Storage bucket `ugc-photos` (public read, admin manage)
- RPCs: `submit_team_ugc(token, photo_url, caption)`, `get_approved_ugc()` (public, for dashboard)
- Extend existing edge function pattern for upload

**Files to create**
- `supabase/migrations/YYYYMMDD_ugc_photos.sql`
- `supabase/functions/ugc-upload/index.ts`
- Section added to `src/pages/TeamManage.tsx` for uploads
- `src/pages/admin/UGCTab.tsx` for moderation
- `src/pages/admin/AdminDashboard.tsx` — add UGC tab

**Dependencies** — #8/#9/#11 team features (shipped — score_token flow works for auth)

**Estimated effort** — half a day.

---

## #2 · Walk-up donation capture (admin)

**Goal:** Thursday night someone walks up with a $500 cheque or cash. Admin
enters it on an iPad: name, email, amount, optional address. Donation is
recorded as paid, tagged with `method='manual'` to distinguish from Stripe
donations. Admin can optionally trigger a thank-you email.

**Acceptance criteria**
- Button on Admin → Donations tab: "Add walk-up donation"
- Modal with form: name, email (optional), phone (optional), address (optional),
  amount, method (cash / cheque / EFT), note
- On save: insert into `donations` with `paid=true`, `stripe_session_id=null`,
  new `method TEXT`, new `admin_note TEXT`
- Optional "Send thank-you email now" checkbox (uses send-transactional-email
  with a new or existing template)
- Shows in the DonationsTab alongside Stripe donations, with method badge

**Data model**
- Migration: add `donations.method TEXT DEFAULT 'stripe'` (enum-checked:
  'stripe', 'cash', 'cheque', 'eft', 'other') and `donations.admin_note TEXT`
- No new table; existing `donations` table handles manual entries

**Files to touch**
- `supabase/migrations/YYYYMMDD_donations_method.sql`
- `src/pages/admin/DonationsTab.tsx` — add "Add walk-up" dialog
- Possibly a new email template `donation-thank-you-manual.tsx`

**Dependencies** — none

**Estimated effort** — half a day.

---

## #6 · Mobile admin mode

**Goal:** admin walking the course on their phone needs three actions
accessible without zooming through tabs: (a) enter a scorecard score on
behalf of a team, (b) quick-add a walk-up donation, (c) send a bulk SMS
alert.

**Acceptance criteria**
- `/admin/mobile` — simplified, auth-gated, 3 big-button actions
- Each action opens a full-screen dialog/flow
- Auto-redirect from `/admin` to `/admin/mobile` on screens ≤ 640px wide
  (with an "escape to desktop admin" link at the bottom)

**Approach**
- Reuse existing components: `ScoresTab`'s entry dialog, the walk-up
  donation dialog from #2, the BulkEmailTab's invoke pattern for SMS
- Don't duplicate — import and render in simplified wrappers
- Large touch targets (min 48px), single-column layout

**Files to create**
- `src/pages/admin/AdminMobile.tsx`
- Route `/admin/mobile` added in App.tsx (inside `<ProtectedRoute>`)
- Small media-query redirect in `AdminDashboard.tsx`

**Dependencies**
- #2 walk-up donations (for the donation action)

**Estimated effort** — half a day.

---

## #15 · Post-event thank-you email

**Goal:** within 48 hours of the event, email every attendee/sponsor/donor
with a wrap-up: total raised, photos, video message from Holden/family,
link to ATCP impact page, teaser for next year.

**Acceptance criteria**
- New email template `event-recap.tsx` with variables: total_raised,
  photo_url, video_url (optional), cta_url for save-the-date
- Admin tab "Post-Event" with form: photo upload, video URL, total raised
  (auto-calculated from DB but editable), custom message
- "Send to all attendees" button — uses the existing bulk-email edge
  function with the recap template
- Dry run option shows recipient count

**Data model**
- No new tables. Uses existing `donations`/`sponsors`/`registrations`/`dinners`
  via the `admin-bulk-email` function's recipient logic.
- Total raised calculation: same as DashboardStats, extracted to a shared
  RPC `get_fundraising_total()` for reuse

**Files to create / touch**
- `supabase/functions/_shared/transactional-email-templates/event-recap.tsx`
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register
- `src/pages/admin/PostEventTab.tsx`
- Extend `admin-bulk-email` edge function to accept `templateName` override
  (currently hardcoded to `bulk-announcement`)

**Dependencies** — none structural

**Estimated effort** — half a day.

---

## #16 · 2027 save-the-date

**Goal:** included in the post-event thank-you email, a one-click "count me
in for 2027" link. Creates a waitlist entry so you have an early list of
interested attendees for year 4 marketing.

**Acceptance criteria**
- `/save-the-date` page with a "Yes, add me to 2027 list" button
- One-click flow: lands on page → click button → confirmation
- Stores: name, email, prior-year attendance flag, timestamp
- Admin can export this list as CSV from a new subsection of existing
  `SubscribersTab` or a new `NextYearListTab`

**Data model**
- New table `next_year_interest`: id, email (unique), name, attended_prior_year (bool),
  created_at, source (e.g., 'post_event_email', 'direct')
- No edge function needed (direct insert via RPC with email as the idempotency key)

**Files to create**
- `supabase/migrations/YYYYMMDD_next_year_interest.sql`
- `src/pages/SaveTheDate.tsx`
- Route `/save-the-date` in App.tsx
- `src/pages/admin/NextYearListTab.tsx` OR subsection of `SubscribersTab`

**Dependencies** — ties into #15 (the recap email should include the link)

**Estimated effort** — 2-3 hours.

---

## Parked / waiting on Lovable credits

From the original "perfect web-based tournament system" brainstorm, these
are content- and design-heavy and were scoped to Lovable:

- **Better post-purchase emails** — add event details, .ics calendar attachment,
  day-before reminder sequence. Templates live in
  `supabase/functions/_shared/transactional-email-templates/`.
- **"Case for giving" content on homepage** — Holden's story, photos,
  A-T context. Content + design work best done visually in Lovable.

Stripe test-to-live swap + all the deployment bits for the items above are
documented in [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

---

## Deprecated columns to drop (post-tournament)

Session 1.5 introduced cents-denominated and normalized replacements alongside
existing legacy columns, leaving both in place for backwards compat with the
current UI. Once every consumer is migrated, these can be dropped:

- `auction_items.market_value` (replaced by `retail_value_cents` — backfilled in Session 1.5)
- `rainbow_auction_winners.amount` (replaced by `winning_amount_cents` — backfilled in Session 1.5 where amount was non-null)
- `rainbow_auction_winners.prize_description` (replaced by `prize_id` linking to `rainbow_auction_prizes.prize_name`)

**Trigger condition:** drop only after all UI consumers
(`Auction.tsx`, `AuctionTab.tsx`, `LiveDashboardTab.tsx`, `LiveDashboard.tsx`)
have been migrated to read from the cents columns and from `prize_id`-based
joins.

**Schedule:** post-June-19-2026 cleanup. Don't touch before the tournament.

The columns are marked `DEPRECATED` in their `COMMENT ON COLUMN` metadata
(applied in `supabase/migrations/20260426140235_a177f19e-…sql`) — IDE tooling
and `\d+` in psql will show the warning.

---

## Already shipped (as of this backlog)

See recent commits for details. Short version:

- Security hardening (RLS, Stripe webhook idempotency, SVG upload reject, etc.)
- Privacy policy + Terms of Service
- Open Graph image + metadata
- PWA shell (installable home-screen app)
- Full silent auction: items, Stripe card-on-file bidding, realtime updates,
  anti-snipe, auction close + off-session charging, fallback payment for 3DS,
  winner emails, /auction/my-wins, admin winners reconciliation
- OAuth bidder sign-in (Google, Microsoft, magic link, Apple ready-to-enable)
- Outbid alerts (SMS via Twilio + in-app realtime toasts)
- Scorecard submission + /leaderboard + admin entry
- Admin dashboard stats, bulk email
- Day-of info page
- Auction teasers
- Team features (roster + dietary + photo + donation pages)

- ---

## CRM Layer (post-tournament)

- Central contacts table with deduplication by email across registrations, sponsors, donations, dinners
- Lifetime value tracking per contact (total contributed across all years)
- Inline editable notes and tags on each contact
- Contact detail view showing full transaction history across all years
- CSV export for contacts
- redeem_outbound_link does not enforce expires_at. A link past its expiry but still status 'sent' will redeem. Add an expires_at check inside the RPC if/when outbound link expiry dates are actually used (Session 6 UI). Deferred: no expiry dates set for 2026.

## Pipeline & Stages (post-tournament)

- Sponsor pipeline: verbal commitment, invoice sent, paid, logo received, fulfilled
- Registration pipeline: interested, registered, paid, golfer names confirmed
- Visual pipeline board in admin dashboard

## Automated Reminders (post-tournament)

- "Sponsor paid X days ago but hasn't uploaded logo" notification
- "Team registered but hasn't provided golfer names" notification
- Configurable reminder intervals in admin settings

## Segmented Email Lists (post-tournament)

- Build lists by year, transaction type, and tags (e.g., "all 2025 sponsors not yet committed for 2026")
- Bulk email send capability from admin dashboard
- Newsletter/announcement emails separate from transactional emails

## Interaction Timeline (post-tournament)

- Per-contact timeline showing every transaction, email sent, note added
- Ability to log manual interactions (phone calls, in-person conversations)

## Reporting Dashboards (post-tournament)

- Total raised by year and by source (registrations, sponsorships, donations, dinner)
- Sponsor retention rate year over year
- Average donation amount trends
- Golfer return rate
- Exportable reports

## Recurring Revenue Tracking (post-tournament)

- Flag repeat sponsors and golfers across years
- Lapsed sponsor identification for outreach
- Year-over-year comparison views

## Technical Improvements (post-tournament)

- Embedded Stripe checkout (replace hosted checkout redirect)
- Google Analytics or Plausible integration
- Automated Stripe-to-database sync for off-platform payments
- Admin session management fix (proper token refresh)
