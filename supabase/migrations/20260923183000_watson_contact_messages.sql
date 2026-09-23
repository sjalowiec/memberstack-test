-- Watson contact inbox.
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Do not apply this migration to a shared or production database until approved.

CREATE TABLE IF NOT EXISTS public.watson_contact_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL CHECK (BTRIM(email) <> ''),
  subject TEXT,
  message TEXT NOT NULL CHECK (BTRIM(message) <> ''),
  source TEXT,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'responded', 'closed')),
  responded_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  internal_notes TEXT,
  notification_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  notification_email_error TEXT,
  notification_attempted_at TIMESTAMPTZ,
  attachment_blob_key TEXT,
  attachment_access_token TEXT,
  attachment_content_type TEXT,
  attachment_filename TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_contact_messages_status_created
  ON public.watson_contact_messages (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watson_contact_messages_created
  ON public.watson_contact_messages (created_at DESC);

ALTER TABLE public.watson_contact_messages ENABLE ROW LEVEL SECURITY;
