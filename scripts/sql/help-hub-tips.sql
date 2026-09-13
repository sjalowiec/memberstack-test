-- Help Hub CMS tips (hybrid columns + jsonb document)
-- Safe to re-run: uses IF NOT EXISTS.
-- Server-side Postgres only (WATSON_DATABASE_URL / queryWatson).
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Do not apply to production until intentionally chosen.
--
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/help-hub-tips.sql

CREATE TABLE IF NOT EXISTS public.help_hub_tips (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'review')),
  sort_order INTEGER,
  category TEXT,
  title TEXT,
  question TEXT,
  is_new BOOLEAN,
  featured BOOLEAN,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS help_hub_tips_slug_unique
  ON public.help_hub_tips (lower(slug));

CREATE INDEX IF NOT EXISTS help_hub_tips_public_idx
  ON public.help_hub_tips (status, sort_order, id)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS help_hub_tips_admin_idx
  ON public.help_hub_tips (deleted_at, sort_order, id);

ALTER TABLE public.help_hub_tips ENABLE ROW LEVEL SECURITY;
