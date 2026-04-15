ALTER TABLE public.donations
  ADD COLUMN donor_address text,
  ADD COLUMN donor_city text,
  ADD COLUMN donor_province text,
  ADD COLUMN donor_postal_code text;