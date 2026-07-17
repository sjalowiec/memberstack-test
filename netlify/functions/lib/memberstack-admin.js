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
 * Safe endpoint label for logs (never includes query secrets; member ids/emails stay encoded path).
 * @param {string} method
 * @param {string} url
 */
export function describeMemberstackEndpoint(method, url) {
  try {
    const u = new URL(url);
    return `${method.toUpperCase()} ${u.origin}${u.pathname}`;
  } catch {
    return `${method.toUpperCase()} ${String(url)}`;
  }
}

/**
 * Flatten undici/node fetch error causes into a readable summary
 * (ENOTFOUND, ECONNREFUSED, ETIMEDOUT, UNABLE_TO_VERIFY_LEAF_SIGNATURE, …).
 * @param {unknown} err
 */
export function summarizeFetchCause(err) {
  const parts = [];
  let cur = err;
  let depth = 0;
  while (cur && depth < 6) {
    const rec = /** @type {{ name?: string, code?: string, message?: string, cause?: unknown, errors?: unknown[] }} */ (
      cur
    );
    const code = typeof rec.code === "string" ? rec.code : "";
    const message = typeof rec.message === "string" ? rec.message : "";
    const name = typeof rec.name === "string" ? rec.name : "";
    const bit = [name, code, message].filter(Boolean).join(": ");
    if (bit) parts.push(bit);
    if (Array.isArray(rec.errors)) {
      for (const nested of rec.errors) {
        const n = /** @type {{ code?: string, message?: string }} */ (nested);
        const nestedBit = [n.code, n.message].filter(Boolean).join(": ");
        if (nestedBit) parts.push(nestedBit);
      }
    }
    cur = rec.cause;
    depth++;
  }
  return parts.join(" | ") || "(no cause details)";
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
   * @param {string} method
   * @param {string} url
   * @param {RequestInit} [init]
   */
  async function request(method, url, init = {}) {
    const endpoint = describeMemberstackEndpoint(method, url);
    let res;
    try {
      res = await fetchImpl(url, {
        ...init,
        method,
        headers: {
          ...baseHeaders,
          ...(init.headers || {}),
        },
      });
    } catch (err) {
      const cause = summarizeFetchCause(err);
      const error = new Error(
        `Memberstack ${endpoint} fetch failed (no HTTP response). Cause: ${cause}`,
      );
      error.cause = err;
      /** @type {any} */ (error).endpoint = endpoint;
      /** @type {any} */ (error).fetchCause = cause;
      throw error;
    }

    if (!res.ok) {
      const detail = await readErrorDetail(res);
      const error = new Error(
        `Memberstack ${endpoint} failed (HTTP ${res.status})${detail ? `: ${detail}` : "."}`,
      );
      /** @type {any} */ (error).endpoint = endpoint;
      /** @type {any} */ (error).httpStatus = res.status;
      /** @type {any} */ (error).responseBody = detail;
      throw error;
    }
    return res;
  }

  /** @param {Response} res */
  async function readErrorDetail(res) {
    try {
      const text = await res.text();
      if (!text) return "";
      try {
        const body = JSON.parse(text);
        if (body && typeof body === "object") {
          const msg = body.message || body.code || body.error;
          if (msg) return String(msg);
          return text.slice(0, 500);
        }
      } catch {
        return text.slice(0, 500);
      }
      return text.slice(0, 500);
    } catch {
      return "";
    }
  }

  /**
   * Retrieves a member by Memberstack id (`mem_...`) or email. Returns the member object
   * (the API `data` payload) or `null` when not found (404).
   * @param {string} idOrEmail
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async function getMember(idOrEmail) {
    const url = `${baseUrl}/members/${encodeURIComponent(idOrEmail)}`;
    let res;
    try {
      res = await request("GET", url);
    } catch (err) {
      const status = /** @type {any} */ (err).httpStatus;
      if (status === 404) {
        if (isLookupDebugEnabled()) {
          console.log("[memberstack-admin][DEBUG] getMember -> HTTP 404 (unexpected per docs)");
        }
        return null;
      }
      throw err;
    }
    const body = await res.json();
    const data = body && typeof body === "object" && "data" in body ? body.data : body ?? null;
    if (isLookupDebugEnabled()) {
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
    return updateMember(memberId, { json });
  }

  /**
   * Partial update of a member. `customFields` / `metaData` are shallow-merged by Memberstack;
   * `json` is fully replaced when sent. Returns the updated member object (API `data`) or `null`.
   * @param {string} memberId
   * @param {Record<string, unknown>} patch
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async function updateMember(memberId, patch) {
    const res = await request("PATCH", `${baseUrl}/members/${encodeURIComponent(memberId)}`, {
      body: JSON.stringify(patch ?? {}),
    });
    const body = await res.json();
    return body && typeof body === "object" && "data" in body ? body.data : body ?? null;
  }

  /**
   * Creates a member. `plans` may only include free plans; paid Premium must come from Stripe sync
   * (CSV import with Customer + Subscription IDs). Returns the created member (API `data`).
   * @param {{
   *   email: string,
   *   password?: string,
   *   plans?: Array<{ planId: string }>,
   *   customFields?: Record<string, unknown>,
   *   metaData?: Record<string, unknown>,
   *   json?: Record<string, unknown>,
   *   loginRedirect?: string,
   * }} payload
   * @returns {Promise<Record<string, unknown>>}
   */
  async function createMember(payload) {
    const res = await request("POST", `${baseUrl}/members`, {
      body: JSON.stringify(payload ?? {}),
    });
    const body = await res.json();
    const data = body && typeof body === "object" && "data" in body ? body.data : body;
    if (!data || typeof data !== "object") {
      throw new Error("Memberstack createMember returned no member data.");
    }
    return /** @type {Record<string, unknown>} */ (data);
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
    const res = await request("GET", url.toString());
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

  return { getMember, updateMember, updateMemberJson, createMember, listMembers, verifyMemberToken };
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
