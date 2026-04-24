# Hope 4 Holden — Project Status

**Last updated:** April 24, 2026
**Status:** Live at hope4holden.com
**Tournament dates:** June 18 (dinner) and June 19 (golf), 2026

---

## What This Project Is

A full-stack charity golf tournament website for Hope 4 Holden, a fundraising initiative supporting the Ataxia Telangiectasia Children's Project (ATCP). Built for Derrick and Jill Stewart of Brandon, Manitoba, in honor of their son Holden (age 7) who lives with A-T.

The site handles team registration, dinner ticket sales, sponsorship management, donations, silent auction, live event dashboard, scorecard tracking, and a full admin backend. It serves as both a public-facing event site and an operational management tool.

---

## Tech Stack

- **Frontend:** React + TypeScript, Tailwind CSS, hosted on Lovable
- **Backend:** Supabase (Lovable Cloud), PostgreSQL with RLS
- **Payments:** Stripe (live mode, hosted checkout)
- **Email:** Transactional emails via Supabase edge functions, sender domain notify.hope4holden.com
- **Domain:** hope4holden.com (GoDaddy DNS, Lovable hosting)
- **Repo:** github.com/DTStewart/hope4holden (public)
- **Build tools:** Lovable.dev for UI/feature development, Claude Code for code-level changes and security reviews

---

## Key Resources

- **Supabase project ID:** rhksslzpdzpyrixkfmhb
- **Stripe webhook URL:** https://rhksslzpdzpyrixkfmhb.supabase.co/functions/v1/stripe-webhook
- **Stripe mode:** Live (restricted key rk_live_...ttAJ)
- **Admin dashboard:** hope4holden.com/admin
- **Admin users:** Derrick Stewart + Jill Stewart (both in user_roles table)
- **Shared admin email:** hello@hope4holden.com (receives all admin notifications)
- **Logo file:** src/assets/h4h-logo.png (transparent version available)

---

## Brand Identity

- **Primary green:** #7ab40d
- **Accent green (hover):** #4A7C09
- **Secondary:** #1A1A1A (near-black)
- **Neutral:** #FFFFFF and #F5F5F5
- **Typography:** Montserrat (headings), Open Sans (body)
- **Tagline:** "Driving for a Cure"
- **Logo:** Black H4H typographic with "Hope" and "Holden" script

---

## Current Architecture

### Public Pages
- **Home (/)** — hero, four participation cards, about Holden section, sponsor grid
- **About (/about)** — Holden's story, family, A-T explainer, CTA
- **Tournament (/tournament)** — two-day schedule, venue details, format info
- **Participate (/register)** — consolidated page with registration, dinner, sponsorship tiers, donations
- **Gallery (/gallery)** — photos organized by year
- **FAQ (/faq)** — accordion format, 12+ questions
- **Contact (/contact)** — contact form with subject dropdown
- **Auction (/auction)** — silent auction with live bidding
- **Leaderboard (/leaderboard)** — real-time golf scores
- **Live Dashboard (/live)** — projector-ready display for event day
- **Day-Of Info (/day-of)** — event day logistics
- **Sponsor Invite (/sponsor-invite/:token)** — pre-sold sponsor self-service
- **Sponsor Upload (/sponsor-upload/:token)** — logo + social handle submission
- **Team Manage (/team/manage/:token)** — roster, dietary, team photo
- **Save the Date (/save-the-date)** — 2027 interest capture

### Redirects
- /sponsor redirects to /register#sponsor
- /donate redirects to /register#donate
- /participate redirects to /register
- hopeforholden.com redirects to hope4holden.com (via GoDaddy)

### Admin Dashboard (/admin)
Tabs: Dashboard Stats, Registrations, Sponsors, Donations, Dinners, Orders, Scores, Auction, Auction Winners, Gallery, UGC, Messages, Waitlist, Subscribers, Next Year List, Emails, Bulk Email, Live Dashboard, Post-Event, Settings

### Edge Functions
- **create-checkout** — validates prices server-side, creates Stripe sessions
- **stripe-webhook** — processes checkout.session.completed, writes to all transaction tables, sends unified order confirmation + admin notifications
- **send-transactional-email** — renders and sends email templates (service_role auth required)
- **process-email-queue** — batch email processing
- **sponsor-upload** — token-based logo upload (PNG/JPG only, SVG rejected)
- **ugc-upload** — user-generated photo submissions
- **scorecard-upload** — scorecard image processing
- **team-photo-upload** — team photo handling
- **auction-register-bidder** — OAuth bidder registration
- **auction-close** — closes auction, charges winners
- **auction-pay-fallback** — handles 3DS fallback payments
- **auction-send-outbid-sms** — Twilio SMS for outbid alerts
- **admin-bulk-email** — bulk email sends to segments
- **admin-bulk-sms** — bulk SMS sends
- **event-ics** — calendar file generation
- **handle-email-unsubscribe** — CASL-compliant unsubscribe
- **handle-email-suppression** — email bounce handling
- **preview-transactional-email** — email template preview

### Database Tables (key ones)
- registrations, sponsors, donations, dinners, pending_orders
- sponsorship_tiers, sponsor_invites
- settings (registration_status, spots_remaining, current_tournament_year, shared_admin_email)
- user_roles, email_send_log, email_unsubscribe_tokens, suppressed_emails
- email_subscribers, waitlist, messages
- auction_items, auction_bids, auction_bidders, auction_settings, auction_winners
- gallery_photos, ugc_photos
- rainbow_auction_winners, live_dashboard_settings
- next_year_interest
- All tables have tournament_year column for year-over-year tracking

### Email Templates
- **order-confirmation** — unified receipt for all purchase types, conditional sections based on items
- **sponsor-logo-upload** — separate email for sponsor asset collection (forwardable)
- **admin-new-registration** — admin notification
- **admin-new-sponsorship** — admin notification
- **admin-new-donation** — admin notification
- **event-recap** — post-event thank-you (template ready, not yet sent)

---

## Current State (as of April 24, 2026)

### What's Working
- Site is live on hope4holden.com with SSL
- Stripe payments processing in live mode
- Registration marked as sold out (35 teams imported from Stripe Payment Links)
- Dinner ticket sales active
- Sponsorship tiers displayed, sold-out tiers correctly hidden
- Sponsor invite flow working (generate link in admin, sponsor fills out form, pays, uploads logo)
- Donations active with suggested amounts
- Unified order confirmation email sending for all transaction types
- Admin dashboard functional with year filtering
- Gallery photos loading
- Silent auction built and ready
- Live event dashboard ready for projector display
- Scorecard and leaderboard ready for tournament day

### Known Issues
- **Admin session expiry:** Auth token expires intermittently, causing blank data in admin tables. Workaround: log out, log back in. Proper fix in backlog.
- **Admin settings save:** Registration status toggle sometimes doesn't persist. Workaround: edit directly in Lovable Cloud database.
- **Gallery in Comet browser:** Photos don't display in Perplexity's Comet browser. Works in Safari, Chrome, Firefox. Not worth fixing.

### Pending / In Progress
- Security fixes from Claude Code review (sponsor_invites RLS, decrement_sponsor_slots access control) — patches ready, need to deploy
- Sponsor logo collection — resend buttons working, some sponsors still need to upload
- .env file committed to public GitHub repo — needs to be gitignored (low risk, anon key only)

---

## How Development Works

### Two-tool workflow
1. **Lovable** — for UI changes, new features, visual work, anything that benefits from their AI builder. Costs credits per prompt. Changes sync to GitHub automatically.
2. **Claude Code** — for code-level changes, security reviews, debugging, migrations, anything that needs direct file manipulation. Changes committed to GitHub, then sync to Lovable.

### Deployment
- Changes committed to GitHub (from either Lovable or Claude Code) auto-sync
- Click "Publish" in Lovable to deploy to the live site
- Edge function changes deploy automatically when pushed through Lovable
- Database migrations in supabase/migrations/ are NOT auto-applied — must ask Lovable explicitly to apply them

### Key files
- **BACKLOG.md** — all planned future work, organized by priority
- **GO_LIVE_CHECKLIST.md** — deployment checklist and procedures
- **src/pages/Register.tsx** — the Participate page (most complex public page)
- **src/pages/Checkout.tsx** — checkout flow with dynamic form fields
- **supabase/functions/stripe-webhook/index.ts** — payment processing hub
- **supabase/functions/create-checkout/index.ts** — Stripe session creation
- **src/pages/admin/AdminDashboard.tsx** — admin tab router
- **src/integrations/supabase/anonClient.ts** — public query client (prevents auth lock conflicts)

---

## Pricing Constants
- Team registration: $600 (4 golfers, includes dinner)
- Dinner only: $45/ticket
- Donation minimum: $5
- Sponsorship tiers: 13 tiers ranging from $150 to $5,000+ (managed in sponsorship_tiers table)

---

## Important Context for Future Sessions
- Derrick is CLO of J&G Group, sole legal resource. Time is limited.
- Jill Stewart is co-admin, manages social media and sponsor relationships
- The golf course is **Glen Lea Golf Course** (not Glendale)
- Dinner venue is **Victoria Inn, Brandon**
- "Driving for a Cure" is the active tagline
- "Beat Disease" was retired — Holden doesn't say it anymore
- No em dashes in any copy
- BWK (Brandon Wheat Kings) is a separate J&G entity — don't mix branding
- ATCP is the registered charity that issues tax receipts — H4H is not itself a registered charity
- The third-party fundraising agreement with ATCP Canada is still being finalized
- Tournament year tagging is in place for future year-over-year reporting
