-- Tournament scorecard submission + leaderboard.

-- 1. Give every registration a unique score_token for its /score/:token link.
-- UUID with gen_random_uuid() as default backfills existing paid teams with
-- unique tokens and applies to new inserts going forward.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS score_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Only add the unique constraint if it doesn't already exist.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'registrations_score_token_unique'
  ) THEN
    ALTER TABLE public.registrations
      ADD CONSTRAINT registrations_score_token_unique UNIQUE (score_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS registrations_score_token_idx
  ON public.registrations(score_token);


-- 2. Submissions table: one row per team, photo + score + verification status.
CREATE TABLE public.scorecard_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,
  final_score INTEGER NOT NULL CHECK (final_score > 0 AND final_score < 300),
  photo_url TEXT NOT NULL,
  submitter_note TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scorecard_submissions_score_idx ON public.scorecard_submissions(final_score);
CREATE INDEX scorecard_submissions_verified_idx ON public.scorecard_submissions(verified, disqualified);

ALTER TABLE public.scorecard_submissions ENABLE ROW LEVEL SECURITY;

-- Only admin has direct table access; public interacts via SECURITY DEFINER RPCs.
CREATE POLICY "Admins can manage scorecards"
  ON public.scorecard_submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_scorecard_submissions_updated_at
  BEFORE UPDATE ON public.scorecard_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Storage bucket for scorecard photos.
INSERT INTO storage.buckets (id, name, public)
VALUES ('scorecard-photos', 'scorecard-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view scorecard photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scorecard-photos');

-- Service role (via edge function) handles writes.
-- Admin can also directly manage for clean-up.
CREATE POLICY "Admins can manage scorecard photos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'scorecard-photos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'scorecard-photos' AND has_role(auth.uid(), 'admin'::app_role));


-- 4. Token lookup for the public /score/:token page.
CREATE OR REPLACE FUNCTION public.lookup_team_by_score_token(_token UUID)
RETURNS TABLE (
  registration_id UUID,
  team_name TEXT,
  business_name TEXT,
  already_submitted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    r.team_name,
    r.business_name,
    EXISTS (SELECT 1 FROM public.scorecard_submissions s WHERE s.registration_id = r.id) AS already_submitted
  FROM public.registrations r
  WHERE r.score_token = _token AND r.paid = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_team_by_score_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_team_by_score_token(UUID) TO anon, authenticated;


-- 5. Public leaderboard — only verified, non-disqualified submissions.
-- Low score wins in golf.
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  registration_id UUID,
  team_name TEXT,
  business_name TEXT,
  final_score INTEGER,
  photo_url TEXT,
  submitted_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    r.team_name,
    r.business_name,
    s.final_score,
    s.photo_url,
    s.created_at
  FROM public.scorecard_submissions s
  JOIN public.registrations r ON r.id = s.registration_id
  WHERE s.verified = true AND s.disqualified = false
  ORDER BY s.final_score ASC, s.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;


-- 6. Submit a scorecard. Scoped by token; one submission per team.
CREATE OR REPLACE FUNCTION public.submit_scorecard(
  _token UUID,
  _final_score INTEGER,
  _photo_url TEXT,
  _submitter_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_registration_id UUID;
BEGIN
  IF _token IS NULL OR _final_score IS NULL OR _photo_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_fields');
  END IF;
  IF _final_score <= 0 OR _final_score >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_score');
  END IF;

  SELECT id INTO v_registration_id
  FROM public.registrations
  WHERE score_token = _token AND paid = true;

  IF v_registration_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  INSERT INTO public.scorecard_submissions (
    registration_id, final_score, photo_url, submitter_note
  ) VALUES (
    v_registration_id, _final_score, _photo_url, _submitter_note
  )
  ON CONFLICT (registration_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_submitted');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_scorecard(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_scorecard(UUID, INTEGER, TEXT, TEXT) TO anon, authenticated;
