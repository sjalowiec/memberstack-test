-- Additive migration: What's New popup announcements.
-- Safe to re-run.
-- Does not rename or drop existing What's New columns.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-whats-new-announcements.sql

ALTER TABLE watson_whats_new_cards
  ADD COLUMN IF NOT EXISTS popup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS popup_audience TEXT NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS popup_expires_on DATE;

ALTER TABLE watson_whats_new_cards
  DROP CONSTRAINT IF EXISTS watson_whats_new_cards_popup_audience_check;

ALTER TABLE watson_whats_new_cards
  ADD CONSTRAINT watson_whats_new_cards_popup_audience_check
    CHECK (popup_audience IN ('everyone', 'members'));

CREATE TABLE IF NOT EXISTS watson_whats_new_announcement_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('displayed', 'read_more')),
  identity TEXT NOT NULL CHECK (identity IN ('member', 'guest', 'unknown')),
  member_id TEXT,
  environment TEXT NOT NULL,
  source_page TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_whats_new_announcement_events_card
ON watson_whats_new_announcement_events (environment, card_id, event_type);

-- One site-wide pop-up. Content is copied from a What's New entry and then edited on its own.
CREATE TABLE IF NOT EXISTS watson_whats_new_popup_announcement (
  key TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL,
  source_card_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'everyone'
    CHECK (audience IN ('everyone', 'members')),
  expires_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
