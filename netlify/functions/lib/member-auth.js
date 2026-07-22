/**
 * Verified Memberstack session gate for member-owned endpoints (e.g. favorites).
 *
 * Same cryptographic verification as admin-auth.js (Bearer token ? verifyMemberToken),
 * but without an admin allowlist ? any verified Memberstack member is accepted.
 * The member id is always taken from the verified token, never from client-supplied headers/body.
 */
import { isAllowDevPatternUser } from "./custom-pattern-projects-store.js";
import {
  getMemberstackAdminClient,
  getMemberstackSecretKey,
  logMemberstackEnvironmentMismatch,
} from "./memberstack-admin.js";

/** Stable identity used only when ALLOW_DEV_PATTERN_USER=true (never true in production). */
export const DEV_MEMBER = { id: "dev_local_favorites_member", email: "dev-favorites@local" };

/**
 * @param {Request} req
 * @returns {string | null}
 */
export function bearerTokenFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies the request's Memberstack session token and returns the member id from that token.
 * Local dev only: when `ALLOW_DEV_PATTERN_USER=true` and no token is present, a stable dev
 * identity is granted so favorites are testable without a real Memberstack login.
 *
 * @param {Request} req
 * @returns {Promise<
 *   | { ok: true, member: { id: string, email: string | null }, mode: "verified" | "dev" }
 *   | { ok: false, status: number, error: string }
 * >}
 */
export async function requireMember(req) {
  const token = bearerTokenFromRequest(req);

  if (!token) {
    if (isAllowDevPatternUser()) {
      return { ok: true, member: { ...DEV_MEMBER }, mode: "dev" };
    }
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const client = getMemberstackAdminClient();
  if (!client) {
    console.error("member-auth: Memberstack Admin secret is not configured.");
    return {
      ok: false,
      status: 503,
      error: "Favorites are unavailable in this environment.",
    };
  }

  const verified = await client.verifyMemberToken(token);
  if (!verified?.id || typeof verified.id !== "string" || !verified.id.trim()) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  const id = verified.id.trim();
  const secretKey = getMemberstackSecretKey();
  const envMismatch = logMemberstackEnvironmentMismatch(
    id,
    secretKey,
    "requireMember.getMember",
  );

  let email = null;
  if (!envMismatch) {
    try {
      const record = await client.getMember(id);
      email = typeof record?.auth?.email === "string" ? record.auth.email : null;
    } catch {
      /* email is optional for member-owned data paths */
    }
  }

  return { ok: true, member: { id, email }, mode: "verified" };
}
