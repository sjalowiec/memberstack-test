-- Watson Sue's Studio sessions.
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify unrelated Watson tables.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-studio-sessions.sql
--
-- Do not apply until you intentionally choose the target database.
-- The permanent id is assigned by the app and is never rewritten.

CREATE TABLE IF NOT EXISTS watson_studio_sessions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  introduction TEXT NOT NULL DEFAULT '',
  video TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_studio_sessions_admin
ON watson_studio_sessions (status, updated_at DESC);
