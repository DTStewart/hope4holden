-- Session 1.5 / FILE 0
--
-- contacts: SMS consent columns (separate from existing marketing_consent so
-- a contact can opt into one channel without the other).
--
-- user_roles: extend the public.app_role enum to include 'volunteer'.
-- Volunteer access policies will be added in a later session — this migration
-- only declares the value so future RLS policies can reference it.
--
-- The existing update_updated_at_column() trigger on contacts already covers
-- the new columns (it fires on any UPDATE), so no new trigger is needed.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_source TEXT;

COMMENT ON COLUMN public.contacts.sms_consent IS
  'Contact opted in to SMS messages. Default false (opt-in only). Independent of marketing_consent.';
COMMENT ON COLUMN public.contacts.sms_consent_recorded_at IS
  'Timestamp when sms_consent was last set to true. Null if never opted in.';
COMMENT ON COLUMN public.contacts.sms_consent_source IS
  'Where SMS consent was collected (e.g. ''checkout-form'', ''admin-entry'', ''day-of-event'').';


-- user_roles.role is the public.app_role ENUM (current values: admin, moderator, user).
-- IF NOT EXISTS makes this idempotent. ADD VALUE works inside an implicit transaction
-- in PostgreSQL 12+ as long as the new value is not USED in the same transaction —
-- this migration only declares it, so it's safe.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'volunteer';
