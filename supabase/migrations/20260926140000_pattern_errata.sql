-- Pattern errata (admin corrections for saved Drop Shoulder and Sleeveless patterns).
-- Server-side Postgres only. RLS enabled with no anon/authenticated policies.
-- Do not use FORCE ROW LEVEL SECURITY (table owners / bypass roles keep access).
--
-- Apply against the DEV Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/pattern-errata.sql
--
-- The seed row is a draft. Re-running does not overwrite it and does not publish it.
-- Do not apply to production until pattern errata is intentionally deployed.
-- Does not modify saved patterns, legacy import tables, or send email.

CREATE TABLE IF NOT EXISTS public.pattern_errata (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  title TEXT NOT NULL CHECK (BTRIM(title) <> ''),
  what_changed TEXT NOT NULL CHECK (BTRIM(what_changed) <> ''),
  knitter_action TEXT NOT NULL CHECK (BTRIM(knitter_action) <> ''),
  published_on DATE,
  affected_builders TEXT[] NOT NULL DEFAULT '{}',
  affected_sizes JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  CONSTRAINT pattern_errata_slug_key UNIQUE (slug),
  CONSTRAINT pattern_errata_published_has_date CHECK (
    status <> 'published' OR published_on IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS pattern_errata_public_idx
  ON public.pattern_errata (published_on DESC, slug)
  WHERE status = 'published';

ALTER TABLE public.pattern_errata ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pattern_errata (
  id,
  slug,
  status,
  title,
  what_changed,
  knitter_action,
  published_on,
  affected_builders,
  affected_sizes,
  match_rules,
  updated_by
)
VALUES (
  '6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61',
  'baby-kids-finished-length',
  'draft',
  'Baby and kids finished sweater lengths',
  $errata$New Drop Shoulder and Sleeveless patterns for Baby and Kids sizes now use finished hem-to-shoulder lengths. The previous defaults were body measurements: back-waist length for babies, and neck-to-wrist length for kids. Saved patterns still have the measurements they were saved with. Those measurements do not update automatically.

The size table lists each corrected finished length. Kids size 2 also uses a 7.5 in upper arm so it follows Baby 24 mo. The previous kids size 2 upper arm was 6 in.

Some Drop Shoulder V-neck cardigan shaping charts did not finish on the same shoulder stitch count as the written instructions. New patterns keep the instructions, shaping chart, and diagram on one shoulder. That chart correction is not assumed for every saved pattern.$errata$,
  'Review the finished length on your saved pattern, and the upper arm on a Kids size 2 pattern. If you want the corrected defaults, create a new pattern and choose the size again. Saved measurements do not update automatically.',
  NULL,
  ARRAY['drop-shoulder', 'sleeveless']::text[],
  '{"baby":["3 mo","6 mo","12 mo","18 mo","24 mo"],"kids":["2 yr","4 yr","6 yr","8 yr","10 yr","12 yr","14 yr","16 yr"]}'::jsonb,
  '{"kind":"finished-length-defaults","correctedAt":"2026-09-26T13:04:04.000Z","sizes":[{"audience":"baby","size":"3 mo","oldLengthInches":6,"newLengthInches":8.75},{"audience":"baby","size":"6 mo","oldLengthInches":7,"newLengthInches":9.75},{"audience":"baby","size":"12 mo","oldLengthInches":7.5,"newLengthInches":10.25},{"audience":"baby","size":"18 mo","oldLengthInches":8,"newLengthInches":10.75},{"audience":"baby","size":"24 mo","oldLengthInches":8.5,"newLengthInches":11.25},{"audience":"kids","size":"2 yr","oldLengthInches":18,"newLengthInches":11.25,"oldUpperArmInches":6,"newUpperArmInches":7.5},{"audience":"kids","size":"4 yr","oldLengthInches":19.5,"newLengthInches":12.75},{"audience":"kids","size":"6 yr","oldLengthInches":20.5,"newLengthInches":13.5},{"audience":"kids","size":"8 yr","oldLengthInches":22,"newLengthInches":14.75},{"audience":"kids","size":"10 yr","oldLengthInches":24,"newLengthInches":15.5},{"audience":"kids","size":"12 yr","oldLengthInches":26,"newLengthInches":16.5},{"audience":"kids","size":"14 yr","oldLengthInches":27,"newLengthInches":17.5},{"audience":"kids","size":"16 yr","oldLengthInches":28,"newLengthInches":18.5}]}'::jsonb,
  'dev-seed'
)
ON CONFLICT (id) DO NOTHING;
