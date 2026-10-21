/**
 * Customer Account purchase history.
 *
 * Identity comes from the verified Memberstack email only. Shopify orders match
 * that email or its Gmail/Googlemail alias, including guest checkout
 * (`checkout_email`). Legacy store orders are included only when that email
 * matches exactly one earlier member. Ambiguous matches are not shown.
 * Membership billing is not part of this history.
 */
import {
  DEFAULT_SHOPIFY_LOOKBACK_DAYS,
  SHOPIFY_SYNC_INTERVAL_HOURS,
} from "../watson/shopifyEnv";
import {
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "../watson/customerIdentifier";
import {
  getMemberOrders,
  type MemberOrderDisplay,
  type MemberOrderItemDisplay,
} from "../watson/memberOrders";
import { dedupeTrackingLinks, type OrderTrackingLink } from "../watson/orderTrackingLinks";
import { getShopifyOrdersForEmails } from "../watson/shopifyPurchaseHistory";
import type { WatsonQueryFn } from "../watson/memberSearch";

export interface AccountPurchaseItem {
  title: string;
  quantity: string | null;
}

export interface AccountPurchaseOrder {
  orderNumber: string;
  orderDate: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: AccountPurchaseItem[];
  trackingLinks: OrderTrackingLink[];
}

export type AccountPurchaseLegacyLink = "unique" | "ambiguous" | "none" | "no_email";

export interface AccountPurchaseHistory {
  orders: AccountPurchaseOrder[];
  syncNote: string;
  legacyNote: string | null;
  emailNote: string;
  legacyLink: AccountPurchaseLegacyLink;
}

export interface LoadAccountPurchaseHistoryDeps {
  queryFn?: WatsonQueryFn;
  resolveLegacyLink?: (
    email: string | null | undefined,
    queryFn?: WatsonQueryFn,
  ) => Promise<LegacyEmailLinkResult>;
}

const NOT_AVAILABLE = "Not available";

export function accountPurchaseSyncNote(): string {
  return `New shop orders can take up to ${SHOPIFY_SYNC_INTERVAL_HOURS} hours to appear. Shop orders older than ${DEFAULT_SHOPIFY_LOOKBACK_DAYS} days are shown only when they were already imported.`;
}

export function accountPurchaseEmailNote(): string {
  return "Guest checkout purchases appear when they use this account email. Purchases made with a different email are not listed.";
}

export function accountPurchaseLegacyNote(legacyLink: AccountPurchaseLegacyLink): string | null {
  if (legacyLink !== "ambiguous") return null;
  return "Older purchases from the previous website are not listed, because this email matches more than one earlier account.";
}

function customerItem(item: MemberOrderItemDisplay): AccountPurchaseItem | null {
  const title = (item.customerLabel || "").trim();
  if (!title) return null;
  return {
    title,
    quantity: item.quantity?.trim() || null,
  };
}

/** Public order shape. Drops staff links, internal ids, prices, and emails. */
export function toAccountPurchaseOrder(order: MemberOrderDisplay): AccountPurchaseOrder {
  return {
    orderNumber: (order.accountOrderNumber || order.transactionId || "Order").trim() || "Order",
    orderDate: order.orderDate?.trim() || null,
    paymentStatus: order.paymentStatusLabel?.trim() || NOT_AVAILABLE,
    fulfillmentStatus: order.fulfillmentStatusLabel?.trim() || NOT_AVAILABLE,
    items: order.items
      .map(customerItem)
      .filter((item): item is AccountPurchaseItem => item != null),
    trackingLinks: dedupeTrackingLinks(order.trackingLinks ?? []),
  };
}

export async function loadAccountPurchaseHistory(
  email: string | null | undefined,
  deps: LoadAccountPurchaseHistoryDeps = {},
): Promise<AccountPurchaseHistory> {
  const queryFn = deps.queryFn;
  const resolveLegacyLink = deps.resolveLegacyLink ?? resolveLegacyLinkByMemberstackEmail;
  const verifiedEmail = email?.trim() || null;

  if (!verifiedEmail) {
    return {
      orders: [],
      syncNote: accountPurchaseSyncNote(),
      legacyNote: null,
      emailNote: accountPurchaseEmailNote(),
      legacyLink: "no_email",
    };
  }

  const link = await resolveLegacyLink(verifiedEmail, queryFn);
  let sourceOrders: MemberOrderDisplay[] = [];
  let legacyLink: AccountPurchaseLegacyLink = "none";

  if (link.status === "unique" && link.member.memberid) {
    legacyLink = "unique";
    sourceOrders = await getMemberOrders(link.member.memberid, queryFn, {
      extraEmails: [verifiedEmail],
    });
  } else {
    legacyLink = link.status === "ambiguous" ? "ambiguous" : "none";
    sourceOrders = await getShopifyOrdersForEmails([verifiedEmail], queryFn);
  }

  return {
    orders: sourceOrders.map(toAccountPurchaseOrder),
    syncNote: accountPurchaseSyncNote(),
    legacyNote: accountPurchaseLegacyNote(legacyLink),
    emailNote: accountPurchaseEmailNote(),
    legacyLink,
  };
}
