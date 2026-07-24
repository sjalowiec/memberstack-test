import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";

export const DAK_LICENSE_STATUSES = ["pending", "assigned", "delivered"] as const;
export type DakLicenseStatus = (typeof DAK_LICENSE_STATUSES)[number];

export interface DakLicenseRecord {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string;
  customerEmail: string | null;
  customerName: string | null;
  productTitle: string | null;
  licenseNumber: string | null;
  licenseAssignedDate: string | null;
  fulfillmentStatus: DakLicenseStatus;
  internalNotes: string | null;
  memberid: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface UpsertDakLicenseInput {
  shopifyOrderId: string;
  licenseNumber?: unknown;
  licenseAssignedDate?: unknown;
  fulfillmentStatus?: unknown;
  internalNotes?: unknown;
  memberid?: unknown;
}

function textOrNull(value: unknown, max = 500): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function isLicenseStatus(value: string): value is DakLicenseStatus {
  return (DAK_LICENSE_STATUSES as readonly string[]).includes(value);
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function mapRow(row: {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  customer_email: string | null;
  customer_name: string | null;
  product_title: string | null;
  license_number: string | null;
  license_assigned_date: Date | string | null;
  fulfillment_status: string;
  internal_notes: string | null;
  memberid: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
}): DakLicenseRecord {
  return {
    id: row.id,
    shopifyOrderId: row.shopify_order_id,
    shopifyOrderNumber: row.shopify_order_number,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    productTitle: row.product_title,
    licenseNumber: row.license_number,
    licenseAssignedDate: toIsoDate(row.license_assigned_date),
    fulfillmentStatus: isLicenseStatus(row.fulfillment_status)
      ? row.fulfillment_status
      : "pending",
    internalNotes: row.internal_notes,
    memberid: row.memberid,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export async function getDakLicenseByOrderId(
  shopifyOrderId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<DakLicenseRecord | null> {
  const rows = await queryFn<{
    id: string;
    shopify_order_id: string;
    shopify_order_number: string;
    customer_email: string | null;
    customer_name: string | null;
    product_title: string | null;
    license_number: string | null;
    license_assigned_date: Date | string | null;
    fulfillment_status: string;
    internal_notes: string | null;
    memberid: string | null;
    created_at: Date | string;
    updated_at: Date | string | null;
  }>(
    `
    SELECT *
    FROM watson_dak_licenses
    WHERE shopify_order_id = $1
    LIMIT 1
    `,
    [shopifyOrderId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertDakLicense(
  input: UpsertDakLicenseInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<{ ok: true; value: DakLicenseRecord } | { ok: false; error: string }> {
  const shopifyOrderId = textOrNull(input.shopifyOrderId, 100);
  if (!shopifyOrderId) {
    return { ok: false, error: "Shopify order ID is required." };
  }

  const orders = await queryFn<{
    shopify_order_id: string;
    order_number: string;
    customer_email: string | null;
    customer_first_name: string | null;
    customer_last_name: string | null;
    is_designaknit: boolean;
  }>(
    `
    SELECT
      shopify_order_id,
      order_number,
      customer_email,
      customer_first_name,
      customer_last_name,
      is_designaknit
    FROM watson_shopify_orders
    WHERE shopify_order_id = $1
    LIMIT 1
    `,
    [shopifyOrderId],
  );
  const order = orders[0];
  if (!order) {
    return { ok: false, error: "Shopify order not found. Sync orders first." };
  }
  if (!order.is_designaknit) {
    return {
      ok: false,
      error: "License records are only available for DesignaKnit orders.",
    };
  }

  const licenseNumber = textOrNull(input.licenseNumber, 200);
  let licenseAssignedDate = textOrNull(input.licenseAssignedDate, 32);
  if (licenseAssignedDate && !/^\d{4}-\d{2}-\d{2}$/.test(licenseAssignedDate)) {
    return { ok: false, error: "License assigned date must be YYYY-MM-DD." };
  }

  let fulfillmentStatus: DakLicenseStatus = "pending";
  const statusRaw = textOrNull(input.fulfillmentStatus, 40);
  if (statusRaw) {
    if (!isLicenseStatus(statusRaw)) {
      return {
        ok: false,
        error: `Fulfillment status must be one of: ${DAK_LICENSE_STATUSES.join(", ")}.`,
      };
    }
    fulfillmentStatus = statusRaw;
  } else if (licenseNumber) {
    fulfillmentStatus = "assigned";
  }

  if (licenseNumber && !licenseAssignedDate) {
    licenseAssignedDate = new Date().toISOString().slice(0, 10);
  }

  const internalNotes = textOrNull(input.internalNotes, 5000);
  const memberid = textOrNull(input.memberid, 100);

  const productRows = await queryFn<{ title: string }>(
    `
    SELECT title
    FROM watson_shopify_order_items
    WHERE shopify_order_id = $1
    ORDER BY title
    LIMIT 5
    `,
    [shopifyOrderId],
  );
  const productTitle =
    productRows.map((row) => row.title).join("; ").slice(0, 500) || null;
  const customerName = [order.customer_first_name, order.customer_last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || null;

  const rows = await queryFn<{
    id: string;
    shopify_order_id: string;
    shopify_order_number: string;
    customer_email: string | null;
    customer_name: string | null;
    product_title: string | null;
    license_number: string | null;
    license_assigned_date: Date | string | null;
    fulfillment_status: string;
    internal_notes: string | null;
    memberid: string | null;
    created_at: Date | string;
    updated_at: Date | string | null;
  }>(
    `
    INSERT INTO watson_dak_licenses (
      shopify_order_id,
      shopify_order_number,
      customer_email,
      customer_name,
      product_title,
      license_number,
      license_assigned_date,
      fulfillment_status,
      internal_notes,
      memberid,
      updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10,NOW()
    )
    ON CONFLICT (shopify_order_id) DO UPDATE SET
      shopify_order_number = EXCLUDED.shopify_order_number,
      customer_email = EXCLUDED.customer_email,
      customer_name = EXCLUDED.customer_name,
      product_title = EXCLUDED.product_title,
      license_number = EXCLUDED.license_number,
      license_assigned_date = EXCLUDED.license_assigned_date,
      fulfillment_status = EXCLUDED.fulfillment_status,
      internal_notes = EXCLUDED.internal_notes,
      memberid = COALESCE(EXCLUDED.memberid, watson_dak_licenses.memberid),
      updated_at = NOW()
    RETURNING *
    `,
    [
      shopifyOrderId,
      order.order_number,
      order.customer_email,
      customerName,
      productTitle,
      licenseNumber,
      licenseAssignedDate,
      fulfillmentStatus,
      internalNotes,
      memberid,
    ],
  );

  const saved = rows[0];
  if (!saved) {
    return { ok: false, error: "Unable to save license record." };
  }
  return { ok: true, value: mapRow(saved) };
}
