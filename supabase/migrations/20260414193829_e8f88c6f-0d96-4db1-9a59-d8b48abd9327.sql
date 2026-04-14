-- Add logo_upload_token column
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS logo_upload_token text UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_sponsors_logo_upload_token ON public.sponsors(logo_upload_token) WHERE logo_upload_token IS NOT NULL;

-- Storage policy: allow uploads to sponsor-logos bucket for anyone (token validated in app)
CREATE POLICY "Anyone can upload sponsor logos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'sponsor-logos');

-- Storage policy: anyone can read sponsor logos (public bucket)
CREATE POLICY "Anyone can read sponsor logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'sponsor-logos');