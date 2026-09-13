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
import {
  emailFromMemberstackMemberRecord,
  emailFromVerifiedTokenPayload,
  getMemberstackAdminClient,
  getMemberstackAdminClientForMemberId,
  isMemberstackProductionRuntime,
  memberIdFromVerifiedTokenPayload,
  resolveMemberstackAdminSecret,
} from "./memberstack-admin.js";

/** Stable identity used only when ALLOW_DEV_PATTERN_USER=true (never true in production). */
export const DEV_ADMIN_MEMBER = { id: "dev_local_admin", email: "dev-admin@local" };

/** @param {string | undefined} value Comma/space/semicolon separated allowlist. */
export function parseAllowList(value) {
  return new Set(
    String(value || "")
      .split(/[\s,;]+/)
      .map((entry) =>
        entry
          .trim()
          .replace(/^['"]+/, "")
          .replace(/['"]+$/, "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
}

function adminMemberIdAllowList(env = process.env) {
  return parseAllowList(env.ADMIN_MEMBER_IDS);
}

function adminMemberEmailAllowList(env = process.env) {
  return parseAllowList(env.ADMIN_MEMBER_EMAILS);
}

/**
 * True when a verified member id/email is on the admin allowlist. Exported separately from
 * {@link requireAdmin} so callers that already have a verified member (e.g. after a shared lookup)
 * can reuse the allowlist check without re-verifying the token.
 * @param {{ id?: string | null, email?: string | null }} member
 */
export function isAdminMember(member, env = process.env) {
  const id = (member?.id || "").trim().toLowerCase();
  if (id && adminMemberIdAllowList(env).has(id)) return true;
  const email = (member?.email || "").trim().toLowerCase();
  if (email && adminMemberEmailAllowList(env).has(email)) return true;
  return false;
}

function envFlag(env, name) {
  return Boolean(String(env?.[name] || "").trim());
}

function claimKeysFromPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  return Object.keys(payload).filter((key) => payload[key] != null && payload[key] !== "");
}

/**
 * Dev-only authorization trace. Never includes JWTs, secrets, ids, emails, or env values.
 * @param {{
 *   env: NodeJS.ProcessEnv,
 *   verified: unknown,
 *   memberId: string | null,
 *   email: string | null,
 *   idMatched: boolean,
 *   emailMatched: boolean,
 * }} args
 */
export function safeAdminAuthDiagnostics(args) {
  const { env, verified, memberId, email, idMatched, emailMatched } = args;
  return {
    env: {
      ADMIN_MEMBER_IDS: envFlag(env, "ADMIN_MEMBER_IDS"),
      ADMIN_MEMBER_EMAILS: envFlag(env, "ADMIN_MEMBER_EMAILS"),
      MEMBERSTACK_SECRET_KEY: envFlag(env, "MEMBERSTACK_SECRET_KEY"),
      MEMBERSTACK_SANDBOX_SECRET_KEY: envFlag(env, "MEMBERSTACK_SANDBOX_SECRET_KEY"),
    },
    claimKeys: claimKeysFromPayload(verified),
    subjectExists: Boolean(memberId),
    emailExists: Boolean(email),
    allowlist: {
      idMatched: Boolean(idMatched),
      emailMatched: Boolean(emailMatched),
    },
  };
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
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<
 *   | { ok: true, member: { id: string, email: string | null }, mode: "verified" | "dev" }
 *   | { ok: false, status: number, error: string, diagnostics?: ReturnType<typeof safeAdminAuthDiagnostics> }
 * >}
 */
export async function requireAdmin(req, env = process.env) {
  const token = bearerTokenFromRequest(req);

  if (!token) {
    if (isAllowDevPatternUser()) {
      return { ok: true, member: DEV_ADMIN_MEMBER, mode: "dev" };
    }
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const client = getMemberstackAdminClient({
    secretKey: resolveMemberstackAdminSecret(env).secretKey,
  });
  if (!client) {
    // MEMBERSTACK_SECRET_KEY unset — fail closed rather than leak why.
    console.error("admin-auth: MEMBERSTACK_SECRET_KEY is not configured.");
    return { ok: false, status: 500, error: "Admin auth is not configured." };
  }

  const verified = await client.verifyMemberToken(token);
  const memberId = memberIdFromVerifiedTokenPayload(verified);
  if (!memberId) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  const tokenEmail = emailFromVerifiedTokenPayload(verified);
  const idMatched = adminMemberIdAllowList(env).has(memberId.toLowerCase());

  let record = null;
  const lookupClient = getMemberstackAdminClientForMemberId(memberId, env) || client;
  try {
    record = await lookupClient.getMember(memberId);
  } catch (err) {
    if (!idMatched) {
      console.error("admin-auth: getMember lookup failed:", err);
      return { ok: false, status: 500, error: "Could not verify admin access." };
    }
  }

  const email = emailFromMemberstackMemberRecord(record) || tokenEmail;
  const emailMatched = Boolean(email && adminMemberEmailAllowList(env).has(email.trim().toLowerCase()));

  if (!idMatched && !emailMatched) {
    const denied = {
      ok: false,
      status: 403,
      error: "Admin access required.",
    };
    if (!isMemberstackProductionRuntime(env)) {
      denied.diagnostics = safeAdminAuthDiagnostics({
        env,
        verified,
        memberId,
        email,
        idMatched,
        emailMatched,
      });
    }
    return denied;
  }

  return { ok: true, member: { id: memberId, email }, mode: "verified" };
}

/**
 * Verifies a Memberstack session without the reporting admin allowlist.
 * Used by DEV-only tools (e.g. Machines for Sale publish) that already block
 * production hosts and should accept any signed-in member.
 */
export async function requireVerifiedMember(req, env = process.env) {
  const token = bearerTokenFromRequest(req);

  if (!token) {
    if (isAllowDevPatternUser()) {
      return { ok: true, member: DEV_ADMIN_MEMBER, mode: "dev" };
    }
    return { ok: false, status: 401, error: "Sign in required." };
  }

  const client = getMemberstackAdminClient({
    secretKey: resolveMemberstackAdminSecret(env).secretKey,
  });
  if (!client) {
    console.error("admin-auth: MEMBERSTACK_SECRET_KEY is not configured.");
    return { ok: false, status: 500, error: "Admin auth is not configured." };
  }

  const verified = await client.verifyMemberToken(token);
  const memberId = memberIdFromVerifiedTokenPayload(verified);
  if (!memberId) {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }

  let email = emailFromVerifiedTokenPayload(verified);
  const lookupClient = getMemberstackAdminClientForMemberId(memberId, env) || client;
  try {
    const record = await lookupClient.getMember(memberId);
    email = emailFromMemberstackMemberRecord(record) || email;
  } catch {
    /* verified token is enough; email is cosmetic */
  }
  return { ok: true, member: { id: memberId, email }, mode: "verified" };
}
