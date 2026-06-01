-- Manual backfill: teams and sponsor-bundled dinner seats that exist in reality
-- but never came through Stripe, so they are missing from the database.
DO $$
BEGIN
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

INSERT INTO public.registrations
  (team_name, captain_name, captain_email, captain_phone, golfer_count, team_slug, status, paid, stripe_session_id, team_members, is_extra_golfers)
VALUES
  ('Skin Clinics',             'Jason Sneath',   'sneath-pending@hope4holden.com', '204-730-2073', 4, 'skin-clinics',           'confirmed', true, NULL, '[]'::jsonb, false),
  ('Jacobson & Greiner Group', 'Jared Jacobson', 'vbj3@jandggroup.ca',             '204-761-0028', 4, 'jacobson-greiner-group', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('VBJ Developments',         'Jaxon Jacobson', 'vbj4@icloud.com',                '204-761-0028', 4, 'vbj-developments',       'confirmed', true, NULL, '[]'::jsonb, false),
  ('Powell Construction',      'Kyle Cumming',   'kyle@powellconstruction.ca',     '204-761-5112', 6, 'powell-construction',    'confirmed', true, NULL, '[]'::jsonb, false),
  ('J & G Homes',              'Jeff Mann',      'jeff@jandggroup.ca',             '204-724-2686', 4, 'jg-homes',               'confirmed', true, NULL, '[]'::jsonb, false),
  ('WCHA',                     'Tyler Dittmer',  'dittmer@wchahockey.ca',          '204-770-9422', 6, 'wcha',                   'confirmed', true, NULL, '[]'::jsonb, false);

INSERT INTO public.dinners
  (guest_name, guest_email, guest_phone, quantity, amount, paid, stripe_session_id)
VALUES
  ('Fowlers (Dinner Sponsor VIP table)', 'sponsor-bundled@hope4holden.com', '', 8, 0, true, NULL),
  ('Low/Roblin (Cart Sponsor)',          'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL),
  ('Sobeys South (Flag Sponsor)',        'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL),
  ('Brightside Dental (Scorecard Sponsor)', 'sponsor-bundled@hope4holden.com', '', 4, 0, true, NULL);
