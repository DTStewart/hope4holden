-- Drop the broken policy that requires service_role for public reads
DROP POLICY IF EXISTS "Gallery photos are publicly accessible by path" ON storage.objects;

-- Create a correct public SELECT policy for the gallery-photos bucket
CREATE POLICY "Gallery photos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'gallery-photos');