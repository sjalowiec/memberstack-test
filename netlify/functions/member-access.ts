/**
 * Canonical membership access for a verified Memberstack member.
 *
 * GET /.netlify/functions/member-access
 *
 * Auth: requireMember (Bearer JWT). Combines Admin plan connections with Watson
 * paid-through for logged-in members without an active paid plan. Paid members
 * skip Watson. The free Memberstack legacy plan is not required.
 */
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../src/lib/memberAccessServer";
import { getViewerAccessState } from "../../src/lib/memberAccess";

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

  const client = getMemberstackAdminClient();
  if (!client?.getMember) {
    return withCors(
      jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503),
    );
  }

  let record: unknown;
  try {
    record = await client.getMember(auth.member.id);
  } catch (err) {
    console.error("member-access: getMember failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503),
    );
  }

  if (!record || typeof record !== "object") {
    return withCors(
      jsonResponse({
        ok: true,
        hasMemberAccess: false,
        viewerAccessState: getViewerAccessState(null),
        legacyPaidThroughYmd: null,
      }),
    );
  }

  try {
    const evaluated = await evaluateMemberAccessForRecord(record);
    return withCors(
      jsonResponse({
        ok: true,
        hasMemberAccess: evaluated.hasMemberAccess,
        viewerAccessState: evaluated.viewerAccessState,
        legacyPaidThroughYmd: evaluated.legacyPaidThroughYmd,
      }),
    );
  } catch (err) {
    console.error("member-access failed:", err);
    return withCors(
      jsonResponse({
        ok: true,
        hasMemberAccess: false,
        viewerAccessState: "loggedInNoAccess",
        legacyPaidThroughYmd: null,
      }),
    );
  }
};
