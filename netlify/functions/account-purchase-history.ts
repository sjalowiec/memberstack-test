/**
 * Customer-facing shop purchase history for the Account page.
 *
 * GET /.netlify/functions/account-purchase-history
 *
 * Auth: requireMember (Bearer Memberstack JWT). Email is taken only from the
 * verified session. Query and body email, member id, and order id are ignored.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { loadAccountPurchaseHistory } from "../../src/lib/account/accountPurchaseHistory";

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  // Intentionally ignore any client-supplied email, member id, or order id.
  const email = auth.member.email;

  try {
    const history = await loadAccountPurchaseHistory(email);
    return withCors(
      jsonResponse({
        ok: true,
        ...history,
      }),
    );
  } catch (err) {
    console.error("account-purchase-history failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Purchase history is unavailable right now." }, 500),
    );
  }
};
