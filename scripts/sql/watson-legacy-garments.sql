-- Watson-native cleaned legacy garment title lookup
-- Safe to re-run: uses IF NOT EXISTS.
-- Does NOT modify legacy_* dump tables, Memberstack, Stripe, or ActiveCampaign.
-- Slim GarmentID → GarmentTitle / GarmentDescription map only. No XML / WDDX / patternbuilddata.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-legacy-garments.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply until you intentionally choose the target database.
-- Do not load CSV data with this file; schema only.

CREATE TABLE IF NOT EXISTS watson_legacy_garments (
  garment_id TEXT PRIMARY KEY,
  garment_title TEXT NOT NULL DEFAULT '',
  garment_description TEXT,
  source_file TEXT,
  batch_id TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE watson_legacy_garments ADD COLUMN IF NOT EXISTS garment_description TEXT;

COMMENT ON TABLE watson_legacy_garments IS
  'Slim Knit It Now garment title lookup for Watson Saved Patterns. Joined by garment_id = legacy_member_pattern_details.garmentid_fk. garment_description is cleaned plain text from GarmentDescription.';
