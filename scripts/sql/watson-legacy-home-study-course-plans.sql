-- Watson planning notes for legacy Home Study courses.
-- Course facts stay in data/watson/legacy-home-study-courses.csv
-- (HomeStudy_courseid, title, Active, CourseCost, and the export counts).
-- This table stores recreation status, other-uses notes, and private notes only.
-- It is not a customer course library and does not grant access.
-- Safe to re-run: uses IF NOT EXISTS.
--
-- Apply against the DEV Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-legacy-home-study-course-plans.sql
--
-- Do not apply to production from this change.
-- Does not modify legacy_course_member_library, Memberstack, or access rules.

CREATE TABLE IF NOT EXISTS watson_legacy_homestudy_course_plans (
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
