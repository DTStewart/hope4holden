-- Add tournament_year column to relevant tables, default 2026
ALTER TABLE public.registrations ADD COLUMN tournament_year integer NOT NULL DEFAULT 2026;
ALTER TABLE public.sponsors ADD COLUMN tournament_year integer NOT NULL DEFAULT 2026;
ALTER TABLE public.donations ADD COLUMN tournament_year integer NOT NULL DEFAULT 2026;
ALTER TABLE public.dinners ADD COLUMN tournament_year integer NOT NULL DEFAULT 2026;
ALTER TABLE public.pending_orders ADD COLUMN tournament_year integer NOT NULL DEFAULT 2026;

-- Backfill existing rows (defaults already apply, but be explicit)
UPDATE public.registrations SET tournament_year = 2026 WHERE tournament_year IS NULL;
UPDATE public.sponsors SET tournament_year = 2026 WHERE tournament_year IS NULL;
UPDATE public.donations SET tournament_year = 2026 WHERE tournament_year IS NULL;
UPDATE public.dinners SET tournament_year = 2026 WHERE tournament_year IS NULL;
UPDATE public.pending_orders SET tournament_year = 2026 WHERE tournament_year IS NULL;

-- Indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_year ON public.registrations(tournament_year);
CREATE INDEX IF NOT EXISTS idx_sponsors_tournament_year ON public.sponsors(tournament_year);
CREATE INDEX IF NOT EXISTS idx_donations_tournament_year ON public.donations(tournament_year);
CREATE INDEX IF NOT EXISTS idx_dinners_tournament_year ON public.dinners(tournament_year);
CREATE INDEX IF NOT EXISTS idx_pending_orders_tournament_year ON public.pending_orders(tournament_year);

-- Insert current_tournament_year setting
INSERT INTO public.settings (key, value)
VALUES ('current_tournament_year', '2026'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Update public settings RLS policy to include current_tournament_year
DROP POLICY IF EXISTS "Anyone can read public settings" ON public.settings;
CREATE POLICY "Anyone can read public settings"
ON public.settings
FOR SELECT
USING (key = ANY (ARRAY['registration_status'::text, 'spots_remaining'::text, 'current_tournament_year'::text]));

-- Helper function to get current tournament year
CREATE OR REPLACE FUNCTION public.get_current_tournament_year()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((value::text)::integer, 2026)
  FROM public.settings
  WHERE key = 'current_tournament_year'
  LIMIT 1;
$$;

-- Triggers to auto-set tournament_year on insert if not provided
CREATE OR REPLACE FUNCTION public.set_tournament_year_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tournament_year IS NULL OR NEW.tournament_year = 2026 THEN
    NEW.tournament_year := public.get_current_tournament_year();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_tournament_year_registrations
BEFORE INSERT ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_year_default();

CREATE TRIGGER set_tournament_year_sponsors
BEFORE INSERT ON public.sponsors
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_year_default();

CREATE TRIGGER set_tournament_year_donations
BEFORE INSERT ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_year_default();

CREATE TRIGGER set_tournament_year_dinners
BEFORE INSERT ON public.dinners
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_year_default();

CREATE TRIGGER set_tournament_year_pending_orders
BEFORE INSERT ON public.pending_orders
FOR EACH ROW EXECUTE FUNCTION public.set_tournament_year_default();