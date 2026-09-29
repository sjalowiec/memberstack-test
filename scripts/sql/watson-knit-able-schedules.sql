-- Watson native table: when each existing Knit-able becomes public.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, and the seed uses ON CONFLICT DO NOTHING
-- so a publish date already saved in Watson is left alone.
-- Does not modify legacy import tables. Does not store Knit-able content.
--
-- A publish_date is the America/Los_Angeles calendar day the Knit-able becomes
-- public at 12:00 a.m. Pacific. NULL stays unpublished.
--
-- Do not apply this on production until the scheduler release is approved.
-- Apply against the dev Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-knit-able-schedules.sql
-- The running app also creates this table and seed on first use.
--
-- Sock dates preserve pages that are already public. cap-sleeve-tank is the
-- Branch Out Tank and stays scheduled until October 1, 2026.

CREATE TABLE IF NOT EXISTS watson_knit_able_schedules (
  slug TEXT PRIMARY KEY,
  publish_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO watson_knit_able_schedules (slug, publish_date)
VALUES
  ('cap-sleeve-tank', DATE '2026-10-01'),
  ('teenage-kicks-socks', DATE '2026-09-14'),
  ('worsted-color-block-socks', DATE '2026-09-21')
ON CONFLICT (slug) DO NOTHING
