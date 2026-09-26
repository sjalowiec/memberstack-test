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
 * Live and test Memberstack ids for the same account (`mem_…` and `mem_sb_…`).
 * The suffix after the mode prefix is the account. An allowlisted form of that
 * account must match the other form, or a production session is rejected when
 * the allowlist was saved from the test id.
 * @param {string | null | undefined} memberId
 * @returns {string[]}
 */
export function memberIdAliases(memberId) {
  const id = String(memberId || "").trim().toLowerCase();
  if (!id) return [];
  const aliases = [id];
  if (id.startsWith("mem_sb_")) {
    const live = `mem_${id.slice("mem_sb_".length)}`;
    if (live !== "mem_") aliases.push(live);
  } else if (id.startsWith("mem_")) {
    aliases.push(`mem_sb_${id.slice("mem_".length)}`);
  }
  return aliases;
}

/**
 * @param {string | null | undefined} memberId
 * @param {NodeJS.ProcessEnv} [env]
 */
export function memberIdOnAdminAllowList(memberId, env = process.env) {
  const allow = adminMemberIdAllowList(env);
  return memberIdAliases(memberId).some((alias) => allow.has(alias));
}

/**
 * True when a verified member id/email is on the admin allowlist. Exported separately from
 * {@link requireAdmin} so callers that already have a verified member (e.g. after a shared lookup)
 * can reuse the allowlist check without re-verifying the token.
 * @param {{ id?: string | null, email?: string | null }} member
 */
export function isAdminMember(member, env = process.env) {
  if (memberIdOnAdminAllowList(member?.id, env)) return true;
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

const MEMBERSTACK_SESSION_COOKIE_NAMES = [
  "_ms_cookie",
  "_ms-mid",
  "_ms_mid",
  "memberstack",
  "memberstack_access_token",
];

function looksLikeMemberstackJwt(value) {
  return typeof value === "string" && value.split(".").length === 3 && value.length > 20;
}

/** JWT from a Memberstack session cookie. Ignores member-id cookies that are not tokens. */
function jwtFromCookieHeader(header) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!MEMBERSTACK_SESSION_COOKIE_NAMES.includes(name)) continue;
    let value = part.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep the raw value */
    }
    if (looksLikeMemberstackJwt(value)) return value;
  }
  return null;
}

/**
 * Memberstack session token.
 * Netlify Basic Auth on /admin pages puts `Authorization: Basic` on later same-origin
 * requests, which hides a Bearer token. The custom header and session cookie are the
 * same JWT, and both still go through verifyMemberToken plus the admin allowlist.
 */
function bearerTokenFromRequest(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const bearer = match ? match[1].trim() : "";
  if (bearer) return bearer;
  const custom = req.headers.get("x-kin-member-token")?.trim() || "";
  if (custom) return custom;
  return jwtFromCookieHeader(req.headers.get("cookie"));
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
  const idMatched = memberIdOnAdminAllowList(memberId, env);

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
