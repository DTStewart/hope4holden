INSERT INTO public.registrations
  (team_name, captain_name, captain_email, captain_phone, golfer_count, team_slug, status, paid, stripe_session_id, team_members, is_extra_golfers)
VALUES
  ('TEST DELETE 4-player', 'Test Captain Four', 'test@hope4holden.com', '000-000-0000', 4, 'zzz-test-four', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE 5-player', 'Test Captain Five', 'test@hope4holden.com', '000-000-0000', 5, 'zzz-test-five', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE 6-player', 'Test Captain Six',  'test@hope4holden.com', '000-000-0000', 6, 'zzz-test-six',  'confirmed', true, NULL, '[]'::jsonb, false);