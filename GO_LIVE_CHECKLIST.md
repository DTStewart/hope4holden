# Go-Live Checklist — Hope 4 Holden 2026

Last updated: 2026-04-22

Use this when opening the auction to the public (June 1, 2026) and again on tournament weekend (June 18–19).

---

## 0. How migrations actually work in this project

**This project is on Lovable Cloud.** Lovable manages the Supabase instance but
does NOT automatically apply new migrations when code is pushed. You have to
explicitly ask Lovable to apply them.

When there are pending migrations, Lovable's types.ts will stop including the
types for unapplied tables — that's the telltale sign something's out of sync.

**To apply pending migrations**, open the Lovable chat and paste:

> *Apply all pending migrations from `supabase/migrations/`. Confirm when
> they're applied and regenerate types.ts from the new schema.*

Lovable will run them and commit the regenerated types.ts. Usually no credits
cost for config work.

**To check what's applied vs pending:**

> *List what migrations are currently applied to the database vs what's in
> `supabase/migrations/`. Show me any pending ones.*

**Warning signs something isn't applied:**
- Pages that load but error in console with "relation does not exist"
- `types.ts` missing tables you know you built
- Lovable commits titled "Found pending migrations" — that means they exist
  but haven't been applied; you still need to ask.

Any time you see a new `.sql` file appear under `supabase/migrations/` in a
commit, ask Lovable to apply it.

---

## 1. Opening the auction (target: June 1)

### A. Swap Stripe keys from test to live

The auction uses dedicated Stripe env vars, separate from the main site's checkout. Today they're set to **test** keys (`sk_test_...` / `pk_test_...`). Flip them to live.

1. Supabase dashboard → Edge Functions → Manage secrets
2. Update:
   - `STRIPE_AUCTION_SECRET_KEY` → paste your live secret key (`sk_live_...`)
   - `STRIPE_AUCTION_PUBLISHABLE_KEY` → paste your live publishable key (`pk_live_...`)
3. **Do not touch** `STRIPE_SECRET_KEY` — that's the site's live checkout and already works.

### B. Verify in-app admin controls

1. Go to `/admin` → **Auction** tab
2. **Settings:**
   - `bidding_opens_at` → set to the actual time bidding should open (e.g., June 1, 2026, 09:00 CDT)
   - `bidding_closes_at` → set to dinner end time (e.g., June 18, 2026, 21:00 CDT)
   - `default_bid_increment` → confirm (default $5)
   - `anti_snipe_seconds` → confirm (default 60)
   - `is_live` → **leave OFF until testing is complete**
3. **Items:** every auction item has
   - Title + description
   - At least one photo
   - Starting bid, retail value, pickup option
   - Status = `open`

### C. Test the real flow with a real card

1. Flip `is_live` → ON
2. Open `/auction` in an incognito window
3. Register as a test bidder (use a real email/phone)
4. Use a real card (or Apple/Google Pay) to save payment — $0 is authed then released
5. Place a test bid on a throwaway item (e.g., "DELETE AFTER TEST — $5 Tim's gift card")
6. Check: bid appears in admin, current-bid on public page updates live
7. Delete the test item after

### D. Announce

1. Email to all paid attendees (Bulk Email tab → "all_attendees"):
   - Link to `/auction`
   - Dates, how to register to bid, that card is saved not charged
   - Link to "Add to Home Screen" for the PWA
2. Social posts
3. Update site banner / homepage CTA

---

## 2. During the auction (June 1 – June 18)

### Monitor daily
- [ ] Admin → Dashboard stats: total raised, item counts
- [ ] Admin → Auction tab: new items uploading ok, bid counts sensible
- [ ] Supabase dashboard → Edge Function logs → look for errors in `auction-register-bidder`, `place_bid` RPC

### If a bidder reports a problem
- Bid rejected with unclear error → check `place_bid` logs (Supabase → Logs → SQL)
- Card won't save → check `auction-register-bidder` logs (Stripe error messages surface here)
- "Lock not released" / "Edge Function returned non-2xx" → known GoTrue issue, ensure they're on the latest deployed frontend (hard refresh)

### Night of close (June 18 dinner)
- [ ] Have the auction page on a tablet/TV near registration
- [ ] Test anti-snipe works by placing one last-minute bid 30s before close — timer should extend
- [ ] After close, verify all items have status = `closed` in admin

---

## 3. Post-auction settlement

**NOTE:** Phase 3 (auction-close edge function that auto-charges winners) hasn't been built yet. Until it ships, settlement is manual.

### Manual settlement (if running before Phase 3 ships)
1. Supabase → SQL Editor:
   ```sql
   SELECT
     i.id AS item_id,
     i.title,
     (SELECT amount FROM auction_bids b WHERE b.item_id = i.id ORDER BY amount DESC LIMIT 1) AS winning_amount,
     (SELECT bidder_id FROM auction_bids b WHERE b.item_id = i.id ORDER BY amount DESC LIMIT 1) AS winning_bidder_id
   FROM auction_items i
   WHERE i.status = 'open'
   ORDER BY i.sort_order;
   ```
2. For each winner, open Stripe dashboard → Customers → find by their bidder email → charge the saved PaymentMethod for the winning amount.
3. Update item status to `closed` in admin.
4. Email each winner with pickup details (use Bulk Email if many share the same pickup).

### Tax receipts
For winners whose bid was ≥ 125% of retail value, eligible receipt = `bid - retail_value`. Forward to ATCP with:
- Donor full name + mailing address (collect from winner email)
- Amount bid, retail value, receipt amount
- Item description
- Date of auction close

---

## 4. Tournament weekend (June 18–19)

### Thursday (dinner)
- [ ] Auction pickup table staffed from 6:00 PM
- [ ] Scorecards handed out (scorecard submission flow — Phase 4 if shipped, otherwise manual)

### Friday (tournament)
- [ ] Auction pickup for Friday-collection winners at check-in table
- [ ] Live scoring display on dinner-room TV (if Phase 4 shipped)

---

## 5. Rollback / emergency

### Auction completely broken
1. Admin → Auction → Settings → flip `is_live` OFF. `/auction` reverts to placeholder; existing bids are preserved in DB.
2. Email bidders via Bulk Email: "Auction temporarily paused, we'll update shortly."

### Stripe keys compromised
1. Stripe dashboard → Developers → API keys → roll both live and publishable keys
2. Update `STRIPE_AUCTION_SECRET_KEY` + `STRIPE_AUCTION_PUBLISHABLE_KEY` in Supabase
3. **Also rotate** `STRIPE_SECRET_KEY` (the main site's key) if they were obtained from the same place

### A bidder demands a refund
Policy: all sales final (see `/terms`). Individual exceptions are your call — process in Stripe dashboard → find the charge → Refund.

### Site-wide auth issue (GoTrue lock)
Every public form now uses `anonSupabase` which shouldn't lock, but if it recurs: have the user close other admin tabs. Permanent fix would be to remove admin auth from the same browser session entirely.

---

## 6. After the tournament

- [ ] Export all tables to CSV for your records (each admin tab has a Download button)
- [ ] Reconcile Stripe charges against your records
- [ ] Forward donor address info to ATCP for tax receipts
- [ ] Send post-event thank-you email (Bulk Email → "all_attendees")
- [ ] Consider: "save the date" auto-email for next year to all attendees
- [ ] Archive auction items (status = `closed`) — don't delete, keeps historical bid data

---

## Appendix: common operations

### Apply a new migration
1. Copy `.sql` file contents from `supabase/migrations/...`
2. Supabase dashboard → SQL Editor → New query → paste → Run

### Deploy a new edge function manually (Lovable not syncing)
1. Copy function contents from `supabase/functions/<name>/index.ts`
2. Supabase dashboard → Edge Functions → Deploy new function (or Edit existing)
3. Paste code → Deploy

### Check current auction state in SQL
```sql
SELECT is_live, bidding_opens_at, bidding_closes_at FROM auction_settings;
SELECT status, COUNT(*) FROM auction_items GROUP BY status;
SELECT COUNT(*) AS bidders FROM auction_bidders WHERE payment_method_id IS NOT NULL;
SELECT COUNT(*) AS total_bids, SUM(amount) AS total_bid_value FROM auction_bids;
```

### Reset the test data (before going live)
```sql
-- Delete all test bids + bidders (keeps items and settings)
TRUNCATE auction_bids RESTART IDENTITY CASCADE;
DELETE FROM auction_bidders;
-- Items with "TEST" in the title
DELETE FROM auction_items WHERE title ILIKE '%test%';
```
