

# Hope 4 Holden — Charity Golf Tournament Website

## Overview
A modern, responsive website for Hope 4 Holden's charity golf tournament (June 18-19, 2026), serving as an event hub, registration portal, sponsorship platform, and donation collection point. All payments processed through the user's own Stripe account via a unified shopping cart checkout.

## Brand & Design
- **Primary green** (#7ab40d), dark (#1A1A1A), light backgrounds (#F5F5F5), hover accent (#4A7C09)
- **Montserrat** for headings (bold, uppercase labels), **Open Sans** for body text
- Warm, hopeful, community-driven aesthetic with generous whitespace
- Subtle fade-in animations, smooth hover effects on cards/buttons
- Fully responsive, mobile-first design

## Pages (8 public + admin)

### 1. Home Page
- Hero with placeholder background, logo, "Beat Disease" tagline, tournament dates, CTA to Register
- Three action cards: Register, Sponsor, Donate
- Brief About summary with "Learn More" link
- Dynamic sponsor logos section grouped by tier (from Supabase), or "Become our first sponsor" CTA

### 2. About Page
- Full story about Holden (exact content provided), his diagnosis, living with A-T, family & community support
- "What is A-T?" explainer section with link to atcp.org
- "Join the Journey" call to action

### 3. Tournament Info Page
- Visual timeline/cards for Thursday dinner and Friday golf schedules
- Event details: 4-person scramble format, what's included
- Venue location cards with addresses for Victoria Inn and Glendale Golf Course

### 4. Register Page
- Team registration form ($600/team): business/team name, captain details (name, email, phone, full address)
- Live spots remaining counter from Supabase
- Sold-out state with waitlist form
- Adds to cart on submit (not direct Stripe redirect)

### 5. Sponsor Page
- Sponsorship tier cards (Title $5K, Gold $2.5K, Silver $1K, Hole $500) with placeholder benefits
- Each tier has a sponsor form (business name, contact details, pre-filled tier)
- Adds to cart on submit
- Current sponsors section displaying logos by tier from Supabase

### 6. Donate Page
- Suggested amounts ($25, $50, $100, $250, $500, Other)
- Donor name, email, amount, recurring donation checkbox
- Adds to cart on submit
- Note about ATCP tax receipts

### 7. Gallery Page
- Scaffolded responsive grid with placeholder cards by year ("Past Tournaments")

### 8. FAQ Page
- Provided FAQs plus 5-8 additional relevant ones in an accordion layout

### 9. Contact Page
- Contact info (email, Jill & Derrick phone numbers)
- Contact form (name, email, message) → saves to Supabase messages table

## Shopping Cart System
- **React Context + localStorage** for persistent cart state
- Cart icon in header (always visible, even on mobile) with item count badge
- Slide-out cart drawer showing all items, descriptions, prices, remove buttons, total
- Each page form → validates → adds to cart → shows confirmation with "Continue Shopping" / "Go to Cart"
- "Proceed to Checkout" creates a single Stripe Checkout Session with all line items
- Cart data stored in Supabase `pending_orders` table (to avoid Stripe metadata limits)
- Post-checkout: unified thank-you page; if recurring donation was selected, show ATCP redirect message

## Admin Dashboard (/admin)
- Protected by Supabase Auth (email/password), supports multiple admin users
- Sidebar navigation with tabs:
  - **Orders**: All checkout sessions with drill-down to see items
  - **Registrations**: Team list, spots remaining, adjust spots, CSV export
  - **Sponsorships**: Sponsor list, logo upload (Supabase Storage), CSV export
  - **Donations**: Donor list, totals, CSV export
  - **Messages**: Contact form submissions, read/unread toggle
  - **Settings**: Toggle registration open/closed, set spots, edit sponsorship tiers
  - **Email List**: Newsletter subscribers, CSV export

## Navigation & Footer
- **Header**: Logo, nav links (Tournament Info, Register, Sponsor, Donate, About, Gallery, FAQ, Contact), cart icon with badge, responsive hamburger menu (cart stays visible outside hamburger)
- **Footer**: Logo, contact info, ATCP link, newsletter email signup, copyright, "Built with love for Holden"

## Supabase Database
Tables: `registrations`, `sponsors`, `donations`, `pending_orders`, `messages`, `settings`, `email_subscribers`, `sponsorship_tiers`, `user_roles` (for admin access)
- Storage bucket for sponsor logos
- RLS policies for public read of sponsors/tiers/settings, admin write access via role check

## Stripe Integration (BYOK)
- Connect user's own Stripe account via Lovable's BYOK Stripe integration
- Edge function to create Checkout Sessions with multiple line items from cart
- Pending order written to Supabase before checkout, referenced in session metadata
- Webhook edge function for `checkout.session.completed`: processes all items, writes to respective tables, decrements spots
- Graceful failure handling: cart preserved on payment failure

## Implementation Sequence
1. Set up brand theme, fonts, layout shell (header, footer, routing)
2. Build all public pages with content and forms
3. Implement shopping cart system (context, localStorage, drawer UI)
4. Set up Supabase: database schema, RLS, storage bucket
5. Enable Stripe BYOK integration, build checkout edge functions and webhooks
6. Build admin dashboard with all tabs
7. Polish: animations, responsiveness, accessibility

