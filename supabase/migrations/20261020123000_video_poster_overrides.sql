-- Thumbnails saved from the video editor.
-- The catalog file remains the fallback. A saved row overrides posterUrl by content id.
-- Safe to re-run. Does not modify the catalog file.
-- RLS is enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY.

CREATE TABLE IF NOT EXISTS public.video_poster_overrides (
  content_id TEXT PRIMARY KEY,
  poster_url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_poster_overrides ENABLE ROW LEVEL SECURITY;
