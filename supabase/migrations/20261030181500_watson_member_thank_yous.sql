-- One thank-you row per annual membership Stripe charge.
-- Video and card are independent. A later renewal uses a new charge id,
-- so its boxes start unchecked. This table does not change payments,
-- memberships, addresses, or birthday-card tracking.

CREATE TABLE IF NOT EXISTS public.watson_member_thank_yous (
  stripe_charge_id TEXT PRIMARY KEY,
  video_sent_at TIMESTAMPTZ,
  card_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watson_member_thank_yous_charge_id_check
    CHECK (stripe_charge_id ~ '^ch_[A-Za-z0-9]+$')
);

ALTER TABLE public.watson_member_thank_yous ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.watson_member_thank_yous FROM anon, authenticated, service_role;
