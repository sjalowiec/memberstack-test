/**
 * Server-side identity and membership gates for Dynamic Pattern project APIs.
 *
 * Identity (list / load / delete):
 *   Bearer JWT → requireMember (verified Memberstack id)
 *
 * Mutation (save / update):
 *   identity + evaluateMemberAccessForRecord (paid plan or Watson paid-through)
 *
 * Never trusts X-KBM-Member-Id, body.entitlement, free-claim, lifetime, or unlock flags.
 */
import { evaluateMemberAccessForRecord, loadLegacyPaidThroughYmdForEmail } from "../../../src/lib/memberAccessServer.ts";
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
 * Verified Memberstack identity for owner-scoped pattern reads and deletes.
 * Does not require paid membership.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { ok: true, userId: string, mode: "member" | "dev" }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function requirePatternProjectIdentity(req) {
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

  return {
    ok: true,
    userId: sanitizeKeySegment(auth.member.id),
    mode: "member",
  };
}

/**
 * Paid-membership gate for create/update (and any other mutation that must stay members-only).
 * Identity is verified first; client headers and entitlement fields cannot grant access.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { ok: true, userId: string, mode: "member" | "dev" }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function requirePatternProjectAccess(req) {
  const identity = await requirePatternProjectIdentity(req);
  if (!identity.ok) return identity;
  if (identity.mode === "dev") return identity;

  const client = getMemberstackAdminClient();
  if (!client?.getMember) {
    console.error("requirePatternProjectAccess: Memberstack Admin client unavailable.");
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  let record;
  try {
    record = await client.getMember(identity.userId);
  } catch (err) {
    console.error("requirePatternProjectAccess: getMember failed:", err);
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  if (!record || typeof record !== "object") {
    return { ok: false, status: 503, error: UNAVAILABLE };
  }

  // Fail closed: paid plan, or a confirmed Watson paid-through date today or later.
  let evaluated;
  try {
    evaluated = await evaluateMemberAccessForRecord(record, {
      loadPaidThroughYmd: loadLegacyPaidThroughYmdForEmail,
    });
  } catch (err) {
    console.error("requirePatternProjectAccess: membership evaluation failed:", err);
    return { ok: false, status: 503, error: UNAVAILABLE };
  }
  if (!evaluated.hasMemberAccess) {
    return { ok: false, status: 403, error: MEMBERSHIP_REQUIRED };
  }

  return {
    ok: true,
    userId: identity.userId,
    mode: "member",
  };
}

/**
 * Identity-only gate (verified JWT → member id + email). Does not grant pattern mutation access.
 * Used by non-pattern endpoints that previously trusted X-KBM-Member-Id via resolveProjectUserId.
 * `email` is the Memberstack Admin record address from {@link requireMember} (empty when lookup
 * did not return one). Callers must not treat a client `X-KBM-Member-Email` header as equivalent.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { userId: string, mode: "member" | "dev", email: string }
 *   | { error: string, status: number }
 * >}
 */
export async function resolveVerifiedProjectUserId(req) {
  const token = bearerTokenFromRequest(req);

  if (!token && isAllowDevPatternUser()) {
    return { userId: resolveDevPatternUserId(req), mode: "dev", email: "" };
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    if (auth.status === 503) {
      return { error: UNAVAILABLE, status: 503 };
    }
    return { error: auth.error, status: auth.status };
  }

  if (auth.mode === "dev") {
    return { userId: resolveDevPatternUserId(req), mode: "dev", email: "" };
  }

  const email =
    typeof auth.member.email === "string" ? auth.member.email.trim() : "";
  return { userId: sanitizeKeySegment(auth.member.id), mode: "member", email };
}
