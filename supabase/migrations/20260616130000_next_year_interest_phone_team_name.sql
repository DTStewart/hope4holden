-- Add optional phone + team_name capture to the 2027 save-the-date form.
-- Both nullable, no default; existing columns untouched.
ALTER TABLE public.next_year_interest ADD COLUMN phone TEXT;
ALTER TABLE public.next_year_interest ADD COLUMN team_name TEXT;

-- next_year_interest had no anon INSERT policy (public writes previously went
-- through the add_next_year_interest SECURITY DEFINER RPC). The save-the-date
-- form posts from a public page with no auth session, so a direct anon INSERT
-- must be allowed. Mirror waitlist's "Anyone can join waitlist" public-insert
-- policy: FOR INSERT TO public with a WITH CHECK guarding the required field.
-- waitlist guards name/email/team_name/phone because all four are NOT NULL there;
-- here only email is required (phone/team_name are nullable), so the check guards
-- email alone.
CREATE POLICY "Anyone can join next-year interest"
  ON public.next_year_interest FOR INSERT TO public
  WITH CHECK (email IS NOT NULL AND email <> '');
