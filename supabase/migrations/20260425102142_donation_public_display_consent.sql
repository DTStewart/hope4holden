-- Donor opt-in for the homepage donation ticker.
--
-- public_display_consent — opt-in only. Defaults to false so existing
-- donations remain private until the donor explicitly opts in. The
-- consent checkbox lives in the Donate flow on /checkout.
--
-- public_display_name — optional. If consent is true and this is null,
-- the public ticker RPC falls back to the first name parsed from
-- donor_name. Donors who want full anonymity can leave consent at false;
-- donors who want a different display name (e.g., "Mike S." instead of
-- their full legal name on the receipt) supply one here.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS public_display_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_display_name text;

COMMENT ON COLUMN public.donations.public_display_consent IS
  'Donor opted in to have their donation visible on the public supporter list. Default false (opt-in only).';
COMMENT ON COLUMN public.donations.public_display_name IS
  'Optional display name. If null but consent is true, fall back to first name from the donor name field.';
