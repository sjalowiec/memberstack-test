/**
 * Columns the Account purchase history reads from live Shopify orders.
 * Sync applies the full native schema. The first account or sales read applies
 * the same two statements when an older database has not been migrated yet.
 *
 * This file must not import schema.ts. Watson pages already pull the Shopify
 * query modules into the browser bundle, and schema.ts uses Node's url API.
 */
import { queryWatson } from "./db";

const PURCHASE_COLUMN_SQL = `ALTER TABLE watson_shopify_orders
  ADD COLUMN IF NOT EXISTS checkout_email TEXT,
  ADD COLUMN IF NOT EXISTS tracking_links JSONB NOT NULL DEFAULT '[]'::jsonb`;

const CHECKOUT_EMAIL_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_checkout_email ON watson_shopify_orders (lower(checkout_email))";

let ready: Promise<void> | null = null;

export function resetShopifyPurchaseSchemaForTests(): void {
  ready = null;
}

export function ensureShopifyOrderPurchaseColumns(): Promise<void> {
  if (!ready) {
    ready = ensureShopifyOrderPurchaseColumnsOnce().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function ensureShopifyOrderPurchaseColumnsOnce(): Promise<void> {
  try {
    await queryWatson(
      "SELECT checkout_email, tracking_links FROM watson_shopify_orders LIMIT 1",
    );
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/checkout_email|tracking_links/i.test(message)) {
      throw error;
    }
  }

  await queryWatson(PURCHASE_COLUMN_SQL);
  await queryWatson(CHECKOUT_EMAIL_INDEX_SQL);
}
