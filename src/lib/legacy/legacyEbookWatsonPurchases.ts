/**
 * Read-only Watson lookup for paid legacy ebook purchases.
 *
 * Used by My Downloads to recover purchases that landed after
 * `legacy-ebook-purchases.csv` (last StoreTransactionID 29741). SELECT only —
 * never updates member IDs, paid flags, or any Watson row.
 *
 * Two lookup keys, both server-only:
 * 1. Billing email matching the authenticated Memberstack email.
 * 2. Trusted unique `memberid_fk` from a verified JWT → legacy link.
 *    Billing email is not required on the member-ID path.
 *
 * Default: enabled on DEV/local/kin-dev, disabled on production until
 * LEGACY_EBOOK_WATSON_LOOKUP=true is set for a reviewed production deploy.
 */
import { isKinDevMemberstackRuntime } from "../../../netlify/functions/lib/memberstack-admin.js";
import { isMemberstackMemberId } from "../watson/customerIdentifier";
import { queryWatson } from "../watson/db";
import { type WatsonQueryFn } from "../watson/memberSearch";
import {
  isLegacyEbookItemApproved,
  listApprovedLegacyEbookItemIds,
  normalizeLegacyPurchaseEmail,
} from "./legacyEbookEntitlements";
import { type LegacyEbookPurchaseRow } from "./legacyEbookPurchases";

export const LEGACY_EBOOK_WATSON_LOOKUP_ENV = "LEGACY_EBOOK_WATSON_LOOKUP";

export type WatsonEbookPurchaseRow = {
  storetransactionid: string | number;
  purchasedate: Date | string | null;
  billing_email: string | null;
  billing_firstname: string | null;
  billing_lastname: string | null;
  paid: number | string | null;
  itemid: number | string | null;
  itemname: string | null;
  priceperitem: string | number | null;
  totalprice: string | number | null;
};

export const LEGACY_EBOOK_WATSON_PURCHASES_SQL = `
  SELECT
    t.storetransactionid,
    t.purchasedate,
    t.billing_email,
    t.billing_firstname,
    t.billing_lastname,
    t.paid,
    i.itemid,
    i.itemname,
    i.priceperitem,
    i.totalprice
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  WHERE t.paid = 1
    AND i.itemid = ANY($1::int[])
    AND LOWER(TRIM(t.billing_email)) = ANY($2::text[])
`;

/**
 * Paid approved ebook items owned by a trusted legacy member ID.
 * Billing email is intentionally not required (bonus rows are often blank).
 */
export const LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL = `
  SELECT
    t.storetransactionid,
    t.purchasedate,
    t.billing_email,
    t.billing_firstname,
    t.billing_lastname,
    t.paid,
    i.itemid,
    i.itemname,
    i.priceperitem,
    i.totalprice
  FROM legacy_store_transactions t
  JOIN legacy_store_transaction_items i
    ON i.storetransactionid = t.storetransactionid
  WHERE t.paid = 1
    AND i.itemid = ANY($1::int[])
    AND t.memberid_fk = $2
`;

/** Gmail and Googlemail are the same mailbox; include both for matching only. */
export function legacyEbookEmailLookupKeys(
  email: string | null | undefined,
): string[] {
  const normalized = normalizeLegacyPurchaseEmail(email);
  if (!normalized) return [];

  const separator = normalized.lastIndexOf("@");
  if (separator <= 0 || separator === normalized.length - 1) {
    return [normalized];
  }

  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  if (domain === "gmail.com") {
    return [normalized, `${local}@googlemail.com`];
  }
  if (domain === "googlemail.com") {
    return [normalized, `${local}@gmail.com`];
  }
  return [normalized];
}

function envFlag(env: NodeJS.ProcessEnv): "on" | "off" | "unset" {
  const value = String(env[LEGACY_EBOOK_WATSON_LOOKUP_ENV] ?? "")
    .trim()
    .toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return "on";
  if (value === "false" || value === "0" || value === "no") return "off";
  return "unset";
}

function isProductionCustomerRuntime(env: NodeJS.ProcessEnv): boolean {
  if (isKinDevMemberstackRuntime(env)) return false;
  const context = String(env.CONTEXT ?? "")
    .trim()
    .toLowerCase();
  if (context) return context === "production";
  return false;
}

/**
 * Watson ebook lookup is opt-in on production. DEV, kin-dev, branch deploys,
 * and local (no CONTEXT) read Watson when WATSON_DATABASE_URL is set.
 */
export function shouldReadLegacyEbooksFromWatson(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!String(env.WATSON_DATABASE_URL ?? "").trim()) return false;
  const flag = envFlag(env);
  if (flag === "off") return false;
  if (flag === "on") return true;
  return !isProductionCustomerRuntime(env);
}

export function isLegacyStoreTransactionPaid(paid: unknown): boolean {
  if (paid === 1 || paid === true) return true;
  return String(paid ?? "").trim() === "1";
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function watsonEbookRowToPurchase(
  row: WatsonEbookPurchaseRow,
  options?: { ownerEmail?: string | null },
): LegacyEbookPurchaseRow | null {
  if (!isLegacyStoreTransactionPaid(row.paid)) return null;
  const ownerEmail = normalizeLegacyPurchaseEmail(options?.ownerEmail);
  const billingEmail = normalizeLegacyPurchaseEmail(row.billing_email);
  const email = ownerEmail ?? billingEmail;
  if (!email) return null;
  const itemId = asText(row.itemid).trim();
  if (!itemId || !isLegacyEbookItemApproved(itemId)) return null;

  return {
    storeTransactionId: asText(row.storetransactionid).trim(),
    purchaseDate: asText(row.purchasedate),
    billingEmail: email,
    billingFirstName: asText(row.billing_firstname),
    billingLastName: asText(row.billing_lastname),
    paid: "1",
    legacyItemId: itemId,
    itemName: asText(row.itemname),
    pricePerItem: asText(row.priceperitem),
    totalPrice: asText(row.totalprice),
    downloadFile: null,
    thumbnail: null,
    active: null,
    subscriberFree: null,
  };
}

/** Reject emails and Memberstack IDs so a browser-shaped value cannot be used as memberid_fk. */
export function normalizeTrustedLegacyMemberid(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;
  if (trimmed.toLowerCase().startsWith("mem_")) return null;
  if (isMemberstackMemberId(trimmed)) return null;
  return trimmed;
}

export async function loadLegacyEbookPurchasesFromWatson(
  email: string | null | undefined,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyEbookPurchaseRow[]> {
  const emailKeys = legacyEbookEmailLookupKeys(email);
  const itemIds = listApprovedLegacyEbookItemIds();
  if (emailKeys.length === 0 || itemIds.length === 0) return [];

  const rows = await queryFn<WatsonEbookPurchaseRow>(LEGACY_EBOOK_WATSON_PURCHASES_SQL, [
    itemIds,
    emailKeys,
  ]);

  const purchases: LegacyEbookPurchaseRow[] = [];
  for (const row of rows) {
    const mapped = watsonEbookRowToPurchase(row);
    if (mapped) purchases.push(mapped);
  }
  return purchases;
}

export async function loadLegacyEbookPurchasesFromWatsonByMemberid(
  memberid: string | null | undefined,
  ownerEmail: string | null | undefined,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyEbookPurchaseRow[]> {
  const trustedMemberid = normalizeTrustedLegacyMemberid(memberid);
  const email = normalizeLegacyPurchaseEmail(ownerEmail);
  const itemIds = listApprovedLegacyEbookItemIds();
  if (!trustedMemberid || !email || itemIds.length === 0) return [];

  const rows = await queryFn<WatsonEbookPurchaseRow>(
    LEGACY_EBOOK_WATSON_PURCHASES_BY_MEMBERID_SQL,
    [itemIds, trustedMemberid],
  );

  const purchases: LegacyEbookPurchaseRow[] = [];
  for (const row of rows) {
    const mapped = watsonEbookRowToPurchase(row, { ownerEmail: email });
    if (mapped) purchases.push(mapped);
  }
  return purchases;
}
