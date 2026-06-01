-- Manual backfill: teams and sponsor-bundled dinner seats that exist in reality
-- but never came through Stripe, so they are missing from the database.
-- These feed roster outreach and the June 12 catering count.
--
-- DATA ENTRY ONLY. No schema changes. Inserts 6 registrations and 4 dinner-only
-- rows (20 dinner seats total via the quantity column).
--
-- This whole file runs inside a single transaction. Either preflight check below
-- raises an exception (which aborts and rolls back the entire migration), so the
-- inserts can never be partially applied: it is all-or-nothing.
--
-- Convention used here: stripe_session_id = NULL is the marker for a manually
-- entered row (a real-world entry that did not flow through Stripe checkout).
-- Do not backfill a fake session id onto these rows.

-- ---------------------------------------------------------------------------
-- PREFLIGHT (fail loudly; abort before any insert)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Preflight 1: tournament year guard.
  -- The BEFORE INSERT trigger set_tournament_year_default() stamps each new row
  -- with settings.current_tournament_year (defaulting to 2026 when the setting
  -- is absent). If that value is not 2026, these rows would be misfiled under
  -- the wrong tournament year, so stop rather than insert into the wrong year.
  IF COALESCE(
       (SELECT (value::text)::integer
          FROM public.settings
         WHERE key = 'current_tournament_year'
         LIMIT 1),
       2026
     ) <> 2026 THEN
    RAISE EXCEPTION
      'Aborting: settings.current_tournament_year is not 2026; the tournament_year trigger would misfile these manual rows.';
  END IF;

  -- Preflight 2: slug collision guard.
  -- team_slug is NOT NULL and UNIQUE with no default. If any target slug already
  -- exists, abort rather than silently mangling or duplicating a team.
  IF EXISTS (
    SELECT 1
      FROM public.registrations
     WHERE team_slug IN (
       'skin-clinics',
       'jacobson-greiner-group',
       'vbj-developments',
       'powell-construction',
       'jg-homes',
       'wcha'
     )
  ) THEN
    RAISE EXCEPTION
      'Aborting: one or more target team_slug values already exist in registrations; refusing to insert duplicates.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- REGISTRATIONS (6 rows)
-- ---------------------------------------------------------------------------
-- Common to all: status='confirmed', paid=true (these are real, paid teams),
-- stripe_session_id=NULL (manual-entry marker, see header), team_members='[]',
-- is_extra_golfers=false. golfer_count is set explicitly per team.
-- Left to defaults: score_token (gen_random_uuid), tournament_year (trigger),
-- created_at, updated_at.
--
-- PLACEHOLDER EMAIL: the Skin Clinics captain_email below,
-- 'sneath-pending@hope4holden.com', is a PLACEHOLDER. captain_email is NOT NULL
-- so a value is required, but this is NOT a real address. When the real address
-- is known, run:
--
--   UPDATE public.registrations
--      SET captain_email = '<real address>'
--    WHERE team_slug = 'skin-clinics';
--
-- DO NOT send roster outreach to Skin Clinics until this is fixed.
INSERT INTO public.registrations
  (team_name, captain_name, captain_email, captain_phone, golfer_count, team_slug, status, paid, stripe_session_id, team_members, is_extra_golfers)
VALUES
  ('Skin Clinics',             'Jason Sneath',   'sneath-pending@hope4holden.com', '204-730-2073', 4, 'skin-clinics',           'confirmed', true, NULL, '[]'::jsonb, false),
  ('Jacobson & Greiner Group', 'Jared Jacobson', 'vbj3@jandggroup.ca',             '204-761-0028', 4, 'jacobson-greiner-group', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('VBJ Developments',         'Jaxon Jacobson', 'vbj4@icloud.com',                '204-761-0028', 4, 'vbj-developments',       'confirmed', true, NULL, '[]'::jsonb, false),
  ('Powell Construction',      'Kyle Cumming',   'kyle@powellconstruction.ca',     '204-761-5112', 6, 'powell-construction',    'confirmed', true, NULL, '[]'::jsonb, false),
  ('J & G Homes',              'Jeff Mann',      'jeff@jandggroup.ca',             '204-724-2686', 4, 'jg-homes',               'confirmed', true, NULL, '[]'::jsonb, false),
  ('WCHA',                     'Tyler Dittmer',  'dittmer@wchahockey.ca',          '204-770-9422', 6, 'wcha',                   'confirmed', true, NULL, '[]'::jsonb, false);

-- ---------------------------------------------------------------------------
-- DINNERS (4 sponsor-bundled, dinner-only rows; one per sponsor)
-- ---------------------------------------------------------------------------
-- Common to all: amount=0, paid=true, stripe_session_id=NULL (manual-entry
-- marker), guest_email='sponsor-bundled@hope4holden.com', guest_phone=''.
-- Seat count is carried by the quantity column (one row per sponsor, not one
-- row per seat).
--
-- amount=0 is intentional: these dinner seats are comped as part of a
-- sponsorship that was already paid for and recorded under sponsors. Recording
-- a dollar amount here would double-count sponsor dollars as dinner revenue.
-- The seats still need to appear for the catering head count, which is the
-- purpose of these rows.
-- Left to defaults: tournament_year (trigger), created_at.
INSERT INTO public.dinners
  (guest_name, guest_email, guest_phone, quantity, amount, paid, stripe_session_id)
VALUES
  ('Fowlers (Dinner Sponsor VIP table)', 'sponsor-bundled@hope4holden.com', '', 8, 0, true, NULL),
  ('Low/Roblin (Cart Sponsor)',          'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL),
  ('Sobeys South (Flag Sponsor)',        'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL),
  ('Brightside Dental (Scorecard Sponsor)', 'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL);
