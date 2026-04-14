ALTER TABLE public.sponsorship_tiers ADD COLUMN max_slots integer DEFAULT NULL;

COMMENT ON COLUMN public.sponsorship_tiers.max_slots IS 'Maximum number of sponsors allowed for this tier. NULL means unlimited.';