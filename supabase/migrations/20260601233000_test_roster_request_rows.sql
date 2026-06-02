-- TEMPORARY TEST DATA. Delete right after testing (cleanup DELETE is at the
-- bottom of this file).
--
-- Purpose: three throwaway teams for testing the roster-request email send
-- (admin-bulk-email recipient mode roster_2026_test). The previous test rows
-- were deleted, so these recreate them.
--
-- Why paid=true: roster_2026_test selects on paid=true (and the manage link
-- resolves via get_team_for_management WHERE score_token = _token AND
-- paid = true), so paid=false would exclude the rows and break the test.
--
-- Dedup case under test: roster recipients are deduplicated by score_token,
-- not by email, so a single captain with two teams gets two separate links.
-- This matters because real captain Scott McQueen has two teams. To exercise
-- it, teams A and B share one captain_email (derrick@stewartmail.ca) and team
-- C uses a different one (derrick@jandggroup.ca). A correct send delivers
-- THREE emails: two to the shared address (distinct team names + manage links)
-- and one to the other address.
--
-- These rows are deliberately obvious and easy to remove: every team_name is
-- prefixed 'TEST DELETE' and every team_slug is prefixed 'zzz-test-'.
--
-- Common to all three: status='confirmed', paid=true, stripe_session_id=NULL,
-- team_members='[]'::jsonb, is_extra_golfers=false, captain_phone placeholder.
-- Left to defaults: score_token (gen_random_uuid), tournament_year (trigger),
-- created_at, updated_at.

INSERT INTO public.registrations
  (team_name, captain_name, captain_email, captain_phone, golfer_count, team_slug, status, paid, stripe_session_id, team_members, is_extra_golfers)
VALUES
  ('TEST DELETE A', 'Test Captain A', 'derrick@stewartmail.ca', '000-000-0000', 4, 'zzz-test-a', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE B', 'Test Captain B', 'derrick@stewartmail.ca', '000-000-0000', 6, 'zzz-test-b', 'confirmed', true, NULL, '[]'::jsonb, false),
  ('TEST DELETE C', 'Test Captain C', 'derrick@jandggroup.ca',  '000-000-0000', 5, 'zzz-test-c', 'confirmed', true, NULL, '[]'::jsonb, false);

-- ---------------------------------------------------------------------------
-- AFTER APPLYING: the two things you need (these are comments, not executed)
-- ---------------------------------------------------------------------------
--
-- 1. Retrieve the three tokens (and confirm the email grouping) to build the
--    test URLs (/team/manage/<score_token>):
--
--      SELECT team_name, captain_email, golfer_count, score_token
--        FROM registrations
--       WHERE team_slug LIKE 'zzz-test-%'
--       ORDER BY team_slug;
--
-- 2. Cleanup: run this to remove all three test rows after testing:
--
--      DELETE FROM registrations WHERE team_slug LIKE 'zzz-test-%';
