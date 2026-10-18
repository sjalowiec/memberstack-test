-- Help Hub admin image uploads. Additive. Does not modify help_hub_tips.

CREATE TABLE IF NOT EXISTS public.help_hub_images (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.help_hub_images ENABLE ROW LEVEL SECURITY;
