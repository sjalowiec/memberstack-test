-- Watson email list signup results (Tip of the Week and future sources)
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify legacy import tables or ActiveCampaign data.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-email-signups.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply until you intentionally choose the target database.
--
-- Counted "new signup" = status = 'added' only (ActiveCampaign confirmed
-- the email was newly subscribed to the Knit It Now mailing list).

CREATE TABLE IF NOT EXISTS watson_email_signups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('added', 'already-subscribed', 'not-added', 'failed')),
  outcome TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_added_created
ON watson_email_signups (created_at)
WHERE status = 'added';

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_source_created
ON watson_email_signups (source, created_at);

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_status_created
ON watson_email_signups (status, created_at);
