/**
 * Admin-only membership + revenue snapshot report.
 *
 * GET only, gated by {@link requireAdmin} (verified Memberstack session token, not a trusted
 * client header — see netlify/functions/lib/admin-auth.js).
 *
 * Data source: Memberstack Admin REST `listMembers`, paginated (see the "snapshot approach" in
 * docs/admin-reporting-architecture.md). This is a live point-in-time snapshot — active members by
 * plan, new members by period, and an MRR estimate — not a historical event log. There is no local
 * database of Stripe/membership events to query yet, since Stripe lives entirely inside
 * Memberstack (see the architecture doc). Plan/price identity is resolved against
 * src/config/memberships.ts, the single source of truth already used for checkout, rather than
 * trusting whatever shape Memberstack's `payment` sub-object turns out to have.
 *
 * KNOWN GAP (flagged deliberately, not guessed around): Memberstack's public docs show the
 * `planConnections[].payment` field is `null` for free connections but do not document its shape
 * for paid (Stripe-backed) connections. This code tries several plausible field names
 * (`payment.priceId`, `priceId`, `payment.plan.id`) to identify the exact price/interval for MRR.
 * Any active paid connection where none of those resolve is counted in `activeByPlan` but excluded
 * from `mrr` and instead tallied in `unresolvedPaidConnections` — so the report stays honest about
 * gaps instead of presenting a possibly-wrong dollar figure with false confidence. If
 * `unresolvedPaidConnections > 0` in practice, inspect one real paid member's `planConnections` via
 * the Memberstack dashboard or a one-off API call to learn the real field name, then extend
 * `paidConnectionPriceId()` in src/lib/membership/membershipSummary.ts.
 */
import { requireAdmin } from "./lib/admin-auth.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import {
  computeMembershipSummary,
  fetchAllMembers,
} from "../../src/lib/membership/membershipSummary";

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  const client = getMemberstackAdminClient({
    secretKey: process.env.MEMBERSTACK_SECRET_KEY,
  });
  if (!client) {
    return withCors(jsonResponse({ ok: false, error: "Admin API is not configured." }, 500));
  }

  try {
    const { members, truncated } = await fetchAllMembers(client);
    const summary = computeMembershipSummary(members, { truncated });

    return withCors(
      jsonResponse({
        ok: true,
        generatedAt: summary.generatedAt,
        totalMembersScanned: summary.totalMembersScanned,
        scanTruncated: summary.scanTruncated,
        activeMembersTotal: summary.activeMembersTotal,
        activeByPlan: summary.activeByPlan,
        newMembers: summary.newMembers,
        canceledConnectionsTotal: summary.canceledConnectionsTotal,
        canceledConnectionsThisMonth: summary.canceledConnectionsThisMonth,
        revenue: summary.revenue,
      }),
    );
  } catch (err) {
    console.error("admin-membership-report failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to load membership report." }, 500));
  }
};
