/**
 * Shared server-side admin gate for reporting endpoints.
 *
 * Unlike the older `isActivityAdmin()` check (pattern-activity-store.js), this verifies the
 * caller's identity cryptographically instead of trusting a client-sent `X-KBM-Member-Id` header:
 * the browser sends the member's real Memberstack session token (via `Authorization: Bearer`,
 * see src/lib/admin/adminAuthClient.ts), and this module verifies it against Memberstack's Admin
 * REST API before trusting the member id it contains. This closes the "TODO: verify JWT" gap noted
 * in custom-pattern-projects-store.js for anything that touches revenue/membership data.
 *
 * Every new reporting endpoint should call {@link requireAdmin} rather than re-implementing an
 * allowlist check.
 */
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";
import { getMemberstackAdminClient } from "./memberstack-admin.js";

/** Stable identity used only when ALLOW_DEV_PATTERN_USER=true (never true in production). */
export const DEV_ADMIN_MEMBER = { id: "dev_local_admin", email: "dev-admin@local" };

/** @param {string | undefined} value Comma/space/semicolon separated allowlist. */
function parseAllowList(value) {
  return new Set(
    String(value || "")
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function adminMemberIdAllowList() {
  return parseAllowList(process.env.ADMIN_MEMBER_IDS);
}

function adminMemberEmailAllowList() {
  return parseAllowList(process.env.ADMIN_MEMBER_EMAILS);
}

/**
 * True when a verified member id/email is on the admin allowlist. Exported separately from
 * {@link requireAdmin} so callers that already have a verified member (e.g. after a shared lookup)
 * can reuse the allowlist check without re-verifying the token.
 * @param {{ id?: string | null, email?: string | null }} member
 */
export function isAdminMember(member) {
  const id = (member?.id || "").trim().toLowerCase();
  if (id && adminMemberIdAllowList().has(id)) return true;
  const email = (member?.email || "").trim().toLowerCase();
  if (email && adminMemberEmailAllowList().has(email)) return true;
  return false;
}

function bearerTokenFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies the request's Memberstack session token and checks the resulting member against the
 * admin allowlist. Local dev only: when `ALLOW_DEV_PATTERN_USER=true` (never true in a production
 * deploy — see {@link isAllowDevPatternUser}) and no token is present, a stable dev identity is
 * granted admin access so reports are testable without a real Memberstack login.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { ok: true, member: { id: string, email: string | null }, mode: "verified" | "dev" }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function requireAdmin(req) {
  const token = bearerTokenFromRequest(req);

  if (!token) {
    if (isAllowDevPatternUser()) {
      return { ok: true, member: DEV_ADMIN_MEMBER, mode: "dev" };
    }
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const client = getMemberstackAdminClient();
  if (!client) {
    // MEMBERSTACK_SECRET_KEY unset — fail closed rather than leak why.
    console.error("admin-auth: MEMBERSTACK_SECRET_KEY is not configured.");
    return { ok: false, status: 500, error: "Admin auth is not configured." };
  }

  const verified = await client.verifyMemberToken(token);
  if (!verified?.id) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  // Allowlist by id first (no extra network call); only fetch the member record for an email
  // check when id alone doesn't already clear the caller.
  if (adminMemberIdAllowList().has(verified.id.toLowerCase())) {
    let email = null;
    try {
      const record = await client.getMember(verified.id);
      email = typeof record?.auth?.email === "string" ? record.auth.email : null;
    } catch {
      /* id-based allowlist already granted access; email is cosmetic here */
    }
    return { ok: true, member: { id: verified.id, email }, mode: "verified" };
  }

  let record;
  try {
    record = await client.getMember(verified.id);
  } catch (err) {
    console.error("admin-auth: getMember lookup failed:", err);
    return { ok: false, status: 500, error: "Could not verify admin access." };
  }

  const email = typeof record?.auth?.email === "string" ? record.auth.email : null;
  if (!isAdminMember({ id: verified.id, email })) {
    return { ok: false, status: 403, error: "Admin access required." };
  }

  return { ok: true, member: { id: verified.id, email }, mode: "verified" };
}

/**
 * Verifies a Memberstack session without the reporting admin allowlist.
 * Used by DEV-only tools (e.g. Machines for Sale publish) that already block
 * production hosts and should accept any signed-in member.
 */
export async function requireVerifiedMember(req) {
  const token = bearerTokenFromRequest(req);

  if (!token) {
    if (isAllowDevPatternUser()) {
      return { ok: true, member: DEV_ADMIN_MEMBER, mode: "dev" };
    }
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const client = getMemberstackAdminClient();
  if (!client) {
    console.error("admin-auth: MEMBERSTACK_SECRET_KEY is not configured.");
    return { ok: false, status: 500, error: "Admin auth is not configured." };
  }

  const verified = await client.verifyMemberToken(token);
  if (!verified?.id) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  let email = null;
  try {
    const record = await client.getMember(verified.id);
    email = typeof record?.auth?.email === "string" ? record.auth.email : null;
  } catch {
    /* verified token is enough; email is cosmetic */
  }
  return { ok: true, member: { id: verified.id, email }, mode: "verified" };
}
