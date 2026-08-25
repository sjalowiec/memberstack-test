/**
 * Apply a verified Stripe Checkout Session event to paid-download entitlements.
 */

import { normalizeLegacyPurchaseEmail } from "../legacy/legacyEbookEntitlements";
import {
  grantPaidDownloadEntitlement,
  type GrantPaidDownloadResult,
} from "./paidDownloadEntitlements";
import {
  checkoutSessionCustomerEmail,
  isCheckoutSessionPaid,
  matchPaidDownloadCatalogEntry,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
  stripePaymentLinkIdFromSession,
  type StripeCheckoutSessionLike,
} from "./stripeCheckoutSession";
import { verifyStripeWebhookSignature } from "./stripeWebhookSignature";

export const STRIPE_PAID_DOWNLOAD_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export type ProcessStripePaidDownloadEventInput = {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string | null;
  nowSeconds?: number;
  grant?: typeof grantPaidDownloadEntitlement;
};

export type ProcessStripePaidDownloadEventResult =
  | { ok: false; status: 400 | 500; error: string }
  | {
      ok: true;
      status: 200;
      handled: boolean;
      granted: boolean;
      created: boolean;
      reason?: string;
      slug?: string;
      email?: string;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseStripeEvent(rawBody: string): {
  type: string;
  session: StripeCheckoutSessionLike | null;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const event = asRecord(parsed);
  if (!event) return null;
  const type = typeof event.type === "string" ? event.type : "";
  if (!type) return null;
  const data = asRecord(event.data);
  const session = asRecord(data?.object) as StripeCheckoutSessionLike | null;
  return { type, session };
}

export async function processStripePaidDownloadEvent(
  input: ProcessStripePaidDownloadEventInput,
): Promise<ProcessStripePaidDownloadEventResult> {
  const secret = input.secret?.trim() || null;
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: "Stripe webhook is not configured.",
    };
  }

  const valid = verifyStripeWebhookSignature(
    input.rawBody,
    input.signatureHeader,
    secret,
    input.nowSeconds ?? Math.floor(Date.now() / 1000),
  );
  if (!valid) {
    return { ok: false, status: 400, error: "Invalid Stripe signature." };
  }

  const event = parseStripeEvent(input.rawBody);
  if (!event) {
    return { ok: false, status: 400, error: "Invalid Stripe event payload." };
  }

  if (!STRIPE_PAID_DOWNLOAD_EVENT_TYPES.has(event.type)) {
    return {
      ok: true,
      status: 200,
      handled: false,
      granted: false,
      created: false,
      reason: "ignored_event",
    };
  }

  const session = event.session;
  if (!session) {
    return { ok: false, status: 400, error: "Invalid Checkout Session payload." };
  }

  if (!isCheckoutSessionPaid(session)) {
    return {
      ok: true,
      status: 200,
      handled: true,
      granted: false,
      created: false,
      reason: "unpaid",
    };
  }

  const entry = matchPaidDownloadCatalogEntry(session);
  if (!entry) {
    return {
      ok: true,
      status: 200,
      handled: true,
      granted: false,
      created: false,
      reason: "unrelated_product",
    };
  }

  const email = normalizeLegacyPurchaseEmail(checkoutSessionCustomerEmail(session));
  if (!email) {
    return {
      ok: true,
      status: 200,
      handled: true,
      granted: false,
      created: false,
      reason: "missing_email",
    };
  }

  const stripeSessionId = stripeCheckoutSessionId(session);
  if (!stripeSessionId) {
    return { ok: false, status: 400, error: "Checkout Session is missing an id." };
  }

  const grant = input.grant ?? grantPaidDownloadEntitlement;
  let grantResult: GrantPaidDownloadResult;
  try {
    grantResult = await grant({
      email,
      entry,
      stripeSessionId,
      stripePaymentIntentId: stripePaymentIntentId(session),
      stripePaymentLinkId: stripePaymentLinkIdFromSession(session),
    });
  } catch (err) {
    console.error("stripe-download-webhook: entitlement write failed", err);
    return {
      ok: false,
      status: 500,
      error: "Failed to record download entitlement.",
    };
  }

  if (!grantResult.ok) {
    return {
      ok: true,
      status: 200,
      handled: true,
      granted: false,
      created: false,
      reason: grantResult.reason,
    };
  }

  return {
    ok: true,
    status: 200,
    handled: true,
    granted: true,
    created: grantResult.created,
    slug: entry.slug,
    email: grantResult.email,
  };
}
