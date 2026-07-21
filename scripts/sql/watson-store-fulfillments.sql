-- Watson native table: store fulfillment records (shipping cost / supplier invoice history)
-- Safe to re-run: uses IF NOT EXISTS.
-- Does not modify legacy import tables.
--
-- Apply against the Watson Postgres database (WATSON_DATABASE_URL), e.g.:
--   psql "$WATSON_DATABASE_URL" -f scripts/sql/watson-store-fulfillments.sql
-- Or paste into the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS watson_store_fulfillments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memberid TEXT NOT NULL,
  shopify_order_id TEXT,
  shopify_order_number TEXT NOT NULL,
  product_description TEXT NOT NULL,
  product_variant_id TEXT,
  supplier TEXT NOT NULL,
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  actual_shipping_cost NUMERIC(12, 4) NOT NULL CHECK (actual_shipping_cost >= 0),
  customer_shipping_charge NUMERIC(12, 4) CHECK (customer_shipping_charge IS NULL OR customer_shipping_charge >= 0),
  box_count INTEGER NOT NULL DEFAULT 1 CHECK (box_count >= 1),
  ship_date DATE NOT NULL,
  supplier_invoice_number TEXT,
  destination_state TEXT,
  destination_postal TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_id
  ON watson_store_fulfillments (shopify_order_id);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_memberid_ship_date
  ON watson_store_fulfillments (memberid, ship_date DESC);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_ship_date
  ON watson_store_fulfillments (ship_date);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_supplier
  ON watson_store_fulfillments (supplier);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_product
  ON watson_store_fulfillments (product_description);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_number
  ON watson_store_fulfillments (shopify_order_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_store_fulfillments_order_tracking_unique
  ON watson_store_fulfillments (shopify_order_number, tracking_number)
  WHERE tracking_number IS NOT NULL AND BTRIM(tracking_number) <> '';
