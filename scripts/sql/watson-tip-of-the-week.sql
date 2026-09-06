-- Watson Tip of the Week featured lesson records
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify unrelated Watson tables.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-tip-of-the-week.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply until you intentionally choose the target database.

CREATE TABLE IF NOT EXISTS watson_tip_of_the_week (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tip_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL,
  video_content_id TEXT NOT NULL,
  available_from DATE NOT NULL,
  available_through DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  availability_notice TEXT NOT NULL DEFAULT 'Free to watch this week',
  availability_footer_template TEXT NOT NULL DEFAULT
    'This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.',
  try_copy TEXT NOT NULL DEFAULT '',
  sue_tip_copy TEXT NOT NULL DEFAULT '',
  cta_text TEXT NOT NULL DEFAULT '',
  cta_url TEXT NOT NULL DEFAULT '',
  learn_points_json TEXT NOT NULL DEFAULT '[]',
  related_links_json TEXT NOT NULL DEFAULT '[]',
  eyebrow TEXT NOT NULL DEFAULT 'TIP OF THE WEEK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watson_tip_of_the_week_dates_ok
    CHECK (available_from <= available_through)
);

CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_public
ON watson_tip_of_the_week (status, available_from, available_through)
WHERE status IN ('scheduled', 'active');

CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_admin
ON watson_tip_of_the_week (status, available_from DESC, updated_at DESC);

ALTER TABLE watson_tip_of_the_week
  ADD COLUMN IF NOT EXISTS cta_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_url TEXT NOT NULL DEFAULT '';
