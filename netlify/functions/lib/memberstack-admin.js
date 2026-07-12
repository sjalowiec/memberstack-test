/**
 * Minimal server-side Memberstack Admin REST client.
 *
 * Used by admin-only Netlify functions to look up a member by email/id and to read/replace that
 * member's JSON metadata. Uses the Admin REST API (https://admin.memberstack.com) authenticated
 * with the SECRET key in the `X-API-KEY` header — this MUST stay server-side only and must never be
 * shipped to client code.
 *
 * Docs: https://developers.memberstack.com/admin-rest-api/member-actions
 *   - GET   /members/:id_or_email   (email must be URL-encoded)
 *   - PATCH /members/:id            ({ json } REPLACES the stored JSON — caller must merge first)
 */

export const MEMBERSTACK_ADMIN_BASE_URL = "https://admin.memberstack.com";

/** Reads the server-only Memberstack secret key, or null when unconfigured. */
export function getMemberstackSecretKey() {
  const key = (process.env.MEMBERSTACK_SECRET_KEY || "").trim();
  return key || null;
}

/** TEMPORARY DEBUG: gated by `DEBUG_SLEEVELESS_LOOKUP=true`. Remove once the lookup is diagnosed. */
export function isLookupDebugEnabled() {
  return String(process.env.DEBUG_SLEEVELESS_LOOKUP || "").trim().toLowerCase() === "true";
}

/**
 * TEMPORARY DEBUG: redacts an email for logs, e.g. `aubrie@knititnow.com` → `a****e@knititnow.com`.
 * @param {unknown} email
 */
export function maskEmailForLog(email) {
  if (typeof email !== "string" || !email.includes("@")) return "(no-email)";
  const [local, domain] = email.split("@");
  if (!local) return `(blank-local)@${domain}`;
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : "";
  return `${head}****${tail}@${domain}`;
}

/**
 * TEMPORARY DEBUG: which Memberstack environment the configured secret key targets, inferred from
 * its prefix. `sk_sb_…` = sandbox/TEST, `sk_…` = LIVE. Returns the mode plus a redacted key id.
 */
export function describeSecretKeyEnvironment() {
  const key = getMemberstackSecretKey();
  if (!key) return { mode: "unset", keyHint: "(unset)" };
  const mode = key.startsWith("sk_sb_") ? "sandbox/TEST" : key.startsWith("sk_") ? "LIVE" : "unknown";
  const keyHint = `${key.slice(0, 9)}…(${key.length} chars)`;
  return { mode, keyHint };
}

/**
 * Builds a small Memberstack admin client. `fetchImpl` is injectable for tests.
 * @param {{ secretKey: string, baseUrl?: string, fetchImpl?: typeof fetch }} options
 */
export function createMemberstackAdminClient({
  secretKey,
  baseUrl = MEMBERSTACK_ADMIN_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  if (!secretKey) {
    throw new Error("createMemberstackAdminClient: secretKey is required.");
  }

  const baseHeaders = {
    "X-API-KEY": secretKey,
    "Content-Type": "application/json",
  };

  /**
   * Retrieves a member by Memberstack id (`mem_...`) or email. Returns the member object
   * (the API `data` payload) or `null` when not found (404).
   * @param {string} idOrEmail
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async function getMember(idOrEmail) {
    const res = await fetchImpl(`${baseUrl}/members/${encodeURIComponent(idOrEmail)}`, {
      method: "GET",
      headers: baseHeaders,
    });
    if (res.status === 404) {
      // NOTE: per the Admin API docs a missing member is 200 + { data: null }, NOT 404. This 404
      // branch is defensive only.
      if (isLookupDebugEnabled()) {
        console.log("[memberstack-admin][DEBUG] getMember -> HTTP 404 (unexpected per docs)");
      }
      return null;
    }
    if (!res.ok) {
      throw new Error(`Memberstack getMember failed (${res.status}).`);
    }
    const body = await res.json();
    const data = body && typeof body === "object" && "data" in body ? body.data : body ?? null;
    if (isLookupDebugEnabled()) {
      // TEMPORARY DEBUG: raw response shape, redacted. `data: null` = no such member in this app/env.
      console.log(
        `[memberstack-admin][DEBUG] getMember status=${res.status} hasData=${Boolean(data)} ` +
          `keys=${data && typeof data === "object" ? Object.keys(data).join(",") : "(none)"}`,
      );
    }
    return data;
  }

  /**
   * Replaces a member's JSON metadata. Memberstack PATCH overwrites the whole `json` object, so the
   * caller MUST fetch + merge first. Returns the updated member object (API `data`) or `null`.
   * @param {string} memberId
   * @param {Record<string, unknown>} json
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async function updateMemberJson(memberId, json) {
    const res = await fetchImpl(`${baseUrl}/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: baseHeaders,
      body: JSON.stringify({ json }),
    });
    if (!res.ok) {
      throw new Error(`Memberstack updateMemberJson failed (${res.status}).`);
    }
    const body = await res.json();
    return body && typeof body === "object" && "data" in body ? body.data : body ?? null;
  }

  /**
   * Lists members (paginated, `after`-cursor style per the Admin REST API). Originally added for
   * the lookup debug probe; also used by reporting to page through the full member list.
   * @param {{ limit?: number, after?: number | string, order?: "ASC" | "DESC" }} [options]
   * @returns {Promise<{ totalCount?: number, endCursor?: number, hasNextPage?: boolean, data?: unknown[] }>}
   */
  async function listMembers({ limit = 100, after, order } = {}) {
    const url = new URL(`${baseUrl}/members`);
    url.searchParams.set("limit", String(limit));
    if (after !== undefined) url.searchParams.set("after", String(after));
    if (order) url.searchParams.set("order", order);
    const res = await fetchImpl(url.toString(), { method: "GET", headers: baseHeaders });
    if (!res.ok) {
      throw new Error(`Memberstack listMembers failed (${res.status}).`);
    }
    return res.json();
  }

  /**
   * Verifies a member session JWT via the Admin REST API and returns the decoded payload
   * (`{ id, type, iat, exp, aud, iss }`) on success, or `null` for any invalid/expired/malformed
   * token. Per Memberstack's docs this endpoint always returns 400 (never 401) for a bad token, so
   * any non-200 response, not just a specific status, is treated as "not verified".
   * Docs: https://developers.memberstack.com/admin-rest-api/verification
   * @param {string} token
   * @returns {Promise<{ id: string, type?: string, iat?: number, exp?: number, aud?: string, iss?: string } | null>}
   */
  async function verifyMemberToken(token) {
    if (!token || typeof token !== "string") return null;
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/members/verify-token`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ token }),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    let body;
    try {
      body = await res.json();
    } catch {
      return null;
    }
    const data = body && typeof body === "object" && "data" in body ? body.data : null;
    if (!data || typeof data !== "object" || typeof data.id !== "string") return null;
    return /** @type {{ id: string, type?: string, iat?: number, exp?: number, aud?: string, iss?: string }} */ (
      data
    );
  }

  return { getMember, updateMemberJson, listMembers, verifyMemberToken };
}

/**
 * Returns a ready-to-use admin client, or `null` when the key is not configured.
 *
 * Callers may pass `secretKey` explicitly for runtime-specific env access:
 * - Netlify Functions: `process.env.MEMBERSTACK_SECRET_KEY`
 * - Astro SSR: `import.meta.env.MEMBERSTACK_SECRET_KEY`
 *
 * When `secretKey` is omitted, falls back to `process.env.MEMBERSTACK_SECRET_KEY`.
 *
 * @param {{ secretKey?: string | null }} [options]
 */
export function getMemberstackAdminClient(options = {}) {
  const secretKey =
    "secretKey" in options
      ? typeof options.secretKey === "string"
        ? options.secretKey.trim()
        : ""
      : getMemberstackSecretKey();
  if (!secretKey) return null;
  return createMemberstackAdminClient({ secretKey });
}
