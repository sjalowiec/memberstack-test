-- Help Hub managed categories (admin-controlled catalog).
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Safe to re-run: uses IF NOT EXISTS; wrapped in a transaction.
-- Does not create, alter, or delete help_hub_tips rows.
-- Seed rows are inserted by the app (ensureHelpHubCategoriesSeeded), not this SQL.
-- Do not apply this migration to production from this change set.

BEGIN;

CREATE TABLE IF NOT EXISTS public.help_hub_categories (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS help_hub_categories_key_unique
  ON public.help_hub_categories (lower(key))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS help_hub_categories_admin_idx
  ON public.help_hub_categories (deleted_at, sort_order, id);

ALTER TABLE public.help_hub_categories ENABLE ROW LEVEL SECURITY;

COMMIT;
