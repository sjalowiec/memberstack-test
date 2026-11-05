-- One highlighted passage in the display quote, stored as character offsets.
-- The original quote is unchanged. Both ends are required, and the range must fit the display quote.

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS display_highlight_start INTEGER,
  ADD COLUMN IF NOT EXISTS display_highlight_end INTEGER;

ALTER TABLE public.testimonials
  DROP CONSTRAINT IF EXISTS testimonials_display_highlight_check;

ALTER TABLE public.testimonials
  ADD CONSTRAINT testimonials_display_highlight_check
  CHECK (
    (
      display_highlight_start IS NULL
      AND display_highlight_end IS NULL
    )
    OR (
      display_quote IS NOT NULL
      AND display_highlight_start IS NOT NULL
      AND display_highlight_end IS NOT NULL
      AND display_highlight_start >= 0
      AND display_highlight_end > display_highlight_start
      AND display_highlight_end <= char_length(display_quote)
    )
  );
