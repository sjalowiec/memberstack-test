/**
 * Customer-facing membership detail for the Account page "Membership" section.
 *
 * GET /.netlify/functions/account-membership-detail
 *
 * Auth: requireMember (Bearer Memberstack JWT). Member id is taken only from the
 * verified token - query/body member id or email are ignored.
 *
 * Returns a display-only summary (name/status/renewal/member-since/legacy access)
 * plus a customer-safe, chronological membership history. Never returns internal
 * ids, admin notes, failed payments, or technical sync events.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { loadAccountMembershipDetail } from "../../src/lib/membership/accountMembershipDetail";

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

  // Intentionally ignore any client-supplied member id / email in query or body.
  const memberId = auth.member.id;

  try {
    const detail = await loadAccountMembershipDetail(memberId);
    return withCors(
      jsonResponse({
        ok: true,
        ...detail,
      }),
    );
  } catch (err) {
    console.error("account-membership-detail failed:", err);
    return withCors(
      jsonResponse(
        {
          ok: true,
          identified: false,
          membershipName: null,
          statusLabel: null,
          billingLabel: null,
          nextRenewalDate: null,
          activeThroughDate: null,
          legacyPaidThroughDate: null,
          memberSince: null,
          history: [],
        },
        200,
      ),
    );
  }
};
