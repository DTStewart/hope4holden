
-- 1. Fix search_path on email queue functions
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- 2. Restrict storage bucket listing
-- For public buckets, direct URL access works regardless of RLS.
-- These SELECT policies only control the API listing endpoint.
-- Replace broad listing policies with admin-only listing.

DROP POLICY IF EXISTS "Sponsor logos are publicly readable" ON storage.objects;
CREATE POLICY "Sponsor logos are publicly readable by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sponsor-logos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Gallery photos are publicly accessible" ON storage.objects;
CREATE POLICY "Gallery photos are publicly accessible by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery-photos' AND auth.role() = 'service_role');

-- 3. Tighten permissive INSERT policies (WITH CHECK true → require non-empty values)

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.email_subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.email_subscribers FOR INSERT TO public
  WITH CHECK (email IS NOT NULL AND email <> '');

DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
CREATE POLICY "Anyone can insert messages"
  ON public.messages FOR INSERT TO public
  WITH CHECK (
    sender_name IS NOT NULL AND sender_name <> '' AND
    sender_email IS NOT NULL AND sender_email <> '' AND
    message IS NOT NULL AND message <> '' AND
    read = false
  );

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT TO public
  WITH CHECK (
    name IS NOT NULL AND name <> '' AND
    email IS NOT NULL AND email <> '' AND
    team_name IS NOT NULL AND team_name <> '' AND
    phone IS NOT NULL AND phone <> ''
  );
