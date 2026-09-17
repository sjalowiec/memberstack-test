import { queryWatson } from "./db";
import {
  customerEmailLookupKeys,
  normalizeCustomerEmail,
} from "./customerIdentifier";
import { getLegacyMemberById } from "./memberDetail";
import type {
  MemberOrderDisplay,
  MemberOrderItemDisplay,
  MemberOrderSource,
} from "./memberOrders";
import { formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";
import { formatShopifyMoney } from "./shopifySalesTotals";

export const SHOPIFY_ORDERS_BY_EMAILS_SQL = `
  SELECT
    shopify_order_id,
    order_number,
    order_name,
    processed_at,
    customer_email,
    currency,
    total_price,
    total_refunded,
    financial_status,
    fulfillment_status,
    cancelled_at,
    cancel_reason,
    source
  FROM watson_shopify_orders
  WHERE source = 'shopify'
    AND lower(trim(coalesce(customer_email, ''))) = ANY($1::text[])
  ORDER BY processed_at DESC NULLS LAST, shopify_order_id DESC
`;

export const SHOPIFY_ORDER_COUNT_BY_EMAILS_SQL = `
  SELECT COUNT(*)::text AS order_count
  FROM watson_shopify_orders
  WHERE source = 'shopify'
    AND lower(trim(coalesce(customer_email, ''))) = ANY($1::text[])
`;

export const SHOPIFY_ORDER_ITEMS_BY_ORDER_IDS_SQL = `
  SELECT
    shopify_order_id,
    shopify_line_item_id,
    title,
    quantity,
    sku,
    variant_title,
    unit_price
  FROM watson_shopify_order_items
  WHERE shopify_order_id = ANY($1::text[])
  ORDER BY shopify_order_id, title, shopify_line_item_id
`;

export interface ShopifyOrderHistoryRow {
  shopify_order_id: string;
  order_number: string;
  order_name: string | null;
  processed_at: Date | string | null;
  customer_email: string | null;
  currency: string;
  total_price: string | number;
  total_refunded: string | number;
  financial_status: string | null;
  fulfillment_status: string | null;
  cancelled_at: Date | string | null;
  cancel_reason: string | null;
  source: string;
}

export interface ShopifyOrderItemHistoryRow {
  shopify_order_id: string;
  shopify_line_item_id: string;
  title: string;
  quantity: number;
  sku: string | null;
  variant_title: string | null;
  unit_price: string | number | null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(amount) ? amount : 0;
}

function humanizeStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function collectEmailLookupKeys(
  emails: Array<string | null | undefined>,
): string[] {
  const keys = new Set<string>();
  for (const email of emails) {
    for (const key of customerEmailLookupKeys(email)) {
      keys.add(key);
    }
  }
  return [...keys];
}

export function formatShopifyMemberOrderStatus(row: {
  financial_status: string | null;
  fulfillment_status: string | null;
  cancelled_at: Date | string | null;
  cancel_reason: string | null;
  total_refunded?: string | number | null;
}): string | null {
  if (row.cancelled_at) {
    const reason = humanizeStatus(row.cancel_reason);
    return reason ? `Cancelled (${reason})` : "Cancelled";
  }
  const financial = humanizeStatus(row.financial_status);
  if (financial) {
    return financial;
  }
  const refunded = toNumber(row.total_refunded);
  if (refunded > 0) {
    return "Refunded";
  }
  return humanizeStatus(row.fulfillment_status);
}

export function buildShopifyOrderItemDescription(item: ShopifyOrderItemHistoryRow): string {
  const parts: string[] = [];
  if (item.title?.trim()) {
    parts.push(item.title.trim());
  }
  if (item.variant_title?.trim()) {
    parts.push(item.variant_title.trim());
  }
  if (item.sku?.trim()) {
    parts.push(`SKU ${item.sku.trim()}`);
  }
  return parts.join(" · ");
}

export function buildShopifyOrderItemDisplay(
  item: ShopifyOrderItemHistoryRow,
  currency: string,
): MemberOrderItemDisplay {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
  const unitPrice = toNumber(item.unit_price);
  return {
    transactionItemId: item.shopify_line_item_id,
    description: buildShopifyOrderItemDescription(item) || "(untitled item)",
    quantity: String(quantity),
    itemPrice: formatShopifyMoney(unitPrice, currency),
    lineTotal: formatShopifyMoney(unitPrice * quantity, currency),
  };
}

export function shopifyOrderDisplayId(shopifyOrderId: string): string {
  return `shopify:${shopifyOrderId}`;
}

export function shopifyOrderDetailHref(shopifyOrderId: string): string {
  return `/watson/sales/${encodeURIComponent(shopifyOrderId)}`;
}

export function buildShopifyOrderDisplay(
  order: ShopifyOrderHistoryRow,
  items: ShopifyOrderItemHistoryRow[],
): MemberOrderDisplay {
  const currency = order.currency?.trim() || "USD";
  const orderDate = order.processed_at
    ? formatMemberJoinedDateDisplay(order.processed_at)
    : null;
  const orderDateSort = order.processed_at
    ? order.processed_at instanceof Date
      ? order.processed_at.toISOString()
      : String(order.processed_at)
    : "";
  const total = toNumber(order.total_price);
  const orderName = order.order_name?.trim() || `#${order.order_number}`;

  return {
    storeTransactionId: shopifyOrderDisplayId(order.shopify_order_id),
    transactionId: orderName,
    orderDate: orderDate || null,
    orderDateSort,
    orderStatus: formatShopifyMemberOrderStatus(order),
    orderTotal: formatShopifyMoney(total, currency),
    orderTotalSort: String(total),
    paymentMethod: null,
    items: items.map((item) => buildShopifyOrderItemDisplay(item, currency)),
    source: "shopify",
    sourceLabel: "Shopify",
    shopifyOrderId: order.shopify_order_id,
    shopifyOrderNumber: order.order_number,
    shopifyOrderHref: shopifyOrderDetailHref(order.shopify_order_id),
  };
}

export function mergeMemberOrders(
  legacyOrders: MemberOrderDisplay[],
  shopifyOrders: MemberOrderDisplay[],
): MemberOrderDisplay[] {
  const seenShopifyIds = new Set<string>();
  const seenRowIds = new Set<string>();
  const merged: MemberOrderDisplay[] = [];

  for (const order of [...legacyOrders, ...shopifyOrders]) {
    if (seenRowIds.has(order.storeTransactionId)) {
      continue;
    }
    if (order.source === "shopify" && order.shopifyOrderId) {
      if (seenShopifyIds.has(order.shopifyOrderId)) {
        continue;
      }
      seenShopifyIds.add(order.shopifyOrderId);
    }
    seenRowIds.add(order.storeTransactionId);
    merged.push(order);
  }

  return merged.sort((left, right) => {
    const dateCompare = right.orderDateSort.localeCompare(left.orderDateSort);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return right.storeTransactionId.localeCompare(left.storeTransactionId);
  });
}

/** Refunded/cancelled Shopify rows stay visible but are not counted as paid sales. */
export function shopifyOrderCountsTowardPaidSales(
  order: Pick<MemberOrderDisplay, "source" | "orderStatus">,
): boolean {
  if (order.source !== "shopify") {
    return true;
  }
  const status = (order.orderStatus ?? "").trim().toLowerCase();
  if (!status) {
    return true;
  }
  return !(
    status.startsWith("cancelled") ||
    status === "refunded" ||
    status === "voided"
  );
}

export function memberOrderSource(order: Pick<MemberOrderDisplay, "source">): MemberOrderSource {
  return order.source === "shopify" ? "shopify" : "legacy";
}

function groupShopifyItems(
  items: ShopifyOrderItemHistoryRow[],
): Map<string, ShopifyOrderItemHistoryRow[]> {
  const grouped = new Map<string, ShopifyOrderItemHistoryRow[]>();
  for (const item of items) {
    const bucket = grouped.get(item.shopify_order_id) ?? [];
    bucket.push(item);
    grouped.set(item.shopify_order_id, bucket);
  }
  return grouped;
}

export async function getShopifyOrdersForEmails(
  emails: Array<string | null | undefined>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<MemberOrderDisplay[]> {
  const keys = collectEmailLookupKeys(emails);
  if (keys.length === 0) {
    return [];
  }

  const orders = await queryFn<ShopifyOrderHistoryRow>(SHOPIFY_ORDERS_BY_EMAILS_SQL, [keys]);
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.shopify_order_id);
  const items = await queryFn<ShopifyOrderItemHistoryRow>(SHOPIFY_ORDER_ITEMS_BY_ORDER_IDS_SQL, [
    orderIds,
  ]);
  const itemsByOrder = groupShopifyItems(items);

  return orders.map((order) =>
    buildShopifyOrderDisplay(order, itemsByOrder.get(order.shopify_order_id) ?? []),
  );
}

export async function getShopifyOrderCountForEmails(
  emails: Array<string | null | undefined>,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const keys = collectEmailLookupKeys(emails);
  if (keys.length === 0) {
    return 0;
  }
  const rows = await queryFn<{ order_count: string }>(SHOPIFY_ORDER_COUNT_BY_EMAILS_SQL, [keys]);
  const count = Number.parseInt(rows[0]?.order_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getMemberShopifyOrders(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
  extraEmails: Array<string | null | undefined> = [],
): Promise<MemberOrderDisplay[]> {
  const member = await getLegacyMemberById(memberid, queryFn);
  return getShopifyOrdersForEmails([member?.email, ...extraEmails], queryFn);
}

export { normalizeCustomerEmail };
