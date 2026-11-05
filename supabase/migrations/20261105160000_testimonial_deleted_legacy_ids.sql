-- Legacy rating ids an admin has deleted.
-- A repeat import uses this marker and does not recreate those reviews.
-- Only the legacy id is kept.

CREATE TABLE IF NOT EXISTS public.testimonial_deleted_legacy_ids (
  legacy_rating_id INTEGER PRIMARY KEY
);

ALTER TABLE public.testimonial_deleted_legacy_ids ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.testimonial_deleted_legacy_ids FROM anon, authenticated, service_role;
