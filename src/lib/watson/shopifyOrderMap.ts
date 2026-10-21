import {
  mapShopifyFulfillmentTracking,
  type OrderTrackingLink,
  type ShopifyFulfillmentTrackingSource,
} from "./orderTrackingLinks";
import {
  classifyShopifyOrder,
  type ShopifySiteBrand,
} from "./shopifyOrderClassify";

export interface ShopifyRestMoneySet {
  shop_money?: { amount?: string; currency_code?: string };
}

export interface ShopifyRestLineItem {
  id?: number | string;
  title?: string;
  quantity?: number;
  sku?: string | null;
  variant_title?: string | null;
  vendor?: string | null;
  product_id?: number | string | null;
  price?: string | null;
  /** Not always present on REST line items; filled when available. */
  product_handle?: string | null;
}

export interface ShopifyRestCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ShopifyRestOrder {
  id?: number | string;
  admin_graphql_api_id?: string | null;
  name?: string | null;
  order_number?: number | string | null;
  email?: string | null;
  /** Checkout contact email. Guest orders often have this when `email` is blank. */
  contact_email?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  currency?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  tags?: string | null;
  subtotal_price?: string | null;
  total_discounts?: string | null;
  total_tax?: string | null;
  total_shipping_price_set?: ShopifyRestMoneySet | null;
  total_price?: string | null;
  total_refunded?: string | null;
  customer?: ShopifyRestCustomer | null;
  line_items?: ShopifyRestLineItem[] | null;
  billing_address?: { first_name?: string | null; last_name?: string | null } | null;
  /**
   * Tracking only. Do not read destination, phone, or shipping address fields
   * from fulfillments — they are not part of this type and must not be stored.
   */
  fulfillments?: ShopifyFulfillmentTrackingSource[] | null;
}

export interface MappedShopifyOrderItem {
  shopifyLineItemId: string;
  title: string;
  quantity: number;
  sku: string | null;
  variantTitle: string | null;
  vendor: string | null;
  productId: string | null;
  productHandle: string | null;
  unitPrice: number;
}

export interface MappedShopifyOrder {
  shopifyOrderId: string;
  shopifyOrderGid: string | null;
  orderNumber: string;
  orderName: string | null;
  processedAt: string | null;
  createdAtShopify: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  /** Email entered at checkout, including guest checkout. Null when Shopify omitted it. */
  checkoutEmail: string | null;
  trackingLinks: OrderTrackingLink[];
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
  tags: string | null;
  siteBrand: ShopifySiteBrand;
  isDesignaknit: boolean;
  source: "shopify";
  lineItems: MappedShopifyOrderItem[];
}

function parseMoney(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

function textOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function moneyFromSet(set: ShopifyRestMoneySet | null | undefined): number {
  return parseMoney(set?.shop_money?.amount);
}

/**
 * Guest checkout stores the address the customer typed on `contact_email` or
 * `email`. A Shopify customer record can carry a different address. Keep both
 * so Account history can match the verified account email to either one.
 */
export function resolveShopifyOrderEmails(order: {
  email?: string | null;
  contact_email?: string | null;
  customer?: { email?: string | null } | null;
}): { customerEmail: string | null; checkoutEmail: string | null } {
  const checkoutEmail = textOrNull(order.contact_email) ?? textOrNull(order.email);
  const customerRecordEmail = textOrNull(order.customer?.email);
  return {
    checkoutEmail,
    customerEmail: customerRecordEmail ?? checkoutEmail,
  };
}

/** Normalize Shopify order name/number for storage and search (#1234 ? 1234). */
export function normalizeShopifyOrderNumber(
  orderNumber: number | string | null | undefined,
  orderName: string | null | undefined,
): string {
  const fromNumber = orderNumber != null ? String(orderNumber).trim() : "";
  if (fromNumber) {
    return fromNumber.replace(/^#/, "");
  }
  const fromName = (orderName ?? "").trim().replace(/^#/, "");
  return fromName || "unknown";
}

export function mapShopifyRestOrder(order: ShopifyRestOrder): MappedShopifyOrder | null {
  if (order.id == null) {
    return null;
  }

  const shopifyOrderId = String(order.id);
  const lineItemsRaw = Array.isArray(order.line_items) ? order.line_items : [];
  const lineItems: MappedShopifyOrderItem[] = lineItemsRaw
    .filter((item) => item?.id != null)
    .map((item) => ({
      shopifyLineItemId: String(item.id),
      title: textOrNull(item.title) ?? "(untitled item)",
      quantity: Number.isFinite(item.quantity) ? Number(item.quantity) : 1,
      sku: textOrNull(item.sku),
      variantTitle: textOrNull(item.variant_title),
      vendor: textOrNull(item.vendor),
      productId: item.product_id != null ? String(item.product_id) : null,
      productHandle: textOrNull(item.product_handle),
      unitPrice: parseMoney(item.price),
    }));

  const classification = classifyShopifyOrder({
    lineItems: lineItems.map((item) => ({
      title: item.title,
      vendor: item.vendor,
      sku: item.sku,
      productHandle: item.productHandle,
    })),
    tags: order.tags,
  });

  const customerFirst =
    textOrNull(order.customer?.first_name) ??
    textOrNull(order.billing_address?.first_name);
  const customerLast =
    textOrNull(order.customer?.last_name) ??
    textOrNull(order.billing_address?.last_name);
  const emails = resolveShopifyOrderEmails(order);

  return {
    shopifyOrderId,
    shopifyOrderGid: textOrNull(order.admin_graphql_api_id),
    orderNumber: normalizeShopifyOrderNumber(order.order_number, order.name),
    orderName: textOrNull(order.name),
    processedAt: textOrNull(order.processed_at) ?? textOrNull(order.created_at),
    createdAtShopify: textOrNull(order.created_at),
    customerFirstName: customerFirst,
    customerLastName: customerLast,
    customerEmail: emails.customerEmail,
    checkoutEmail: emails.checkoutEmail,
    trackingLinks: mapShopifyFulfillmentTracking(order.fulfillments),
    currency: textOrNull(order.currency) ?? "USD",
    subtotalAmount: parseMoney(order.subtotal_price),
    totalDiscounts: parseMoney(order.total_discounts),
    totalTax: parseMoney(order.total_tax),
    totalShipping: moneyFromSet(order.total_shipping_price_set),
    totalPrice: parseMoney(order.total_price),
    totalRefunded: parseMoney(order.total_refunded),
    financialStatus: textOrNull(order.financial_status),
    fulfillmentStatus: textOrNull(order.fulfillment_status) ?? "unfulfilled",
    cancelledAt: textOrNull(order.cancelled_at),
    cancelReason: textOrNull(order.cancel_reason),
    tags: textOrNull(order.tags),
    siteBrand: classification.siteBrand,
    isDesignaknit: classification.isDesignaknit,
    source: "shopify",
    lineItems,
  };
}
