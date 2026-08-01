-- Additive migration: expand watson_whats_new_settings into a flexible What’s New billboard.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- Preserves existing rows and columns (headline, introduction, Vimeo fields, publish_date, enabled, updated_at).
-- Does not rename or drop tables/columns.
--
-- Do not apply until approved. Example:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-whats-new-billboard.sql
-- Or paste into the Supabase SQL editor for the Watson project.

ALTER TABLE watson_whats_new_settings
  ADD COLUMN IF NOT EXISTS button_text TEXT,
  ADD COLUMN IF NOT EXISTS button_destination_url TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Optional documentation of field roles (no behavior change):
--   introduction              -> short message body
--   button_text               -> optional CTA label
--   button_destination_url    -> optional CTA destination (/path or https://)
--   start_date                -> inclusive start (America/Los_Angeles calendar day)
--   end_date                  -> inclusive end (America/Los_Angeles calendar day)
--   publish_date              -> legacy field retained for compatibility
--   updated_at                -> last saved timestamp
