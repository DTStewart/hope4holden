
-- Create gallery_photos table
CREATE TABLE public.gallery_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  caption TEXT,
  photo_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

-- Anyone can view gallery photos
CREATE POLICY "Anyone can view gallery photos"
ON public.gallery_photos
FOR SELECT
USING (true);

-- Admins can manage gallery photos
CREATE POLICY "Admins can manage gallery photos"
ON public.gallery_photos
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for gallery photos
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-photos', 'gallery-photos', true);

-- Public read access for gallery photos
CREATE POLICY "Gallery photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gallery-photos');

-- Admins can upload gallery photos
CREATE POLICY "Admins can upload gallery photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'gallery-photos' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Admins can delete gallery photos
CREATE POLICY "Admins can delete gallery photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'gallery-photos' AND EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
));
