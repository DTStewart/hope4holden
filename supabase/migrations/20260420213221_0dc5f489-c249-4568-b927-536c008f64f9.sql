-- Tighten public read access on settings table to exclude sensitive keys like shared_admin_email
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;

CREATE POLICY "Anyone can read public settings"
ON public.settings
FOR SELECT
TO public
USING (key IN ('registration_status', 'spots_remaining'));