-- Watson-native ebook entitlements (Assign ebook).
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify legacy_store_transactions or legacy_store_transaction_items.
--
-- Apply against the DEV Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-ebook-entitlements.sql
--
-- Do not apply to production until Assign ebook is intentionally deployed.

CREATE TABLE IF NOT EXISTS watson_ebook_entitlements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id TEXT NOT NULL,
  memberstack_id TEXT,
  entitlement_email TEXT NOT NULL,
  legacy_memberid TEXT,
  reason TEXT NOT NULL CHECK (reason IN (
    'verified_legacy_purchase',
    'subscriber_bonus',
    'included_with_product',
    'courtesy_replacement',
    'manual_correction'
  )),
  note TEXT,
  source_storetransactionid BIGINT,
  granted_by TEXT NOT NULL DEFAULT 'Sue',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_ebook_entitlements_active_memberstack_item
ON watson_ebook_entitlements (memberstack_id, item_id)
WHERE revoked_at IS NULL AND memberstack_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_ebook_entitlements_active_email_item
ON watson_ebook_entitlements (LOWER(TRIM(entitlement_email)), item_id)
WHERE revoked_at IS NULL AND memberstack_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_watson_ebook_entitlements_email
ON watson_ebook_entitlements (LOWER(TRIM(entitlement_email)));

CREATE INDEX IF NOT EXISTS idx_watson_ebook_entitlements_legacy_memberid
ON watson_ebook_entitlements (legacy_memberid);

CREATE INDEX IF NOT EXISTS idx_watson_ebook_entitlements_item
ON watson_ebook_entitlements (item_id);
