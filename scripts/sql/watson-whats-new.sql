-- Watson native tables: What's New board cards + featured video settings
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify legacy import tables.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-whats-new.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply until you intentionally choose the target database.

CREATE TABLE IF NOT EXISTS watson_whats_new_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tool', 'pattern', 'resource', 'learning', 'improvement')),
  destination_url TEXT,
  button_text TEXT,
  board_column TEXT NOT NULL CHECK (board_column IN ('just_added', 'worth_exploring', 'in_the_pipeline')),
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_public
ON watson_whats_new_cards (board_column, display_order, publish_date DESC)
WHERE status = 'published' AND archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_admin
ON watson_whats_new_cards (archived, board_column, display_order, publish_date DESC);

CREATE TABLE IF NOT EXISTS watson_whats_new_settings (
  key TEXT PRIMARY KEY,
  headline TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  original_video_url TEXT,
  safe_vimeo_embed_url TEXT,
  publish_date DATE,
  button_text TEXT,
  button_destination_url TEXT,
  start_date DATE,
  end_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
