/**
 * Server-side membership gate for Dynamic Pattern project APIs.
 *
 * Call chain:
 *   Bearer JWT ? requireMember (verified Memberstack id)
 *   ? Admin getMember(planConnections)
 *   ? hasMemberAccess / MEMBER_PLAN_IDS (canonical; ACTIVE/TRIALING only)
 *
 * Never trusts X-KBM-Member-Id, body.entitlement, free-claim, lifetime, or unlock flags.
 */
import { hasMemberAccess } from "../../../src/lib/memberAccess.ts";
import { requireMember, bearerTokenFromRequest } from "./member-auth.js";
import { getMemberstackAdminClient } from "./memberstack-admin.js";
import {
  isAllowDevPatternUser,
  resolveDevPatternUserId,
  sanitizeKeySegment,
} from "./custom-pattern-projects-store.js";

const UNAVAILABLE = "Pattern projects are unavailable in this environment.";
const MEMBERSHIP_REQUIRED = "An active Knit it Now membership is required.";

/**
 * @param {Request} req
 * @returns {Promise<
 *   | { ok: true, userId: string, mode: "member" | "dev" }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function requirePatternProjectAccess(req) {
  const token = bearerTokenFromRequest(req);

  // Local/dev only: stable pattern-user storage without a Memberstack session.
  // Never granted in production (isAllowDevPatternUser is forced false there).
  if (!token && isAllowDevPatternUser()) {
    return {
      ok: true,
      userId: resolveDevPatternUserId(req),
      mode: "dev",
    };
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    if (auth.status === 503) {
      return { ok: false, status: 503, error: UNAVAILABLE };
    }
    return { ok: false, status: auth.status, error: auth.error };
  }

  if (auth.mode === "dev") {
    return {
      ok: true,
      userId: resolveDevPatternUserId(req),
      mode: "dev",
    };
  }

  const client = getMemberstackAdminClient();
  if (!client?.getMember) {
    console.error("requirePatternProjectAccess: Memberstack Admin client unavailable.");
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  let record;
  try {
    record = await client.getMember(auth.member.id);
  } catch (err) {
    console.error("requirePatternProjectAccess: getMember failed:", err);
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  if (!record || typeof record !== "object") {
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  // Fail closed: hasMemberAccess requires an ACTIVE/TRIALING plan in MEMBER_PLAN_IDS.
  if (!hasMemberAccess(record)) {
    return { ok: false, status: 403, error: MEMBERSHIP_REQUIRED };
  }

  return {
    ok: true,
    userId: sanitizeKeySegment(auth.member.id),
    mode: "member",
  };
}

/**
 * Identity-only gate (verified JWT ? member id). Does not grant pattern access.
 * Used by non-pattern endpoints that previously trusted X-KBM-Member-Id via resolveProjectUserId.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { userId: string, mode: "member" | "dev" }
 *   | { error: string, status: number }
 * >}
 */
export async function resolveVerifiedProjectUserId(req) {
  const token = bearerTokenFromRequest(req);

  if (!token && isAllowDevPatternUser()) {
    return { userId: resolveDevPatternUserId(req), mode: "dev" };
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    if (auth.status === 503) {
      return { error: UNAVAILABLE, status: 503 };
    }
    return { error: auth.error, status: auth.status };
  }

  if (auth.mode === "dev") {
    return { userId: resolveDevPatternUserId(req), mode: "dev" };
  }

  return { userId: sanitizeKeySegment(auth.member.id), mode: "member" };
}
