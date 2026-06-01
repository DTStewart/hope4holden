-- TEMPORARY TEST DATA. Delete right after testing (cleanup DELETE is at the
-- bottom of this file).
--
-- Purpose: three throwaway teams so the /team/manage/:token flow can be checked
-- on a phone at different roster sizes. They confirm the teammate section scales
-- with golfer_count (4 vs 5 vs 6) and that team photo upload works.
--
-- Why paid=true: get_team_for_management resolves on
--   WHERE score_token = _token AND paid = true
-- so paid=false would make the manage link fail to resolve and defeat the test.
--
-- These rows are deliberately obvious and easy to remove: every team_name is
-- prefixed 'TEST DELETE' and every team_slug is prefixed 'zzz-test-'.
--
-- Common to all three: status='confirmed', paid=true, stripe_session_id=NULL,
-- team_members='[]'::jsonb, is_extra_golfers=false, captain_email and
-- captain_phone are shared placeholder values. Left to defaults: score_token
-- (gen_random_uuid), tournament_year (trigger), created_at, updated_at.

INSERT INTO public.registrations
  (team_name, captain_name, captain_email, captain_phone, golfer_count, team_slug, status, paid, stripe_session_id, team_members, is_extra_golfers)
VALUES
  ('TEST DELETE 4-player', 'Test Captain Four', 'test@hope4holden.com', '000-000-0000', 4, 'zzz-test-four', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE 5-player', 'Test Captain Five', 'test@hope4holden.com', '000-000-0000', 5, 'zzz-test-five', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE 6-player', 'Test Captain Six',  'test@hope4holden.com', '000-000-0000', 6, 'zzz-test-six',  'confirmed', true, NULL, '[]'::jsonb, false);

-- ---------------------------------------------------------------------------
-- AFTER APPLYING: the two things you need (these are comments, not executed)
-- ---------------------------------------------------------------------------
--
-- 1. Retrieve the three tokens to build the test URLs
--    (/team/manage/<score_token>):
--
--      SELECT team_name, golfer_count, score_token
--        FROM registrations
--       WHERE team_slug LIKE 'zzz-test-%'
--       ORDER BY golfer_count;
--
-- 2. Cleanup: run this to remove all three test rows after testing:
--
--      DELETE FROM registrations WHERE team_slug LIKE 'zzz-test-%';
