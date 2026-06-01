-- Session 1.6 / FILE 2
--
-- RPCs for the outbound_links lifecycle. Depends on FILE 1 (the outbound_links
-- table and the redeemed_activity_id FK target on contact_activities).
--
-- Grant model mirrors the existing sponsor_invites flow:
--   mark_link_opened    - hit from the public landing page  -> anon, authenticated
--   redeem_outbound_link- called by stripe-webhook           -> service_role
--   void_outbound_link  - admin action from the UI           -> authenticated (admin-gated inside)
--
-- Single-use enforcement lives in redeem_outbound_link (it throws on an
-- already-redeemed token) rather than as a DB constraint, so an admin can
-- void and reissue.

-- ============================================================================
-- mark_link_opened(token): sent -> opened, no-op otherwise
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_link_opened(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.outbound_links
     SET status = 'opened',
         updated_at = now()
   WHERE token = p_token
     AND status = 'sent';
  -- Intentionally silent if the row is missing or already past 'sent'.
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_link_opened(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_link_opened(TEXT) TO anon, authenticated, service_role;


-- ============================================================================
-- redeem_outbound_link(token, activity_id, paying_contact_id)
-- Single-use: throws if the link is already redeemed, voided, or expired.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.redeem_outbound_link(
  p_token TEXT,
  p_activity_id UUID,
  p_paying_contact_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Lock the row so two concurrent webhook deliveries can't both redeem it.
  SELECT status INTO v_status
    FROM public.outbound_links
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound_link token % not found', p_token
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status = 'redeemed' THEN
    RAISE EXCEPTION 'outbound_link token % already redeemed (single-use)', p_token
      USING ERRCODE = 'unique_violation';
  END IF;

  IF v_status IN ('voided', 'expired') THEN
    RAISE EXCEPTION 'outbound_link token % is % and cannot be redeemed', p_token, v_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.outbound_links
     SET status = 'redeemed',
         redeemed_at = now(),
         redeemed_by_contact_id = p_paying_contact_id,
         redeemed_activity_id = p_activity_id,
         updated_at = now()
   WHERE token = p_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_outbound_link(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_outbound_link(TEXT, UUID, UUID) TO service_role;


-- ============================================================================
-- void_outbound_link(token, reason): admin-gated soft-void
-- ============================================================================
CREATE OR REPLACE FUNCTION public.void_outbound_link(
  p_token TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER bypasses RLS, so gate on admin role explicitly.
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'void_outbound_link requires admin role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.outbound_links
     SET status = 'voided',
         void_reason = p_reason,
         updated_at = now()
   WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound_link token % not found', p_token
      USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.void_outbound_link(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_outbound_link(TEXT, TEXT) TO authenticated, service_role;
