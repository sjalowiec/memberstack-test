-- Glossary entries saved from /admin/glossary.
-- The source file remains the fallback. Saved rows override it by glossary id.
-- Safe to re-run. Does not modify the source glossary file.
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY.
--
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/glossary-entries.sql

CREATE TABLE IF NOT EXISTS public.glossary_entries (
  glossary_id INTEGER PRIMARY KEY,
  document JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.glossary_entries ENABLE ROW LEVEL SECURITY;
