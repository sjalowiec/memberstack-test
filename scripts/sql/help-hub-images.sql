-- Help Hub images chosen in the admin editor.
-- Bytes live in the shared Help Hub database, not in Git.
-- Safe to re-run. Does not modify help_hub_tips.
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY.
--
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/help-hub-images.sql

CREATE TABLE IF NOT EXISTS public.help_hub_images (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.help_hub_images ENABLE ROW LEVEL SECURITY;
