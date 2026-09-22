-- Watson native table: vendor directory (internal address book).
-- Standalone. Not linked to customers, products, orders, or transactions.
-- Safe to re-run: uses IF NOT EXISTS.
--
-- Apply against the DEV Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-vendors.sql
-- Or paste into the Supabase SQL editor for the Watson project.
--
-- Do not apply to production until the Vendor Directory is intentionally deployed.
-- Does not modify legacy import tables or other Watson records.

CREATE TABLE IF NOT EXISTS watson_vendors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_name TEXT NOT NULL CHECK (BTRIM(company_name) <> ''),
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  vendor_type TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  account_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_vendors_company_name
ON watson_vendors (LOWER(company_name));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_active_company
ON watson_vendors (is_active, LOWER(company_name));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_email
ON watson_vendors (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_account_number
ON watson_vendors (LOWER(account_number));

ALTER TABLE public.watson_vendors ENABLE ROW LEVEL SECURITY;
