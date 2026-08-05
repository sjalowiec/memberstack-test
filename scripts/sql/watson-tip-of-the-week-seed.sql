-- Seed the first Tip of the Week (Stockinette Curl).
-- Safe to re-run: ON CONFLICT (tip_id) DO UPDATE.
--
-- Apply AFTER watson-tip-of-the-week.sql:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-tip-of-the-week-seed.sql
--
-- Dates: first Saturday email launch 2026-08-08 through 2026-08-14 (America/Los_Angeles calendar days).
-- tip_id matches the existing Netlify Blobs reaction key from the first draft.

INSERT INTO watson_tip_of_the_week (
  tip_id,
  title,
  intro,
  video_content_id,
  available_from,
  available_through,
  status,
  availability_notice,
  availability_footer_template,
  try_copy,
  sue_tip_copy,
  learn_points_json,
  related_links_json,
  eyebrow,
  updated_at
) VALUES (
  'taming-the-curl-2026-08',
  'Tame the Dreaded Stockinette Curl',
  'Stockinette naturally curls at the edges. It isn’t something you’re doing wrong, but it can make knitting and finishing more difficult. This week, explore six ways to control the curl.',
  '339',
  '2026-08-08'::date,
  '2026-08-14'::date,
  'scheduled',
  'Free to watch this week',
  'This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.',
  'Knit a small stockinette swatch and try one of the edge treatments from the video. Compare it with an untreated edge.',
  'Machine-knit stockinette can appear to curl even more than hand knitting because the stitches are so uniform. Don’t judge the finished fabric while it is still on the machine.',
  '["Why stockinette curls","When the curl will disappear during finishing","When you need to control it while knitting","Six techniques you can use"]',
  '[{"type":"video","videoId":"784","title":"Easy (Lazy) Edge Finish","note":"A simple edge finish for slits and openings"},{"type":"video","videoId":"456","title":"Wet Blocking","note":"Four reasons to wet block instead of steam"},{"type":"link","title":"Stockinette Stitch","url":"/glossary/stockinette-stitch","note":"Glossary: the basic smooth knit fabric"}]',
  'TIP OF THE WEEK',
  NOW()
)
ON CONFLICT (tip_id) DO UPDATE SET
  title = EXCLUDED.title,
  intro = EXCLUDED.intro,
  video_content_id = EXCLUDED.video_content_id,
  available_from = EXCLUDED.available_from,
  available_through = EXCLUDED.available_through,
  status = EXCLUDED.status,
  availability_notice = EXCLUDED.availability_notice,
  availability_footer_template = EXCLUDED.availability_footer_template,
  try_copy = EXCLUDED.try_copy,
  sue_tip_copy = EXCLUDED.sue_tip_copy,
  learn_points_json = EXCLUDED.learn_points_json,
  related_links_json = EXCLUDED.related_links_json,
  eyebrow = EXCLUDED.eyebrow,
  updated_at = NOW();
