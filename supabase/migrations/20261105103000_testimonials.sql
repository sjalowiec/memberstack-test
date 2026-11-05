-- Server-only testimonial archive and publication switch.
-- active defaults to false. Legacy Show, Viewed, and UseInEmail are history only.

CREATE TABLE IF NOT EXISTS public.testimonials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  legacy_rating_id INTEGER,
  original_quote TEXT NOT NULL,
  original_attribution TEXT NOT NULL,
  display_quote TEXT,
  display_attribution TEXT,
  review_date DATE,
  rating INTEGER,
  legacy_member_id TEXT,
  memberstack_member_id TEXT,
  source TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  legacy_show BOOLEAN,
  legacy_viewed BOOLEAN,
  legacy_use_in_email BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT testimonials_source_check
    CHECK (source IN ('legacy_import', 'member_submission', 'admin_entry')),
  CONSTRAINT testimonials_legacy_rating_id_key UNIQUE (legacy_rating_id)
);

CREATE INDEX IF NOT EXISTS testimonials_active_review_date_idx
  ON public.testimonials (active, review_date DESC NULLS LAST, created_at DESC);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.testimonials FROM anon, authenticated, service_role;
