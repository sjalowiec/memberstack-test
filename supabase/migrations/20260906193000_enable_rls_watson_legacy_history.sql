-- Enable Row Level Security on cleaned legacy history tables.
-- Accessed only via server-side Postgres (WATSON_DATABASE_URL).
-- No policies: anon and authenticated PostgREST roles get no access.

ALTER TABLE public.watson_legacy_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watson_legacy_history ENABLE ROW LEVEL SECURITY;
