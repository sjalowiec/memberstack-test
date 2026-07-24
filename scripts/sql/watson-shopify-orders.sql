-- Watson native tables: live Shopify orders + DesignaKnit license ops
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify legacy import tables.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-shopify-orders.sql
-- Or paste into the Supabase SQL editor.
-- Or run Sync Shopify Orders (applies native schema first).

CREATE TABLE IF NOT EXISTS watson_shopify_orders (
  shopify_order_id TEXT PRIMARY KEY,
  shopify_order_gid TEXT,
  order_number TEXT NOT NULL,
  order_name TEXT,
  processed_at TIMESTAMPTZ,
  created_at_shopify TIMESTAMPTZ,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_discounts NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_tax NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_shipping NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_refunded NUMERIC(12, 4) NOT NULL DEFAULT 0,
  financial_status TEXT,
  fulfillment_status TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  tags TEXT,
  site_brand TEXT NOT NULL CHECK (site_brand IN ('knit_it_now', 'designaknit')),
  is_designaknit BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'shopify',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_processed_at
  ON watson_shopify_orders (processed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_email
  ON watson_shopify_orders (lower(customer_email));

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_order_number
  ON watson_shopify_orders (order_number);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_site_brand
  ON watson_shopify_orders (site_brand);

CREATE TABLE IF NOT EXISTS watson_shopify_order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_line_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sku TEXT,
  variant_title TEXT,
  vendor TEXT,
  product_id TEXT,
  product_handle TEXT,
  unit_price NUMERIC(12, 4),
  UNIQUE (shopify_order_id, shopify_line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_order_id
  ON watson_shopify_order_items (shopify_order_id);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_title
  ON watson_shopify_order_items (title);

CREATE TABLE IF NOT EXISTS watson_shopify_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  lookback_days INTEGER NOT NULL DEFAULT 90,
  orders_fetched INTEGER NOT NULL DEFAULT 0,
  orders_added INTEGER NOT NULL DEFAULT 0,
  orders_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_sync_runs_started
  ON watson_shopify_sync_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS watson_dak_licenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL UNIQUE REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_order_number TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  product_title TEXT,
  license_number TEXT,
  license_assigned_date DATE,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'assigned', 'delivered')),
  internal_notes TEXT,
  memberid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_dak_licenses_order_number
  ON watson_dak_licenses (shopify_order_number);
