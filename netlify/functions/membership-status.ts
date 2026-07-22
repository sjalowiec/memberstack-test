/**
 * Customer membership status summary for the public /membership page.
 *
 * GET /.netlify/functions/membership-status
 *
 * Auth: requireMember (Bearer Memberstack JWT). Member id is taken only from the
 * verified token — query/body member id or email are ignored.
 *
 * Live status: Memberstack Admin API at request time.
 * Legacy history: Watson Postgres (unique email link only) for prior-membership context.
 * Never treats legacy expiration as current Memberstack access.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { loadMembershipStatusForMemberId } from "../../src/lib/membership/membershipStatusService";

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
    const summary = await loadMembershipStatusForMemberId(memberId);
    return withCors(
      jsonResponse({
        ok: true,
        ...summary,
      }),
    );
  } catch (err) {
    console.error("membership-status failed:", err);
    return withCors(
      jsonResponse(
        {
          ok: true,
          identified: false,
          currentStatus: "unknown",
          currentPlanName: null,
          previousPlanName: null,
          activeThroughDate: null,
          legacyExpirationDate: null,
          legacyLinkState: "lookup_unavailable",
          accountType: "unknown",
          recommendedAction: "wait",
          customerFacingMessage:
            "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
        },
        200,
      ),
    );
  }
};
