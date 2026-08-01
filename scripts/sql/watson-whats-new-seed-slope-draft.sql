-- OPTIONAL seed: Slope Tool starter card as DRAFT only.
-- Do not run until watson-whats-new.sql has been applied.
-- Do not publish this card until the Slope tool is ready.
--
-- Safe-ish re-run: skips insert when an identical draft title+destination already exists.

INSERT INTO watson_whats_new_cards (
  title,
  description,
  category,
  destination_url,
  button_text,
  board_column,
  publish_date,
  featured,
  status,
  display_order,
  archived
)
SELECT
  'Shape Shoulders Without the Guesswork',
  'Turn shoulder slope measurements into clear shaping steps for machine knitting.',
  'tool',
  '/tools/slope',
  'Try It',
  'just_added',
  CURRENT_DATE,
  FALSE,
  'draft',
  0,
  FALSE
WHERE NOT EXISTS (
  SELECT 1
  FROM watson_whats_new_cards
  WHERE title = 'Shape Shoulders Without the Guesswork'
    AND destination_url = '/tools/slope'
);
