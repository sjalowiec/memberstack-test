-- Review status and archive state for testimonials.
-- Existing rows become reviewed. Active rows stay active. Inactive rows stay inactive.
-- Quotes, highlights, and deletion markers are not changed.

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS publication_state TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS staff_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_notification_error TEXT,
  ADD COLUMN IF NOT EXISTS staff_notification_claimed_at TIMESTAMPTZ;

UPDATE public.testimonials
SET publication_state = 'active'
WHERE active IS TRUE
  AND publication_state IS DISTINCT FROM 'active';

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_publication_state_check;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_publication_state_check
  CHECK (publication_state IN ('active', 'inactive', 'archived'));

CREATE INDEX IF NOT EXISTS testimonials_unreviewed_idx
  ON public.testimonials (created_at DESC)
  WHERE reviewed = FALSE AND publication_state <> 'archived';

CREATE OR REPLACE FUNCTION public.testimonials_sync_publication_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.publication_state IS NULL
     OR NEW.publication_state NOT IN ('active', 'inactive', 'archived') THEN
    NEW.publication_state := CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.publication_state IS NOT DISTINCT FROM OLD.publication_state
     AND NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.publication_state := CASE
      WHEN NEW.active THEN 'active'
      WHEN OLD.publication_state = 'archived' THEN 'archived'
      ELSE 'inactive'
    END;
  END IF;

  NEW.active := NEW.publication_state = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS testimonials_sync_publication_state ON public.testimonials;

CREATE TRIGGER testimonials_sync_publication_state
BEFORE INSERT OR UPDATE OF active, publication_state
ON public.testimonials
FOR EACH ROW
EXECUTE PROCEDURE public.testimonials_sync_publication_state();

REVOKE ALL ON FUNCTION public.testimonials_sync_publication_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.testimonials_sync_publication_state() FROM anon, authenticated, service_role;
