-- Watson planning notes for legacy Home Study courses.
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Not a customer course library. Does not grant access.
-- Do not apply this migration to production from this change set.

CREATE TABLE IF NOT EXISTS public.watson_legacy_homestudy_course_plans (
  course_id INTEGER PRIMARY KEY,
  recreation_status TEXT NOT NULL DEFAULT 'not_reviewed' CHECK (recreation_status IN (
    'not_reviewed',
    'considering',
    'planned',
    'in_progress',
    'recreated',
    'will_not_recreate'
  )),
  other_uses TEXT,
  private_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.watson_legacy_homestudy_course_plans ENABLE ROW LEVEL SECURITY;
