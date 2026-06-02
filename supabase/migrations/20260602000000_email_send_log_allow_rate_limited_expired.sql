-- Widen the email_send_log status CHECK constraint to include 'rate_limited'
-- and 'expired'.
--
-- Why: process-email-queue inserts status='rate_limited' when the email
-- provider returns a 429 (see the 429 branch of the send loop). The original
-- constraint (email_infra.sql) only allowed
-- ('pending','sent','suppressed','failed','bounced','complained','dlq'), so
-- that insert violates the constraint and throws. Because the throw happens
-- before the cooldown is set and before the message is deleted, it crashes the
-- dispatcher mid-batch on every tick and wedges the queue. This is exactly the
-- failure mode that must not recur when ~40 roster emails are sent at once and
-- the provider throttles.
--
-- 'expired' is not written by current code (TTL-exceeded messages are logged as
-- 'dlq'), but it is added here proactively so a future expired-status path
-- cannot reintroduce the same crash.
--
-- Safe DROP + ADD pattern, mirroring the existing backfill in email_infra.sql.

DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq', 'rate_limited', 'expired'));
END $$;
