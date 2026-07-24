import { getWatsonPool, queryWatson } from "./db";
import { applyWatsonNativeSchema } from "./schema";
import { DEFAULT_SHOPIFY_LOOKBACK_DAYS, getShopifyAdminConfig } from "./shopifyEnv";
import { fetchShopifyOrdersSince } from "./shopifyAdminClient";
import { mapShopifyRestOrder, type MappedShopifyOrder } from "./shopifyOrderMap";

export type ShopifySyncTrigger = "manual" | "scheduled";

export interface ShopifySyncResult {
  ok: boolean;
  syncRunId: string | null;
  lookbackDays: number;
  ordersFetched: number;
  ordersAdded: number;
  ordersUpdated: number;
  errorMessage: string | null;
  completedAt: string | null;
}

export interface ShopifySyncStatus {
  lastSuccessfulSyncAt: string | null;
  lastRun: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    triggerSource: string;
    lookbackDays: number;
    ordersFetched: number;
    ordersAdded: number;
    ordersUpdated: number;
    errorMessage: string | null;
  } | null;
}

function lookbackIso(lookbackDays: number, now = new Date()): string {
  const start = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return start.toISOString();
}

async function upsertMappedOrder(
  order: MappedShopifyOrder,
): Promise<"added" | "updated"> {
  const existing = await queryWatson<{ shopify_order_id: string }>(
    `SELECT shopify_order_id FROM watson_shopify_orders WHERE shopify_order_id = $1`,
    [order.shopifyOrderId],
  );
  const isUpdate = existing.length > 0;

  await queryWatson(
    `
    INSERT INTO watson_shopify_orders (
      shopify_order_id,
      shopify_order_gid,
      order_number,
      order_name,
      processed_at,
      created_at_shopify,
      customer_first_name,
      customer_last_name,
      customer_email,
      currency,
      subtotal_amount,
      total_discounts,
      total_tax,
      total_shipping,
      total_price,
      total_refunded,
      financial_status,
      fulfillment_status,
      cancelled_at,
      cancel_reason,
      tags,
      site_brand,
      is_designaknit,
      source,
      synced_at,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,'shopify',NOW(),NOW()
    )
    ON CONFLICT (shopify_order_id) DO UPDATE SET
      shopify_order_gid = EXCLUDED.shopify_order_gid,
      order_number = EXCLUDED.order_number,
      order_name = EXCLUDED.order_name,
      processed_at = EXCLUDED.processed_at,
      created_at_shopify = EXCLUDED.created_at_shopify,
      customer_first_name = EXCLUDED.customer_first_name,
      customer_last_name = EXCLUDED.customer_last_name,
      customer_email = EXCLUDED.customer_email,
      currency = EXCLUDED.currency,
      subtotal_amount = EXCLUDED.subtotal_amount,
      total_discounts = EXCLUDED.total_discounts,
      total_tax = EXCLUDED.total_tax,
      total_shipping = EXCLUDED.total_shipping,
      total_price = EXCLUDED.total_price,
      total_refunded = EXCLUDED.total_refunded,
      financial_status = EXCLUDED.financial_status,
      fulfillment_status = EXCLUDED.fulfillment_status,
      cancelled_at = EXCLUDED.cancelled_at,
      cancel_reason = EXCLUDED.cancel_reason,
      tags = EXCLUDED.tags,
      site_brand = EXCLUDED.site_brand,
      is_designaknit = EXCLUDED.is_designaknit,
      source = 'shopify',
      synced_at = NOW(),
      updated_at = NOW()
    `,
    [
      order.shopifyOrderId,
      order.shopifyOrderGid,
      order.orderNumber,
      order.orderName,
      order.processedAt,
      order.createdAtShopify,
      order.customerFirstName,
      order.customerLastName,
      order.customerEmail,
      order.currency,
      order.subtotalAmount,
      order.totalDiscounts,
      order.totalTax,
      order.totalShipping,
      order.totalPrice,
      order.totalRefunded,
      order.financialStatus,
      order.fulfillmentStatus,
      order.cancelledAt,
      order.cancelReason,
      order.tags,
      order.siteBrand,
      order.isDesignaknit,
    ],
  );

  await queryWatson(`DELETE FROM watson_shopify_order_items WHERE shopify_order_id = $1`, [
    order.shopifyOrderId,
  ]);

  for (const item of order.lineItems) {
    await queryWatson(
      `
      INSERT INTO watson_shopify_order_items (
        shopify_order_id,
        shopify_line_item_id,
        title,
        quantity,
        sku,
        variant_title,
        vendor,
        product_id,
        product_handle,
        unit_price
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        order.shopifyOrderId,
        item.shopifyLineItemId,
        item.title,
        item.quantity,
        item.sku,
        item.variantTitle,
        item.vendor,
        item.productId,
        item.productHandle,
        item.unitPrice,
      ],
    );
  }

  return isUpdate ? "updated" : "added";
}

export async function syncShopifyOrders(options: {
  lookbackDays?: number;
  triggerSource?: ShopifySyncTrigger;
  fetchImpl?: typeof fetch;
} = {}): Promise<ShopifySyncResult> {
  const lookbackDays = options.lookbackDays ?? DEFAULT_SHOPIFY_LOOKBACK_DAYS;
  const triggerSource = options.triggerSource ?? "manual";
  const config = getShopifyAdminConfig();
  if ("error" in config) {
    return {
      ok: false,
      syncRunId: null,
      lookbackDays,
      ordersFetched: 0,
      ordersAdded: 0,
      ordersUpdated: 0,
      errorMessage: config.error,
      completedAt: null,
    };
  }

  const pool = await getWatsonPool();
  const client = await pool.connect();
  try {
    await applyWatsonNativeSchema(client);
  } finally {
    client.release();
  }

  const started = await queryWatson<{ id: string }>(
    `
    INSERT INTO watson_shopify_sync_runs (status, trigger_source, lookback_days)
    VALUES ('running', $1, $2)
    RETURNING id::text AS id
    `,
    [triggerSource, lookbackDays],
  );
  const syncRunId = started[0]?.id ?? null;

  let ordersFetched = 0;
  let ordersAdded = 0;
  let ordersUpdated = 0;

  try {
    const rawOrders = await fetchShopifyOrdersSince({
      createdAtMin: lookbackIso(lookbackDays),
      config,
      fetchImpl: options.fetchImpl,
    });
    ordersFetched = rawOrders.length;

    for (const raw of rawOrders) {
      const mapped = mapShopifyRestOrder(raw);
      if (!mapped) continue;
      const result = await upsertMappedOrder(mapped);
      if (result === "added") ordersAdded += 1;
      else ordersUpdated += 1;
    }

    const completedAt = new Date().toISOString();
    if (syncRunId) {
      await queryWatson(
        `
        UPDATE watson_shopify_sync_runs
        SET
          status = 'completed',
          completed_at = $2::timestamptz,
          orders_fetched = $3,
          orders_added = $4,
          orders_updated = $5,
          error_message = NULL
        WHERE id = $1::bigint
        `,
        [syncRunId, completedAt, ordersFetched, ordersAdded, ordersUpdated],
      );
    }

    return {
      ok: true,
      syncRunId,
      lookbackDays,
      ordersFetched,
      ordersAdded,
      ordersUpdated,
      errorMessage: null,
      completedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (syncRunId) {
      await queryWatson(
        `
        UPDATE watson_shopify_sync_runs
        SET
          status = 'failed',
          completed_at = NOW(),
          orders_fetched = $2,
          orders_added = $3,
          orders_updated = $4,
          error_message = $5
        WHERE id = $1::bigint
        `,
        [syncRunId, ordersFetched, ordersAdded, ordersUpdated, message.slice(0, 2000)],
      );
    }
    return {
      ok: false,
      syncRunId,
      lookbackDays,
      ordersFetched,
      ordersAdded,
      ordersUpdated,
      errorMessage: message,
      completedAt: null,
    };
  }
}

export async function getShopifySyncStatus(): Promise<ShopifySyncStatus> {
  try {
    const lastSuccess = await queryWatson<{ completed_at: Date | string }>(
      `
      SELECT completed_at
      FROM watson_shopify_sync_runs
      WHERE status = 'completed'
      ORDER BY completed_at DESC NULLS LAST
      LIMIT 1
      `,
    );
    const lastRuns = await queryWatson<{
      id: string;
      started_at: Date | string;
      completed_at: Date | string | null;
      status: string;
      trigger_source: string;
      lookback_days: number;
      orders_fetched: number;
      orders_added: number;
      orders_updated: number;
      error_message: string | null;
    }>(
      `
      SELECT
        id::text AS id,
        started_at,
        completed_at,
        status,
        trigger_source,
        lookback_days,
        orders_fetched,
        orders_added,
        orders_updated,
        error_message
      FROM watson_shopify_sync_runs
      ORDER BY started_at DESC
      LIMIT 1
      `,
    );

    const last = lastRuns[0];
    return {
      lastSuccessfulSyncAt: lastSuccess[0]?.completed_at
        ? new Date(lastSuccess[0].completed_at).toISOString()
        : null,
      lastRun: last
        ? {
            id: last.id,
            startedAt: new Date(last.started_at).toISOString(),
            completedAt: last.completed_at
              ? new Date(last.completed_at).toISOString()
              : null,
            status: last.status,
            triggerSource: last.trigger_source,
            lookbackDays: last.lookback_days,
            ordersFetched: last.orders_fetched,
            ordersAdded: last.orders_added,
            ordersUpdated: last.orders_updated,
            errorMessage: last.error_message,
          }
        : null,
    };
  } catch {
    return { lastSuccessfulSyncAt: null, lastRun: null };
  }
}
