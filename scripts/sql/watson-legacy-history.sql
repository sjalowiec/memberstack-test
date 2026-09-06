-- Watson-native cleaned legacy customer/history ledger
-- Safe to re-run: uses IF NOT EXISTS.
-- Does NOT modify legacy_* dump tables, Memberstack, Stripe, or ActiveCampaign.
-- CustomerNotes (customer_notes) are admin-only and must never be customer-facing.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-legacy-history.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply until you intentionally choose the target database.
-- Do not load CSV data with this file; schema only.

CREATE TABLE IF NOT EXISTS watson_legacy_customers (
  legacy_memberid TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  date_joined DATE,
  customer_notes TEXT NOT NULL DEFAULT '',
  linked_memberstack_id TEXT,
  link_status TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (link_status IN ('unmatched', 'unique_email', 'ambiguous_email', 'manual')),
  link_checked_at TIMESTAMPTZ,
  source_file TEXT,
  batch_id TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN watson_legacy_customers.customer_notes IS
  'Admin-only cleaned CustomerNotes. Never customer-facing.';

CREATE INDEX IF NOT EXISTS idx_watson_legacy_customers_email
ON watson_legacy_customers (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_watson_legacy_customers_name
ON watson_legacy_customers (last_name, first_name);

CREATE TABLE IF NOT EXISTS watson_legacy_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identity_key TEXT NOT NULL UNIQUE,
  legacy_memberid TEXT NOT NULL REFERENCES watson_legacy_customers (legacy_memberid),
  category TEXT NOT NULL
    CHECK (category IN ('Membership', 'Course Purchase', 'Pattern Purchase', 'LK150 Bundle')),
  transaction_date DATE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 4),
  expiration_date DATE,
  processor TEXT,
  source_record_id TEXT,
  item_id TEXT,
  transaction_id TEXT,
  source_file TEXT,
  batch_id TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_legacy_history_member_date
ON watson_legacy_history (legacy_memberid, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_watson_legacy_history_category
ON watson_legacy_history (category);
