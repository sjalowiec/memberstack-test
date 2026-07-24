import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";
import { siteBrandLabel, type ShopifySiteBrand } from "./shopifyOrderClassify";
import {
  computeShopifySalesPeriodTotals,
  formatShopifyMoney,
  type ShopifySalesPeriodTotals,
} from "./shopifySalesTotals";

export interface ShopifyOrderListFilters {
  q?: string;
  siteBrand?: ShopifySiteBrand | "all";
  financialStatus?: string;
  fulfillmentStatus?: string;
  product?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface ShopifyOrderListRow {
  shopifyOrderId: string;
  orderNumber: string;
  orderName: string | null;
  processedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  currency: string;
  subtotalAmount: number;
  totalDiscounts: number;
  totalTax: number;
  totalShipping: number;
  totalPrice: number;
  totalRefunded: number;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  siteBrand: ShopifySiteBrand;
  isDesignaknit: boolean;
  source: string;
  lineItemSummary: string;
  hasLicenseRecord: boolean;
  licenseStatus: string | null;
}

export interface ShopifyOrderDetail extends ShopifyOrderListRow {
  tags: string | null;
  shopifyOrderGid: string | null;
  lineItems: Array<{
    shopifyLineItemId: string;
    title: string;
    quantity: number;
    sku: string | null;
    variantTitle: string | null;
    vendor: string | null;
    productHandle: string | null;
    unitPrice: number;
  }>;
}

function joinName(first: string | null, last: string | null): string | null {
  const parts = [first, last].map((part) => part?.trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listShopifyOrders(
  filters: ShopifyOrderListFilters = {},
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ShopifyOrderListRow[]> {
  const params: unknown[] = [];
  const where: string[] = [`o.source = 'shopify'`];

  const q = filters.q?.trim();
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const idx = params.length;
    where.push(`(
      lower(coalesce(o.customer_email, '')) LIKE $${idx}
      OR lower(coalesce(o.customer_first_name, '')) LIKE $${idx}
      OR lower(coalesce(o.customer_last_name, '')) LIKE $${idx}
      OR lower(coalesce(o.order_number, '')) LIKE $${idx}
      OR lower(coalesce(o.order_name, '')) LIKE $${idx}
      OR EXISTS (
        SELECT 1 FROM watson_shopify_order_items i
        WHERE i.shopify_order_id = o.shopify_order_id
          AND lower(i.title) LIKE $${idx}
      )
    )`);
  }

  if (filters.siteBrand && filters.siteBrand !== "all") {
    params.push(filters.siteBrand);
    where.push(`o.site_brand = $${params.length}`);
  }

  if (filters.financialStatus?.trim()) {
    params.push(filters.financialStatus.trim().toLowerCase());
    where.push(`lower(coalesce(o.financial_status, '')) = $${params.length}`);
  }

  if (filters.fulfillmentStatus?.trim()) {
    params.push(filters.fulfillmentStatus.trim().toLowerCase());
    where.push(`lower(coalesce(o.fulfillment_status, '')) = $${params.length}`);
  }

  if (filters.product?.trim()) {
    params.push(`%${filters.product.trim().toLowerCase()}%`);
    where.push(`EXISTS (
      SELECT 1 FROM watson_shopify_order_items i
      WHERE i.shopify_order_id = o.shopify_order_id
        AND lower(i.title) LIKE $${params.length}
    )`);
  }

  if (filters.dateFrom?.trim()) {
    params.push(filters.dateFrom.trim());
    where.push(`o.processed_at >= $${params.length}::timestamptz`);
  }

  if (filters.dateTo?.trim()) {
    params.push(filters.dateTo.trim());
    where.push(`o.processed_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);

  const rows = await queryFn<{
    shopify_order_id: string;
    order_number: string;
    order_name: string | null;
    processed_at: Date | string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    customer_email: string | null;
    currency: string;
    subtotal_amount: string | number;
    total_discounts: string | number;
    total_tax: string | number;
    total_shipping: string | number;
    total_price: string | number;
    total_refunded: string | number;
    financial_status: string | null;
    fulfillment_status: string | null;
    cancelled_at: Date | string | null;
    cancel_reason: string | null;
    site_brand: ShopifySiteBrand;
    is_designaknit: boolean;
    source: string;
    line_item_summary: string | null;
    has_license_record: boolean;
    license_status: string | null;
  }>(
    `
    SELECT
      o.shopify_order_id,
      o.order_number,
      o.order_name,
      o.processed_at,
      o.customer_first_name,
      o.customer_last_name,
      o.customer_email,
      o.currency,
      o.subtotal_amount,
      o.total_discounts,
      o.total_tax,
      o.total_shipping,
      o.total_price,
      o.total_refunded,
      o.financial_status,
      o.fulfillment_status,
      o.cancelled_at,
      o.cancel_reason,
      o.site_brand,
      o.is_designaknit,
      o.source,
      (
        SELECT string_agg(i.title || ' ' || i.quantity::text, ', ' ORDER BY i.title)
        FROM watson_shopify_order_items i
        WHERE i.shopify_order_id = o.shopify_order_id
      ) AS line_item_summary,
      (l.id IS NOT NULL) AS has_license_record,
      l.fulfillment_status AS license_status
    FROM watson_shopify_orders o
    LEFT JOIN watson_dak_licenses l ON l.shopify_order_id = o.shopify_order_id
    WHERE ${where.join(" AND ")}
    ORDER BY o.processed_at DESC NULLS LAST, o.shopify_order_id DESC
    LIMIT $${params.length}
    `,
    params,
  );

  return rows.map((row) => ({
    shopifyOrderId: row.shopify_order_id,
    orderNumber: row.order_number,
    orderName: row.order_name,
    processedAt: toIso(row.processed_at),
    customerName: joinName(row.customer_first_name, row.customer_last_name),
    customerEmail: row.customer_email,
    currency: row.currency,
    subtotalAmount: toNumber(row.subtotal_amount),
    totalDiscounts: toNumber(row.total_discounts),
    totalTax: toNumber(row.total_tax),
    totalShipping: toNumber(row.total_shipping),
    totalPrice: toNumber(row.total_price),
    totalRefunded: toNumber(row.total_refunded),
    financialStatus: row.financial_status,
    fulfillmentStatus: row.fulfillment_status,
    cancelledAt: toIso(row.cancelled_at),
    cancelReason: row.cancel_reason,
    siteBrand: row.site_brand,
    isDesignaknit: row.is_designaknit,
    source: row.source,
    lineItemSummary: row.line_item_summary ?? "",
    hasLicenseRecord: Boolean(row.has_license_record),
    licenseStatus: row.license_status,
  }));
}

export async function getShopifyOrderDetail(
  shopifyOrderId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ShopifyOrderDetail | null> {
  const headers = await queryFn<{
    shopify_order_id: string;
    shopify_order_gid: string | null;
    order_number: string;
    order_name: string | null;
    processed_at: Date | string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    customer_email: string | null;
    currency: string;
    subtotal_amount: string | number;
    total_discounts: string | number;
    total_tax: string | number;
    total_shipping: string | number;
    total_price: string | number;
    total_refunded: string | number;
    financial_status: string | null;
    fulfillment_status: string | null;
    cancelled_at: Date | string | null;
    cancel_reason: string | null;
    tags: string | null;
    site_brand: ShopifySiteBrand;
    is_designaknit: boolean;
    source: string;
    has_license_record: boolean;
    license_status: string | null;
  }>(
    `
    SELECT
      o.*,
      (l.id IS NOT NULL) AS has_license_record,
      l.fulfillment_status AS license_status
    FROM watson_shopify_orders o
    LEFT JOIN watson_dak_licenses l ON l.shopify_order_id = o.shopify_order_id
    WHERE o.shopify_order_id = $1
    LIMIT 1
    `,
    [shopifyOrderId],
  );

  const header = headers[0];
  if (!header) return null;

  const items = await queryFn<{
    shopify_line_item_id: string;
    title: string;
    quantity: number;
    sku: string | null;
    variant_title: string | null;
    vendor: string | null;
    product_handle: string | null;
    unit_price: string | number | null;
  }>(
    `
    SELECT
      shopify_line_item_id,
      title,
      quantity,
      sku,
      variant_title,
      vendor,
      product_handle,
      unit_price
    FROM watson_shopify_order_items
    WHERE shopify_order_id = $1
    ORDER BY title, shopify_line_item_id
    `,
    [shopifyOrderId],
  );

  return {
    shopifyOrderId: header.shopify_order_id,
    shopifyOrderGid: header.shopify_order_gid,
    orderNumber: header.order_number,
    orderName: header.order_name,
    processedAt: toIso(header.processed_at),
    customerName: joinName(header.customer_first_name, header.customer_last_name),
    customerEmail: header.customer_email,
    currency: header.currency,
    subtotalAmount: toNumber(header.subtotal_amount),
    totalDiscounts: toNumber(header.total_discounts),
    totalTax: toNumber(header.total_tax),
    totalShipping: toNumber(header.total_shipping),
    totalPrice: toNumber(header.total_price),
    totalRefunded: toNumber(header.total_refunded),
    financialStatus: header.financial_status,
    fulfillmentStatus: header.fulfillment_status,
    cancelledAt: toIso(header.cancelled_at),
    cancelReason: header.cancel_reason,
    tags: header.tags,
    siteBrand: header.site_brand,
    isDesignaknit: header.is_designaknit,
    source: header.source,
    lineItemSummary: items.map((item) => `${item.title} ${item.quantity}`).join(", "),
    hasLicenseRecord: Boolean(header.has_license_record),
    licenseStatus: header.license_status,
    lineItems: items.map((item) => ({
      shopifyLineItemId: item.shopify_line_item_id,
      title: item.title,
      quantity: item.quantity,
      sku: item.sku,
      variantTitle: item.variant_title,
      vendor: item.vendor,
      productHandle: item.product_handle,
      unitPrice: toNumber(item.unit_price),
    })),
  };
}

export async function loadShopifySalesTotals(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ShopifySalesPeriodTotals> {
  const rows = await queryFn<{
    processed_at: Date | string | null;
    total_price: string | number;
    total_refunded: string | number;
    cancelled_at: Date | string | null;
  }>(
    `
    SELECT processed_at, total_price, total_refunded, cancelled_at
    FROM watson_shopify_orders
    WHERE source = 'shopify'
      AND processed_at >= (NOW() - INTERVAL '40 days')
    `,
  );

  return computeShopifySalesPeriodTotals(
    rows.map((row) => ({
      processedAt: row.processed_at,
      totalPrice: toNumber(row.total_price),
      totalRefunded: toNumber(row.total_refunded),
      cancelledAt: row.cancelled_at,
    })),
  );
}

export function formatShopifyOrderMoney(
  amount: number,
  currency: string,
): string {
  return formatShopifyMoney(amount, currency);
}

export function shopifyBrandBadgeLabel(brand: ShopifySiteBrand): string {
  return siteBrandLabel(brand);
}
