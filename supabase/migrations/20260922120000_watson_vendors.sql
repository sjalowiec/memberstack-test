-- Watson vendor directory (internal address book).
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
-- Do not apply this migration to production from this change set.

CREATE TABLE IF NOT EXISTS public.watson_vendors (
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
  ON public.watson_vendors (LOWER(company_name));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_active_company
  ON public.watson_vendors (is_active, LOWER(company_name));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_email
  ON public.watson_vendors (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_watson_vendors_account_number
  ON public.watson_vendors (LOWER(account_number));

ALTER TABLE public.watson_vendors ENABLE ROW LEVEL SECURITY;
