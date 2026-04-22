-- User-generated photo capture. Team captains upload photos from event day
-- via the token-gated /team/manage/:token page. Admin moderates before any
-- photo surfaces publicly.


-- 1. ugc_photos table
CREATE TABLE public.ugc_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitter_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ugc_photos_status_idx ON public.ugc_photos(status, created_at DESC);
CREATE INDEX ugc_photos_registration_idx ON public.ugc_photos(registration_id);

ALTER TABLE public.ugc_photos ENABLE ROW LEVEL SECURITY;

-- Admin full access; public reads flow through get_approved_ugc RPC (not direct).
CREATE POLICY "Admins can manage UGC photos"
  ON public.ugc_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ugc_photos_updated_at
  BEFORE UPDATE ON public.ugc_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ugc-photos', 'ugc-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view UGC photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ugc-photos');

CREATE POLICY "Admins can manage UGC photo objects"
  ON storage.objects FOR ALL
  USING (bucket_id = 'ugc-photos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'ugc-photos' AND has_role(auth.uid(), 'admin'::app_role));


-- 3. Submit a UGC photo — called by the edge function after the file is uploaded
-- to storage. Token is the team's score_token (same auth pattern as scorecards).
CREATE OR REPLACE FUNCTION public.submit_team_ugc(
  _token UUID,
  _photo_url TEXT,
  _caption TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_registration_id UUID;
  v_pending_count INTEGER;
BEGIN
  IF _token IS NULL OR _photo_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_fields');
  END IF;

  SELECT id INTO v_registration_id
  FROM public.registrations
  WHERE score_token = _token AND paid = true;

  IF v_registration_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- Light throttle: limit in-flight pending uploads per team to 50 so a
  -- runaway client can't fill storage.
  SELECT COUNT(*) INTO v_pending_count
  FROM public.ugc_photos
  WHERE registration_id = v_registration_id AND status = 'pending';

  IF v_pending_count >= 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_pending');
  END IF;

  INSERT INTO public.ugc_photos (registration_id, photo_url, caption)
  VALUES (v_registration_id, _photo_url, NULLIF(btrim(_caption), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_team_ugc(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_team_ugc(UUID, TEXT, TEXT) TO anon, authenticated;


-- 4. Public read of approved photos (for a future gallery / live ticker).
CREATE OR REPLACE FUNCTION public.get_approved_ugc(_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  photo_url TEXT,
  caption TEXT,
  team_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT u.id, u.photo_url, u.caption, r.team_name, u.created_at
  FROM public.ugc_photos u
  JOIN public.registrations r ON r.id = u.registration_id
  WHERE u.status = 'approved'
  ORDER BY u.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

REVOKE EXECUTE ON FUNCTION public.get_approved_ugc(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_approved_ugc(INT) TO anon, authenticated;
