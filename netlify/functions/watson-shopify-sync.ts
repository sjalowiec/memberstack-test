/**
 * Scheduled Shopify ? Watson order sync.
 *
 * Requires Netlify env:
 *   WATSON_DATABASE_URL
 *   SHOPIFY_STORE_DOMAIN
 *   SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET  (Dev Dashboard)
 *     OR SHOPIFY_ADMIN_ACCESS_TOKEN             (legacy static token)
 * Optional:
 *   SHOPIFY_API_VERSION
 *   WATSON_SHOPIFY_SYNC_SECRET  (if set, POST/GET must send header X-Watson-Sync-Secret)
 *
 * Schedule is configured in netlify.toml. Manual sync remains available at
 * POST /api/watson/shopify/sync (Watson session required).
 */
import { syncShopifyOrders } from "../../src/lib/watson/shopifyOrdersSync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function authorize(req: Request): boolean {
  const expected = (process.env.WATSON_SHOPIFY_SYNC_SECRET ?? "").trim();
  if (!expected) {
    // Netlify cron invocations are not end-user facing; allow when secret unset
    // so scheduled sync can run after env credentials are configured.
    return true;
  }
  const provided = (req.headers.get("x-watson-sync-secret") ?? "").trim();
  return provided === expected;
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }
  if (!authorize(req)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await syncShopifyOrders({ triggerSource: "scheduled" });
    return json(
      {
        ok: result.ok,
        result,
        error: result.errorMessage,
      },
      result.ok ? 200 : 502,
    );
  } catch (error) {
    console.error("watson-shopify-sync failed:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Shopify sync failed.",
      },
      500,
    );
  }
};
