-- Member Lesson CMS (hybrid columns + jsonb document)
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Do not apply this migration to production from this change set.

CREATE TABLE IF NOT EXISTS public.member_lessons (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'review')),
  title TEXT,
  category TEXT,
  document JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS member_lessons_slug_unique
  ON public.member_lessons (lower(slug));

CREATE INDEX IF NOT EXISTS member_lessons_public_idx
  ON public.member_lessons (status, id)
  WHERE deleted_at IS NULL AND status = 'published';

CREATE INDEX IF NOT EXISTS member_lessons_admin_idx
  ON public.member_lessons (deleted_at, id);

ALTER TABLE public.member_lessons ENABLE ROW LEVEL SECURITY;
