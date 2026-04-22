-- Walk-up donation capture: admin can enter cash/cheque/eft donations at the event.
--
-- Adds `method` and `admin_note` columns to the existing donations table so
-- manual entries live alongside Stripe donations in the same query surface.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'stripe'
    CHECK (method IN ('stripe', 'cash', 'cheque', 'eft', 'other'));

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

CREATE INDEX IF NOT EXISTS donations_method_idx ON public.donations(method);
