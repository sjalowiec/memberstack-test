BEGIN;

ALTER TABLE public.watson_ebook_entitlements
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.watson_ebook_entitlements
  FROM anon, authenticated;

DROP TABLE public.help_hub_categories_backup_20260916_promote;
DROP TABLE public.help_hub_tips_backup_20260916_promote;

COMMIT;
