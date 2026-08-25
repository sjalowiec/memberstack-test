/**
 * Stripe webhook for paid-download entitlements (Charting Rulers in phase 1).
 *
 * POST /.netlify/functions/stripe-download-webhook
 *
 * Verifies Stripe-Signature with STRIPE_WEBHOOK_SECRET. Grants ownership only
 * for paid Checkout Sessions that match a catalog Stripe ID. Does not grant
 * from thank-you pages.
 */
import {
  processStripePaidDownloadEvent,
} from "../../src/lib/downloads/processStripePaidDownloadEvent";
import { readStripeWebhookSecret } from "../../src/lib/downloads/stripeWebhookSignature";

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  const rawBody = await req.text();
  const result = await processStripePaidDownloadEvent({
    rawBody,
    signatureHeader: req.headers.get("stripe-signature"),
    secret: readStripeWebhookSecret(),
  });

  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, result.status);
  }

  return jsonResponse(
    {
      ok: true,
      handled: result.handled,
      granted: result.granted,
      created: result.created,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.slug ? { slug: result.slug } : {}),
    },
    result.status,
  );
};
