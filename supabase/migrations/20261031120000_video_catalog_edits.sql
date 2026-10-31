-- Hosted video-admin edits. The deployed videos-public.json stays the base catalog.
-- A row overrides that base, adds a new video, or hides one (deleted = true).
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY.

CREATE TABLE IF NOT EXISTS public.video_catalog_edits (
  content_id TEXT PRIMARY KEY,
  document JSONB,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_catalog_edits ENABLE ROW LEVEL SECURITY;
