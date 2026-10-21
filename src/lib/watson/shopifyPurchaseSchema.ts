/**
 * Columns the Account purchase history reads from live Shopify orders.
 * Sync applies the full native schema; the first account or sales read applies
 * just these statements when an older database has not been migrated yet.
 */
import { queryWatson, getWatsonPool } from "./db";
import { applySchemaStatements, getWatsonNativeSchemaStatements } from "./schema";

export const SHOPIFY_PURCHASE_SCHEMA_LABELS = [
  "alter watson_shopify_orders purchase columns",
  "index idx_watson_shopify_orders_checkout_email",
] as const;

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

  const statements = getWatsonNativeSchemaStatements().filter((statement) =>
    (SHOPIFY_PURCHASE_SCHEMA_LABELS as readonly string[]).includes(statement.label),
  );
  const pool = await getWatsonPool();
  await applySchemaStatements(pool, statements);
}
