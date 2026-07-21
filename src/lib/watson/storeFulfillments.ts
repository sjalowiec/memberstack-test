import { queryWatson } from "./db";
import { formatLegacyMoney, parseLegacyMoneyAmount } from "./memberOrders";
import { type WatsonQueryFn } from "./memberSearch";

export const STORE_FULFILLMENT_CARRIERS = ["UPS", "FedEx", "USPS", "Other"] as const;
export type StoreFulfillmentCarrier = (typeof STORE_FULFILLMENT_CARRIERS)[number];

export const STORE_FULFILLMENT_SUPPLIER_OPTIONS = [
  "Silver Reed",
  "Taitexma",
  "Other",
] as const;
export type StoreFulfillmentSupplierOption =
  (typeof STORE_FULFILLMENT_SUPPLIER_OPTIONS)[number];

export const STORE_FULFILLMENT_MEMBERID_MAX_LENGTH = 100;
export const STORE_FULFILLMENT_ORDER_NUMBER_MAX_LENGTH = 64;
export const STORE_FULFILLMENT_PRODUCT_MAX_LENGTH = 500;
export const STORE_FULFILLMENT_VARIANT_ID_MAX_LENGTH = 100;
export const STORE_FULFILLMENT_SUPPLIER_MAX_LENGTH = 200;
export const STORE_FULFILLMENT_CARRIER_MAX_LENGTH = 50;
export const STORE_FULFILLMENT_TRACKING_MAX_LENGTH = 100;
export const STORE_FULFILLMENT_INVOICE_MAX_LENGTH = 100;
export const STORE_FULFILLMENT_DESTINATION_STATE_MAX_LENGTH = 50;
export const STORE_FULFILLMENT_DESTINATION_POSTAL_MAX_LENGTH = 20;
export const STORE_FULFILLMENT_NOTES_MAX_LENGTH = 5_000;
export const STORE_FULFILLMENT_ID_MAX_LENGTH = 64;

export type StoreFulfillmentValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface StoreFulfillmentRow {
  id: string;
  memberid: string;
  shopify_order_id: string | null;
  shopify_order_number: string;
  product_description: string;
  product_variant_id: string | null;
  supplier: string;
  carrier: string;
  tracking_number: string | null;
  actual_shipping_cost: string | number;
  customer_shipping_charge: string | number | null;
  box_count: number;
  ship_date: Date | string;
  supplier_invoice_number: string | null;
  destination_state: string | null;
  destination_postal: string | null;
  internal_notes: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
}

export interface StoreFulfillmentShippingDifference {
  amount: number | null;
  formattedAmount: string | null;
  label: string | null;
  tone: "surplus" | "shortfall" | "match" | "unknown";
}

export interface StoreFulfillmentDisplay {
  id: string;
  memberid: string;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string;
  productDescription: string;
  productVariantId: string | null;
  supplier: string;
  carrier: string;
  trackingNumber: string | null;
  actualShippingCost: string;
  actualShippingCostValue: number;
  customerShippingCharge: string | null;
  customerShippingChargeValue: number | null;
  boxCount: number;
  shipDate: string;
  shipDateValue: string;
  shipDateSort: string;
  supplierInvoiceNumber: string | null;
  destinationState: string | null;
  destinationPostal: string | null;
  internalNotes: string | null;
  shippingDifference: StoreFulfillmentShippingDifference;
  createdAt: string;
  updatedAt: string | null;
}

export interface StoreFulfillmentWriteInput {
  memberid: string;
  shopifyOrderNumber: unknown;
  productDescription: unknown;
  productVariantId?: unknown;
  supplierOption: unknown;
  supplierOther?: unknown;
  carrier: unknown;
  trackingNumber?: unknown;
  actualShippingCost: unknown;
  customerShippingCharge?: unknown;
  boxCount?: unknown;
  shipDate: unknown;
  supplierInvoiceNumber?: unknown;
  destinationState?: unknown;
  destinationPostal?: unknown;
  internalNotes?: unknown;
  shopifyOrderId?: unknown;
}

export interface ValidatedStoreFulfillmentWrite {
  memberid: string;
  shopifyOrderId: string | null;
  shopifyOrderNumber: string;
  productDescription: string;
  productVariantId: string | null;
  supplier: string;
  carrier: StoreFulfillmentCarrier;
  trackingNumber: string | null;
  actualShippingCost: number;
  customerShippingCharge: number | null;
  boxCount: number;
  shipDate: string;
  supplierInvoiceNumber: string | null;
  destinationState: string | null;
  destinationPostal: string | null;
  internalNotes: string | null;
}

const STORE_FULFILLMENT_SELECT_COLUMNS = `
  id,
  memberid,
  shopify_order_id,
  shopify_order_number,
  product_description,
  product_variant_id,
  supplier,
  carrier,
  tracking_number,
  actual_shipping_cost,
  customer_shipping_charge,
  box_count,
  ship_date,
  supplier_invoice_number,
  destination_state,
  destination_postal,
  internal_notes,
  created_at,
  updated_at
`;

export const STORE_FULFILLMENTS_BY_MEMBER_SQL = `
  SELECT ${STORE_FULFILLMENT_SELECT_COLUMNS}
  FROM watson_store_fulfillments
  WHERE memberid = $1
  ORDER BY ship_date DESC, created_at DESC, id DESC
`;

export const STORE_FULFILLMENTS_BY_CUSTOMER_SQL = `
  SELECT ${STORE_FULFILLMENT_SELECT_COLUMNS}
  FROM watson_store_fulfillments
  WHERE memberid = $1 OR ($2::text IS NOT NULL AND memberid = $2)
  ORDER BY ship_date DESC, created_at DESC, id DESC
`;

export const STORE_FULFILLMENT_COUNT_BY_CUSTOMER_SQL = `
  SELECT COUNT(*)::text AS fulfillment_count
  FROM watson_store_fulfillments
  WHERE memberid = $1 OR ($2::text IS NOT NULL AND memberid = $2)
`;

export const STORE_FULFILLMENT_BY_ID_SQL = `
  SELECT ${STORE_FULFILLMENT_SELECT_COLUMNS}
  FROM watson_store_fulfillments
  WHERE id = $1
  LIMIT 1
`;

const DUPLICATE_TRACKING_ERROR =
  "A fulfillment with this Shopify order number and tracking number already exists.";

export function isStoreFulfillmentCarrier(
  value: string,
): value is StoreFulfillmentCarrier {
  return (STORE_FULFILLMENT_CARRIERS as readonly string[]).includes(value);
}

export function isStoreFulfillmentSupplierOption(
  value: string,
): value is StoreFulfillmentSupplierOption {
  return (STORE_FULFILLMENT_SUPPLIER_OPTIONS as readonly string[]).includes(value);
}

export function isPgUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}

export function normalizeShopifyOrderNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^#+/, "").trim();
}

export function normalizeOptionalText(
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): StoreFulfillmentValidationResult<string | null> {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${fieldLabel} must be a string.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${fieldLabel} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateStoreFulfillmentMemberid(
  value: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Member ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Member ID is required." };
  }
  if (trimmed.length > STORE_FULFILLMENT_MEMBERID_MAX_LENGTH) {
    return {
      ok: false,
      error: `Member ID must be ${STORE_FULFILLMENT_MEMBERID_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateStoreFulfillmentId(
  value: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Fulfillment ID is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Fulfillment ID is required." };
  }
  if (trimmed.length > STORE_FULFILLMENT_ID_MAX_LENGTH) {
    return { ok: false, error: "Fulfillment ID is invalid." };
  }
  return { ok: true, value: trimmed };
}

export function validateShopifyOrderNumber(
  value: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Shopify order number is required." };
  }
  const normalized = normalizeShopifyOrderNumber(value);
  if (!normalized) {
    return { ok: false, error: "Shopify order number is required." };
  }
  if (normalized.length > STORE_FULFILLMENT_ORDER_NUMBER_MAX_LENGTH) {
    return {
      ok: false,
      error: `Shopify order number must be ${STORE_FULFILLMENT_ORDER_NUMBER_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: normalized };
}

export function validateProductDescription(
  value: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Product is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "Product is required." };
  }
  if (trimmed.length > STORE_FULFILLMENT_PRODUCT_MAX_LENGTH) {
    return {
      ok: false,
      error: `Product must be ${STORE_FULFILLMENT_PRODUCT_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateSupplier(
  supplierOption: unknown,
  supplierOther?: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof supplierOption !== "string") {
    return { ok: false, error: "Supplier is required." };
  }
  const option = supplierOption.trim();
  if (!isStoreFulfillmentSupplierOption(option)) {
    return {
      ok: false,
      error: `Supplier must be one of: ${STORE_FULFILLMENT_SUPPLIER_OPTIONS.join(", ")}.`,
    };
  }
  if (option !== "Other") {
    return { ok: true, value: option };
  }

  if (typeof supplierOther !== "string") {
    return { ok: false, error: "Supplier name is required when Other is selected." };
  }
  const other = supplierOther.trim();
  if (!other) {
    return { ok: false, error: "Supplier name is required when Other is selected." };
  }
  if (other.length > STORE_FULFILLMENT_SUPPLIER_MAX_LENGTH) {
    return {
      ok: false,
      error: `Supplier name must be ${STORE_FULFILLMENT_SUPPLIER_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: other };
}

export function validateCarrier(
  value: unknown,
): StoreFulfillmentValidationResult<StoreFulfillmentCarrier> {
  if (typeof value !== "string") {
    return { ok: false, error: "Carrier is required." };
  }
  const trimmed = value.trim();
  if (!isStoreFulfillmentCarrier(trimmed)) {
    return {
      ok: false,
      error: `Carrier must be one of: ${STORE_FULFILLMENT_CARRIERS.join(", ")}.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function validateTrackingNumber(
  value: unknown,
): StoreFulfillmentValidationResult<string | null> {
  return normalizeOptionalText(
    value,
    STORE_FULFILLMENT_TRACKING_MAX_LENGTH,
    "Tracking number",
  );
}

export function validateMoneyAmount(
  value: unknown,
  fieldLabel: string,
  options: { required: boolean },
): StoreFulfillmentValidationResult<number | null> {
  if (value == null || value === "") {
    if (options.required) {
      return { ok: false, error: `${fieldLabel} is required.` };
    }
    return { ok: true, value: null };
  }

  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.trim())
        : Number.NaN;

  if (Number.isNaN(amount)) {
    return { ok: false, error: `${fieldLabel} must be a valid number.` };
  }
  if (amount < 0) {
    return { ok: false, error: `${fieldLabel} cannot be negative.` };
  }
  if (!Number.isFinite(amount)) {
    return { ok: false, error: `${fieldLabel} must be a valid number.` };
  }
  return { ok: true, value: amount };
}

export function validateBoxCount(
  value: unknown,
): StoreFulfillmentValidationResult<number> {
  if (value == null || value === "") {
    return { ok: true, value: 1 };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1) {
    return { ok: false, error: "Number of boxes must be a positive integer." };
  }
  if (parsed > 1000) {
    return { ok: false, error: "Number of boxes must be 1000 or fewer." };
  }
  return { ok: true, value: parsed };
}

export function validateShipDate(
  value: unknown,
): StoreFulfillmentValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Ship date is required." };
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "Ship date must be a valid date (YYYY-MM-DD)." };
  }
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    return { ok: false, error: "Ship date must be a valid date (YYYY-MM-DD)." };
  }
  return { ok: true, value: trimmed };
}

export function formatStoreFulfillmentTodayDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toStoreFulfillmentDateValue(
  value: Date | string | null | undefined,
): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
  }
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return value.toISOString().slice(0, 10);
}

export function formatStoreFulfillmentDateDisplay(
  value: Date | string | null | undefined,
): string {
  const iso = toStoreFulfillmentDateValue(value);
  if (!iso) {
    return "";
  }
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatStoreFulfillmentTimestamp(
  value: Date | string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calculateShippingDifference(
  customerShippingCharge: number | null,
  actualShippingCost: number,
): StoreFulfillmentShippingDifference {
  if (customerShippingCharge == null) {
    return {
      amount: null,
      formattedAmount: null,
      label: null,
      tone: "unknown",
    };
  }

  const amount = customerShippingCharge - actualShippingCost;
  const formattedAmount = formatLegacyMoney(amount) ?? "$0.00";

  if (amount > 0) {
    return {
      amount,
      formattedAmount,
      label: "Shipping collected above cost",
      tone: "surplus",
    };
  }
  if (amount < 0) {
    return {
      amount,
      formattedAmount,
      label: "Shipping shortfall",
      tone: "shortfall",
    };
  }
  return {
    amount: 0,
    formattedAmount,
    label: "Shipping matches cost",
    tone: "match",
  };
}

export function supplierOptionFromStored(supplier: string): {
  supplierOption: StoreFulfillmentSupplierOption;
  supplierOther: string;
} {
  if (supplier === "Silver Reed" || supplier === "Taitexma") {
    return { supplierOption: supplier, supplierOther: "" };
  }
  return { supplierOption: "Other", supplierOther: supplier };
}

export function validateStoreFulfillmentWriteInput(
  input: StoreFulfillmentWriteInput,
): StoreFulfillmentValidationResult<ValidatedStoreFulfillmentWrite> {
  const memberid = validateStoreFulfillmentMemberid(input.memberid);
  if (!memberid.ok) {
    return memberid;
  }

  const shopifyOrderNumber = validateShopifyOrderNumber(input.shopifyOrderNumber);
  if (!shopifyOrderNumber.ok) {
    return shopifyOrderNumber;
  }

  const productDescription = validateProductDescription(input.productDescription);
  if (!productDescription.ok) {
    return productDescription;
  }

  const productVariantId = normalizeOptionalText(
    input.productVariantId,
    STORE_FULFILLMENT_VARIANT_ID_MAX_LENGTH,
    "Product / variant ID",
  );
  if (!productVariantId.ok) {
    return productVariantId;
  }

  const supplier = validateSupplier(input.supplierOption, input.supplierOther);
  if (!supplier.ok) {
    return supplier;
  }

  const carrier = validateCarrier(input.carrier);
  if (!carrier.ok) {
    return carrier;
  }

  const trackingNumber = validateTrackingNumber(input.trackingNumber);
  if (!trackingNumber.ok) {
    return trackingNumber;
  }

  const actualShippingCost = validateMoneyAmount(input.actualShippingCost, "Actual shipping cost", {
    required: true,
  });
  if (!actualShippingCost.ok) {
    return actualShippingCost;
  }

  const customerShippingCharge = validateMoneyAmount(
    input.customerShippingCharge,
    "Customer shipping charge",
    { required: false },
  );
  if (!customerShippingCharge.ok) {
    return customerShippingCharge;
  }

  const boxCount = validateBoxCount(input.boxCount);
  if (!boxCount.ok) {
    return boxCount;
  }

  const shipDate = validateShipDate(input.shipDate);
  if (!shipDate.ok) {
    return shipDate;
  }

  const supplierInvoiceNumber = normalizeOptionalText(
    input.supplierInvoiceNumber,
    STORE_FULFILLMENT_INVOICE_MAX_LENGTH,
    "Supplier invoice number",
  );
  if (!supplierInvoiceNumber.ok) {
    return supplierInvoiceNumber;
  }

  const destinationState = normalizeOptionalText(
    input.destinationState,
    STORE_FULFILLMENT_DESTINATION_STATE_MAX_LENGTH,
    "Destination state",
  );
  if (!destinationState.ok) {
    return destinationState;
  }

  const destinationPostal = normalizeOptionalText(
    input.destinationPostal,
    STORE_FULFILLMENT_DESTINATION_POSTAL_MAX_LENGTH,
    "Destination ZIP / postal code",
  );
  if (!destinationPostal.ok) {
    return destinationPostal;
  }

  const internalNotes = normalizeOptionalText(
    input.internalNotes,
    STORE_FULFILLMENT_NOTES_MAX_LENGTH,
    "Notes",
  );
  if (!internalNotes.ok) {
    return internalNotes;
  }

  const shopifyOrderId = normalizeOptionalText(
    input.shopifyOrderId,
    STORE_FULFILLMENT_ORDER_NUMBER_MAX_LENGTH,
    "Shopify order ID",
  );
  if (!shopifyOrderId.ok) {
    return shopifyOrderId;
  }

  return {
    ok: true,
    value: {
      memberid: memberid.value,
      shopifyOrderId: shopifyOrderId.value,
      shopifyOrderNumber: shopifyOrderNumber.value,
      productDescription: productDescription.value,
      productVariantId: productVariantId.value,
      supplier: supplier.value,
      carrier: carrier.value,
      trackingNumber: trackingNumber.value,
      actualShippingCost: actualShippingCost.value as number,
      customerShippingCharge: customerShippingCharge.value,
      boxCount: boxCount.value,
      shipDate: shipDate.value,
      supplierInvoiceNumber: supplierInvoiceNumber.value,
      destinationState: destinationState.value,
      destinationPostal: destinationPostal.value,
      internalNotes: internalNotes.value,
    },
  };
}

export function buildStoreFulfillmentDisplay(row: StoreFulfillmentRow): StoreFulfillmentDisplay {
  const actualShippingCostValue = parseLegacyMoneyAmount(row.actual_shipping_cost) ?? 0;
  const customerShippingChargeValue = parseLegacyMoneyAmount(row.customer_shipping_charge);
  const shipDateValue = toStoreFulfillmentDateValue(row.ship_date);

  return {
    id: row.id,
    memberid: row.memberid,
    shopifyOrderId: row.shopify_order_id,
    shopifyOrderNumber: row.shopify_order_number,
    productDescription: row.product_description,
    productVariantId: row.product_variant_id,
    supplier: row.supplier,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    actualShippingCost: formatLegacyMoney(row.actual_shipping_cost) ?? "$0.00",
    actualShippingCostValue,
    customerShippingCharge: formatLegacyMoney(row.customer_shipping_charge),
    customerShippingChargeValue,
    boxCount: Number(row.box_count) || 1,
    shipDate: formatStoreFulfillmentDateDisplay(row.ship_date),
    shipDateValue,
    shipDateSort: shipDateValue,
    supplierInvoiceNumber: row.supplier_invoice_number,
    destinationState: row.destination_state,
    destinationPostal: row.destination_postal,
    internalNotes: row.internal_notes,
    shippingDifference: calculateShippingDifference(
      customerShippingChargeValue,
      actualShippingCostValue,
    ),
    createdAt: formatStoreFulfillmentTimestamp(row.created_at) ?? "",
    updatedAt: formatStoreFulfillmentTimestamp(row.updated_at),
  };
}

export async function getMemberStoreFulfillments(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentDisplay[]> {
  const validated = validateStoreFulfillmentMemberid(memberid);
  if (!validated.ok) {
    return [];
  }
  const rows = await queryFn<StoreFulfillmentRow>(STORE_FULFILLMENTS_BY_MEMBER_SQL, [
    validated.value,
  ]);
  return rows.map(buildStoreFulfillmentDisplay);
}

export async function getCustomerStoreFulfillments(
  memberstackId: string,
  legacyMemberId?: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentDisplay[]> {
  const validatedMemberstackId = validateStoreFulfillmentMemberid(memberstackId);
  if (!validatedMemberstackId.ok) {
    return [];
  }

  const legacyId =
    legacyMemberId && legacyMemberId !== validatedMemberstackId.value
      ? validateStoreFulfillmentMemberid(legacyMemberId)
      : null;
  const legacyValue = legacyId?.ok ? legacyId.value : null;

  const rows = await queryFn<StoreFulfillmentRow>(STORE_FULFILLMENTS_BY_CUSTOMER_SQL, [
    validatedMemberstackId.value,
    legacyValue,
  ]);
  return rows.map(buildStoreFulfillmentDisplay);
}

export async function getCustomerStoreFulfillmentCount(
  memberstackId: string,
  legacyMemberId?: string | null,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<number> {
  const validatedMemberstackId = validateStoreFulfillmentMemberid(memberstackId);
  if (!validatedMemberstackId.ok) {
    return 0;
  }

  const legacyId =
    legacyMemberId && legacyMemberId !== validatedMemberstackId.value
      ? validateStoreFulfillmentMemberid(legacyMemberId)
      : null;
  const legacyValue = legacyId?.ok ? legacyId.value : null;

  const rows = await queryFn<{ fulfillment_count: string }>(
    STORE_FULFILLMENT_COUNT_BY_CUSTOMER_SQL,
    [validatedMemberstackId.value, legacyValue],
  );
  const count = Number.parseInt(rows[0]?.fulfillment_count ?? "0", 10);
  return Number.isNaN(count) ? 0 : count;
}

export async function getStoreFulfillmentById(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentDisplay | null> {
  const validated = validateStoreFulfillmentId(id);
  if (!validated.ok) {
    return null;
  }
  const rows = await queryFn<StoreFulfillmentRow>(STORE_FULFILLMENT_BY_ID_SQL, [
    validated.value,
  ]);
  const row = rows[0];
  return row ? buildStoreFulfillmentDisplay(row) : null;
}

export async function createStoreFulfillment(
  input: StoreFulfillmentWriteInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentValidationResult<StoreFulfillmentDisplay>> {
  const validated = validateStoreFulfillmentWriteInput(input);
  if (!validated.ok) {
    return validated;
  }
  const value = validated.value;

  try {
    const rows = await queryFn<StoreFulfillmentRow>(
      `
        INSERT INTO watson_store_fulfillments (
          memberid,
          shopify_order_id,
          shopify_order_number,
          product_description,
          product_variant_id,
          supplier,
          carrier,
          tracking_number,
          actual_shipping_cost,
          customer_shipping_charge,
          box_count,
          ship_date,
          supplier_invoice_number,
          destination_state,
          destination_postal,
          internal_notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12::date, $13, $14, $15, $16
        )
        RETURNING ${STORE_FULFILLMENT_SELECT_COLUMNS}
      `,
      [
        value.memberid,
        value.shopifyOrderId,
        value.shopifyOrderNumber,
        value.productDescription,
        value.productVariantId,
        value.supplier,
        value.carrier,
        value.trackingNumber,
        value.actualShippingCost,
        value.customerShippingCharge,
        value.boxCount,
        value.shipDate,
        value.supplierInvoiceNumber,
        value.destinationState,
        value.destinationPostal,
        value.internalNotes,
      ],
    );

    const row = rows[0];
    if (!row) {
      return { ok: false, error: "Unable to create fulfillment record." };
    }
    return { ok: true, value: buildStoreFulfillmentDisplay(row) };
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_TRACKING_ERROR };
    }
    throw error;
  }
}

export interface UpdateStoreFulfillmentInput extends StoreFulfillmentWriteInput {
  id: string;
}

export async function updateStoreFulfillment(
  input: UpdateStoreFulfillmentInput,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentValidationResult<StoreFulfillmentDisplay>> {
  const id = validateStoreFulfillmentId(input.id);
  if (!id.ok) {
    return id;
  }

  const existing = await getStoreFulfillmentById(id.value, queryFn);
  if (!existing) {
    return { ok: false, error: "Fulfillment record not found." };
  }

  const validated = validateStoreFulfillmentWriteInput({
    ...input,
    memberid: existing.memberid,
    shopifyOrderId: input.shopifyOrderId ?? existing.shopifyOrderId,
  });
  if (!validated.ok) {
    return validated;
  }
  const value = validated.value;

  try {
    const rows = await queryFn<StoreFulfillmentRow>(
      `
        UPDATE watson_store_fulfillments
        SET
          shopify_order_id = $2,
          shopify_order_number = $3,
          product_description = $4,
          product_variant_id = $5,
          supplier = $6,
          carrier = $7,
          tracking_number = $8,
          actual_shipping_cost = $9,
          customer_shipping_charge = $10,
          box_count = $11,
          ship_date = $12::date,
          supplier_invoice_number = $13,
          destination_state = $14,
          destination_postal = $15,
          internal_notes = $16,
          updated_at = NOW()
        WHERE id = $1
        RETURNING ${STORE_FULFILLMENT_SELECT_COLUMNS}
      `,
      [
        id.value,
        value.shopifyOrderId,
        value.shopifyOrderNumber,
        value.productDescription,
        value.productVariantId,
        value.supplier,
        value.carrier,
        value.trackingNumber,
        value.actualShippingCost,
        value.customerShippingCharge,
        value.boxCount,
        value.shipDate,
        value.supplierInvoiceNumber,
        value.destinationState,
        value.destinationPostal,
        value.internalNotes,
      ],
    );

    const row = rows[0];
    if (!row) {
      return { ok: false, error: "Fulfillment record not found." };
    }
    return { ok: true, value: buildStoreFulfillmentDisplay(row) };
  } catch (error) {
    if (isPgUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_TRACKING_ERROR };
    }
    throw error;
  }
}

export async function deleteStoreFulfillment(
  id: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<StoreFulfillmentValidationResult<{ id: string }>> {
  const validated = validateStoreFulfillmentId(id);
  if (!validated.ok) {
    return validated;
  }

  const rows = await queryFn<{ id: string }>(
    `
      DELETE FROM watson_store_fulfillments
      WHERE id = $1
      RETURNING id
    `,
    [validated.value],
  );

  if (!rows[0]) {
    return { ok: false, error: "Fulfillment record not found." };
  }
  return { ok: true, value: { id: rows[0].id } };
}
