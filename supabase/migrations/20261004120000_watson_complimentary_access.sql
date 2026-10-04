-- Complimentary access-through dates, keyed by Memberstack member id.
-- Separate from legacy_members.subscriptionexpiring.

CREATE TABLE IF NOT EXISTS public.watson_complimentary_access (
  memberstack_id TEXT PRIMARY KEY,
  access_through DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_watson_complimentary_access_through
  ON public.watson_complimentary_access (access_through);

ALTER TABLE public.watson_complimentary_access ENABLE ROW LEVEL SECURITY;
