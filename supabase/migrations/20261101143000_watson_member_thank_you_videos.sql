-- One optional video reply and one explicit completion time per thank-you charge.
-- Existing video_sent_at and card_sent_at values are left as they are.
-- completed_at stays null, so current rows remain on the To Do list.

ALTER TABLE public.watson_member_thank_yous
  ADD COLUMN IF NOT EXISTS video_reply_id TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.watson_member_thank_yous
  DROP CONSTRAINT IF EXISTS watson_member_thank_yous_video_reply_id_check;

ALTER TABLE public.watson_member_thank_yous
  ADD CONSTRAINT watson_member_thank_yous_video_reply_id_check
  CHECK (video_reply_id IS NULL OR video_reply_id ~ '^[A-Za-z0-9._-]{1,120}$');

CREATE UNIQUE INDEX IF NOT EXISTS watson_member_thank_yous_video_reply_id_key
  ON public.watson_member_thank_yous (video_reply_id);
