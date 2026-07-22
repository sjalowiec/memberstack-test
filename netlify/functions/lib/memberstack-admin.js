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
 *
 * Local TLS: when MEMBERSTACK_TLS_INSECURE=1 outside production, Admin requests use a
 * client-scoped https.Agent with rejectUnauthorized=false. Production ignores the flag.
 */

import https from "node:https";
import { URL } from "node:url";

import { readDotEnvValue } from "./local-dotenv.js";

export const MEMBERSTACK_ADMIN_BASE_URL = "https://admin.memberstack.com";

/** @type {((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null} */
let insecureTlsFetchSingleton = null;
let insecureTlsWarned = false;

/**
 * True when this runtime is treated as production for Memberstack Admin safety rules.
 * Uses Netlify `CONTEXT=production` and/or `NODE_ENV=production`.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isMemberstackProductionRuntime(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || "")
    .trim()
    .toLowerCase();
  const context = String(env.CONTEXT || "")
    .trim()
    .toLowerCase();
  return nodeEnv === "production" || context === "production";
}

/**
 * True when MEMBERSTACK_TLS_INSECURE is an explicit opt-in value (1/true/yes).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isMemberstackTlsInsecureFlagEnabled(env = process.env) {
  const value = String(env.MEMBERSTACK_TLS_INSECURE ?? "")
    .trim()
    .toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Whether the Memberstack Admin client may relax TLS verification.
 * Requires MEMBERSTACK_TLS_INSECURE opt-in and a non-production runtime.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldUseMemberstackTlsInsecure(env = process.env) {
  if (isMemberstackProductionRuntime(env)) return false;
  return isMemberstackTlsInsecureFlagEnabled(env);
}

/** @param {unknown} headersInit */
function normalizeRequestHeaders(headersInit) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!headersInit) return out;
  if (typeof /** @type {{ forEach?: unknown }} */ (headersInit).forEach === "function") {
    /** @type {Headers} */ (headersInit).forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  for (const [key, value] of Object.entries(headersInit)) {
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return out;
}

/**
 * Memberstack-Admin-only fetch that skips TLS certificate verification.
 * Does not set NODE_TLS_REJECT_UNAUTHORIZED for the whole process.
 */
export function createMemberstackInsecureTlsFetch() {
  const agent = new https.Agent({ rejectUnauthorized: false });

  return async function memberstackInsecureFetch(input, init = {}) {
    const urlString =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : String(/** @type {{ url?: string }} */ (input)?.url || input);
    const url = new URL(urlString);
    if (url.protocol !== "https:") {
      return fetch(input, init);
    }

    const method = String(init.method || "GET").toUpperCase();
    const headers = normalizeRequestHeaders(init.headers);
    let bodyBuffer = null;
    if (init.body != null && method !== "GET" && method !== "HEAD") {
      if (Buffer.isBuffer(init.body)) {
        bodyBuffer = init.body;
      } else if (typeof init.body === "string") {
        bodyBuffer = Buffer.from(init.body);
      } else {
        bodyBuffer = Buffer.from(String(init.body));
      }
      if (!headers["content-length"] && !headers["Content-Length"]) {
        headers["Content-Length"] = String(bodyBuffer.length);
      }
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          agent,
        },
        (res) => {
          /** @type {Buffer[]} */
          const chunks = [];
          res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              if (Array.isArray(value)) {
                for (const item of value) responseHeaders.append(key, item);
              } else {
                responseHeaders.set(key, value);
              }
            }
            resolve(
              new Response(buffer, {
                status: res.statusCode || 0,
                statusText: res.statusMessage || "",
                headers: responseHeaders,
              }),
            );
          });
        },
      );
      req.on("error", reject);
      if (bodyBuffer) req.write(bodyBuffer);
      req.end();
    });
  };
}

function warnMemberstackTlsInsecureOnce() {
  if (insecureTlsWarned) return;
  insecureTlsWarned = true;
  console.warn(
    "[memberstack-admin][TLS] Certificate verification disabled for Memberstack Admin client only (MEMBERSTACK_TLS_INSECURE=1). Local use only; ignored in production.",
  );
}

/**
 * Resolve the fetch implementation for the Admin client.
 * Custom `fetchImpl` always wins. Otherwise opt-in local insecure TLS may apply.
 * @param {typeof fetch | undefined} fetchImpl
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveMemberstackAdminFetchImpl(fetchImpl, env = process.env) {
  if (fetchImpl !== undefined) {
    return { fetchImpl, tlsInsecure: false, source: "custom" };
  }
  if (shouldUseMemberstackTlsInsecure(env)) {
    warnMemberstackTlsInsecureOnce();
    if (!insecureTlsFetchSingleton) {
      insecureTlsFetchSingleton = createMemberstackInsecureTlsFetch();
    }
    return {
      fetchImpl: insecureTlsFetchSingleton,
      tlsInsecure: true,
      source: "insecure-local",
    };
  }
  if (isMemberstackTlsInsecureFlagEnabled(env) && isMemberstackProductionRuntime(env)) {
    console.warn(
      "[memberstack-admin][TLS] MEMBERSTACK_TLS_INSECURE is set but ignored in production.",
    );
  }
  return { fetchImpl: fetch, tlsInsecure: false, source: "default" };
}

/**
 * Shared entry point for migration scripts. Enables client-scoped insecure TLS via
 * createMemberstackAdminClient when MEMBERSTACK_TLS_INSECURE=1 outside production.
 * Does not set NODE_TLS_REJECT_UNAUTHORIZED globally.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function applyMemberstackLocalTlsInsecureIfRequested(env = process.env) {
  if (isMemberstackTlsInsecureFlagEnabled(env) && isMemberstackProductionRuntime(env)) {
    console.warn(
      "[memberstack-admin][TLS] MEMBERSTACK_TLS_INSECURE is set but ignored in production.",
    );
    return { applied: false, reason: "production" };
  }
  if (!shouldUseMemberstackTlsInsecure(env)) {
    return { applied: false, reason: "not-requested" };
  }
  warnMemberstackTlsInsecureOnce();
  return { applied: true, reason: "client-scoped" };
}

/** Test-only reset for singleton warn/fetch state. */
export function resetMemberstackTlsInsecureStateForTests() {
  insecureTlsFetchSingleton = null;
  insecureTlsWarned = false;
}

/** Live Admin secret (production + optional local fallback). */
export const MEMBERSTACK_LIVE_SECRET_ENV = "MEMBERSTACK_SECRET_KEY";
/** Sandbox/test Admin secret for local/dev (must never be used in production). */
export const MEMBERSTACK_SANDBOX_SECRET_ENV = "MEMBERSTACK_SANDBOX_SECRET_KEY";

/**
 * Browser Memberstack app id used in BaseLayout (`data-memberstack-app`).
 * Memberstack v2 does not use pk_ public keys here — TEST vs LIVE is domain-based
 * (TEST on localhost / non-production hosts; LIVE on production custom domains).
 */
export const MEMBERSTACK_BROWSER_APP_ID = "app_cmfh3d1n802vb0wy706205810";

/**
 * @param {string | null | undefined} key
 * @returns {"sandbox" | "live" | "unknown" | "unset"}
 */
export function classifyMemberstackSecretMode(key) {
  if (typeof key !== "string" || !key.trim()) return "unset";
  const trimmed = key.trim();
  if (trimmed.startsWith("sk_sb_")) return "sandbox";
  if (trimmed.startsWith("sk_")) return "live";
  return "unknown";
}

/**
 * Infer member environment from a Memberstack member id (not from client-supplied mode flags).
 * @param {string | null | undefined} memberIdOrEmail
 * @returns {"sandbox" | "live" | "unknown"}
 */
export function classifyMemberstackMemberIdMode(memberIdOrEmail) {
  if (typeof memberIdOrEmail !== "string") return "unknown";
  const id = memberIdOrEmail.trim();
  if (!id || id.includes("@")) return "unknown";
  if (id.startsWith("mem_sb_")) return "sandbox";
  if (id.startsWith("mem_")) return "live";
  return "unknown";
}

/**
 * Redacted secret metadata for logs — never includes the secret value.
 * @param {string | null | undefined} key
 */
export function describeMemberstackSecretKey(key) {
  if (typeof key !== "string" || !key.trim()) {
    return { mode: "unset", keyHint: "(unset)", length: 0 };
  }
  const trimmed = key.trim();
  const mode = classifyMemberstackSecretMode(trimmed);
  const prefix = trimmed.slice(0, Math.min(9, trimmed.length));
  return {
    mode,
    keyHint: `${prefix}…(${trimmed.length} chars)`,
    length: trimmed.length,
  };
}

/**
 * Shared Admin secret resolver used by requireMember, membership-status, and Watson.
 *
 * - Production (`NODE_ENV=production` or Netlify `CONTEXT=production`):
 *   only {@link MEMBERSTACK_LIVE_SECRET_ENV}. Never reads the sandbox secret.
 * - Non-production (localhost / deploy previews / staging):
 *   prefers {@link MEMBERSTACK_SANDBOX_SECRET_ENV} so Admin matches the browser's
 *   automatic Memberstack TEST/sandbox mode on non-production domains.
 *   Falls back to the live secret only when sandbox is unset (with a warning).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   secretKey: string | null,
 *   mode: "sandbox" | "live" | "unknown" | "unset",
 *   source: string,
 *   usedSandboxEnv: boolean,
 * }}
 */
export function resolveMemberstackAdminSecret(env = process.env) {
  const production = isMemberstackProductionRuntime(env);

  if (production) {
    const live = String(env[MEMBERSTACK_LIVE_SECRET_ENV] || "").trim();
    if (live) {
      return {
        secretKey: live,
        mode: classifyMemberstackSecretMode(live),
        source: `process.env.${MEMBERSTACK_LIVE_SECRET_ENV}`,
        usedSandboxEnv: false,
      };
    }
    // Never fall back to sandbox (or dotenv) in production.
    return {
      secretKey: null,
      mode: "unset",
      source: "production_unset",
      usedSandboxEnv: false,
    };
  }

  const sandboxFromProcess = String(env[MEMBERSTACK_SANDBOX_SECRET_ENV] || "").trim();
  if (sandboxFromProcess) {
    return {
      secretKey: sandboxFromProcess,
      mode: classifyMemberstackSecretMode(sandboxFromProcess),
      source: `process.env.${MEMBERSTACK_SANDBOX_SECRET_ENV}`,
      usedSandboxEnv: true,
    };
  }

  const sandboxFromDotEnv = (readDotEnvValue(MEMBERSTACK_SANDBOX_SECRET_ENV) || "").trim();
  if (sandboxFromDotEnv) {
    return {
      secretKey: sandboxFromDotEnv,
      mode: classifyMemberstackSecretMode(sandboxFromDotEnv),
      source: `dotenv.${MEMBERSTACK_SANDBOX_SECRET_ENV}`,
      usedSandboxEnv: true,
    };
  }

  const liveFromProcess = String(env[MEMBERSTACK_LIVE_SECRET_ENV] || "").trim();
  if (liveFromProcess) {
    console.warn(
      "[memberstack-admin] Non-production Admin is using the live secret because " +
        `${MEMBERSTACK_SANDBOX_SECRET_ENV} is unset. Browser Memberstack is TEST/sandbox on ` +
        "localhost and non-production hosts — set the sandbox secret to avoid env mismatch.",
      {
        adminMode: classifyMemberstackSecretMode(liveFromProcess),
        secretSource: `process.env.${MEMBERSTACK_LIVE_SECRET_ENV}`,
        keyHint: describeMemberstackSecretKey(liveFromProcess).keyHint,
      },
    );
    return {
      secretKey: liveFromProcess,
      mode: classifyMemberstackSecretMode(liveFromProcess),
      source: `process.env.${MEMBERSTACK_LIVE_SECRET_ENV}`,
      usedSandboxEnv: false,
    };
  }

  const liveFromDotEnv = (readDotEnvValue(MEMBERSTACK_LIVE_SECRET_ENV) || "").trim();
  if (liveFromDotEnv) {
    console.warn(
      "[memberstack-admin] Non-production Admin is using the live secret from .env because " +
        `${MEMBERSTACK_SANDBOX_SECRET_ENV} is unset. Browser Memberstack is TEST/sandbox on ` +
        "localhost and non-production hosts — set the sandbox secret to avoid env mismatch.",
      {
        adminMode: classifyMemberstackSecretMode(liveFromDotEnv),
        secretSource: `dotenv.${MEMBERSTACK_LIVE_SECRET_ENV}`,
        keyHint: describeMemberstackSecretKey(liveFromDotEnv).keyHint,
      },
    );
    return {
      secretKey: liveFromDotEnv,
      mode: classifyMemberstackSecretMode(liveFromDotEnv),
      source: `dotenv.${MEMBERSTACK_LIVE_SECRET_ENV}`,
      usedSandboxEnv: false,
    };
  }

  return {
    secretKey: null,
    mode: "unset",
    source: "unset",
    usedSandboxEnv: false,
  };
}

/**
 * Reads the server-only Memberstack Admin secret for the current runtime, or null.
 * Prefer {@link resolveMemberstackAdminSecret} when callers need mode/source metadata.
 */
export function getMemberstackSecretKey() {
  return resolveMemberstackAdminSecret().secretKey;
}

/**
 * True when a verified member id must not be looked up with the resolved Admin secret.
 * Example: `mem_sb_…` member + live Admin secret.
 * @param {string | null | undefined} memberIdOrEmail
 * @param {string | null | undefined} secretKey
 */
export function isMemberstackEnvironmentMismatch(memberIdOrEmail, secretKey) {
  const memberMode = classifyMemberstackMemberIdMode(memberIdOrEmail);
  const adminMode = classifyMemberstackSecretMode(secretKey);
  if (memberMode === "unknown" || adminMode === "unknown" || adminMode === "unset") {
    return false;
  }
  return memberMode !== adminMode;
}

/**
 * Log a clear, secret-safe environment mismatch. Returns true when mismatched.
 * @param {string | null | undefined} memberIdOrEmail
 * @param {string | null | undefined} secretKey
 * @param {string} [operation]
 */
export function logMemberstackEnvironmentMismatch(
  memberIdOrEmail,
  secretKey,
  operation = "getMember",
) {
  if (!isMemberstackEnvironmentMismatch(memberIdOrEmail, secretKey)) return false;
  const memberMode = classifyMemberstackMemberIdMode(memberIdOrEmail);
  const keyMeta = describeMemberstackSecretKey(secretKey);
  console.error("[memberstack-admin] Memberstack environment mismatch", {
    operation,
    memberMode,
    adminMode: keyMeta.mode,
    keyHint: keyMeta.keyHint,
    memberIdPrefix:
      typeof memberIdOrEmail === "string" ? memberIdOrEmail.trim().slice(0, 7) : null,
    hint:
      memberMode === "sandbox"
        ? `Use ${MEMBERSTACK_SANDBOX_SECRET_ENV} for local/dev Admin lookups.`
        : `Use ${MEMBERSTACK_LIVE_SECRET_ENV} for live Admin lookups.`,
  });
  return true;
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
 * Which Memberstack environment the resolved Admin secret targets.
 * Returns redacted metadata only — never the secret value.
 */
export function describeSecretKeyEnvironment() {
  const resolved = resolveMemberstackAdminSecret();
  const meta = describeMemberstackSecretKey(resolved.secretKey);
  return {
    mode:
      meta.mode === "sandbox"
        ? "sandbox/TEST"
        : meta.mode === "live"
          ? "LIVE"
          : meta.mode,
    keyHint: meta.keyHint,
    source: resolved.source,
    usedSandboxEnv: resolved.usedSandboxEnv,
  };
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
 * Safe operation label for getMember logs (never includes the email/id value).
 * @param {unknown} idOrEmail
 */
export function describeGetMemberOperation(idOrEmail) {
  const value = String(idOrEmail ?? "").trim();
  if (!value) return "getMember";
  if (value.includes("@")) return "getMember by email";
  if (/^mem_[a-z0-9]+$/i.test(value)) return "getMember by id";
  return "getMember by identifier";
}

/**
 * @param {unknown} err
 * @returns {string | null}
 */
export function extractFetchErrorCode(err) {
  let cur = err;
  let depth = 0;
  while (cur && depth < 8) {
    const code = /** @type {{ code?: unknown }} */ (cur).code;
    if (typeof code === "string" && code.trim()) {
      return code.trim();
    }
    cur = /** @type {{ cause?: unknown }} */ (cur).cause;
    depth += 1;
  }
  const summary =
    typeof /** @type {{ fetchCause?: unknown }} */ (err)?.fetchCause === "string"
      ? /** @type {{ fetchCause: string }} */ (err).fetchCause
      : summarizeFetchCause(err);
  const match = String(summary).match(
    /\b(UNABLE_TO_VERIFY_LEAF_SIGNATURE|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|CERT_[A-Z0-9_]+)\b/,
  );
  return match ? match[1] : null;
}

/**
 * @param {unknown} err
 * @returns {string | null}
 */
export function extractFetchErrorName(err) {
  let cur = err;
  let depth = 0;
  while (cur && depth < 8) {
    const name = /** @type {{ name?: unknown }} */ (cur).name;
    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
    cur = /** @type {{ cause?: unknown }} */ (cur).cause;
    depth += 1;
  }
  return null;
}

/**
 * Redact secrets from diagnostic strings. Never log API keys or bearer tokens.
 * @param {unknown} text
 */
export function redactMemberstackSecrets(text) {
  return String(text ?? "")
    .replace(/sk_[a-zA-Z0-9_]+/g, "sk_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/X-API-KEY["']?\s*[:=]\s*["']?[^\s"']+/gi, "X-API-KEY=[redacted]");
}

/**
 * Sanitized diagnostic for server logs / internal load_error details.
 * @param {unknown} err
 * @param {string} operation
 */
export function sanitizeMemberstackErrorDiagnostic(err, operation) {
  const code = extractFetchErrorCode(err);
  const name = extractFetchErrorName(err);
  const rawMessage =
    err && typeof err === "object" && typeof /** @type {{ message?: unknown }} */ (err).message === "string"
      ? /** @type {{ message: string }} */ (err).message
      : summarizeFetchCause(err);
  const fetchCause =
    err && typeof err === "object" && typeof /** @type {{ fetchCause?: unknown }} */ (err).fetchCause === "string"
      ? /** @type {{ fetchCause: string }} */ (err).fetchCause
      : summarizeFetchCause(err);
  const message = redactMemberstackSecrets(rawMessage).slice(0, 300);
  return {
    operation: String(operation || "memberstack"),
    name,
    code,
    message,
    fetchCause: redactMemberstackSecrets(fetchCause).slice(0, 400),
  };
}

/**
 * Builds a small Memberstack admin client. `fetchImpl` is injectable for tests.
 * @param {{ secretKey: string, baseUrl?: string, fetchImpl?: typeof fetch }} options
 */
export function createMemberstackAdminClient({
  secretKey,
  baseUrl = MEMBERSTACK_ADMIN_BASE_URL,
  fetchImpl,
} = {}) {
  if (!secretKey) {
    throw new Error("createMemberstackAdminClient: secretKey is required.");
  }

  const resolved = resolveMemberstackAdminFetchImpl(fetchImpl);
  const activeFetch = resolved.fetchImpl;

  const baseHeaders = {
    "X-API-KEY": secretKey,
    "Content-Type": "application/json",
  };

  /**
   * @param {string} method
   * @param {string} url
   * @param {RequestInit} [init]
   * @param {string} [operation]
   */
  async function request(method, url, init = {}, operation) {
    const endpoint = operation || describeMemberstackEndpoint(method, url);
    let res;
    try {
      res = await activeFetch(url, {
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
        `Memberstack ${endpoint} fetch failed (no HTTP response). Cause: ${redactMemberstackSecrets(cause)}`,
      );
      error.cause = err;
      /** @type {any} */ (error).endpoint = endpoint;
      /** @type {any} */ (error).operation = endpoint;
      /** @type {any} */ (error).fetchCause = redactMemberstackSecrets(cause);
      /** @type {any} */ (error).code = extractFetchErrorCode(err);
      /** @type {any} */ (error).diagnostic = sanitizeMemberstackErrorDiagnostic(error, endpoint);
      throw error;
    }

    if (!res.ok) {
      const detail = await readErrorDetail(res);
      const safeDetail = redactMemberstackSecrets(detail).slice(0, 300);
      const error = new Error(
        `Memberstack ${endpoint} failed (HTTP ${res.status})${safeDetail ? `: ${safeDetail}` : "."}`,
      );
      /** @type {any} */ (error).endpoint = endpoint;
      /** @type {any} */ (error).operation = endpoint;
      /** @type {any} */ (error).httpStatus = res.status;
      /** @type {any} */ (error).responseBody = safeDetail;
      /** @type {any} */ (error).diagnostic = sanitizeMemberstackErrorDiagnostic(error, endpoint);
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
    const operation = describeGetMemberOperation(idOrEmail);
    const url = `${baseUrl}/members/${encodeURIComponent(idOrEmail)}`;
    let res;
    try {
      res = await request("GET", url, {}, operation);
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
        `[memberstack-admin][DEBUG] ${operation} status=${res.status} hasData=${Boolean(data)} ` +
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
    const res = await request(
      "PATCH",
      `${baseUrl}/members/${encodeURIComponent(memberId)}`,
      {
        body: JSON.stringify(patch ?? {}),
      },
      "updateMember",
    );
    const body = await res.json();
    return body && typeof body === "object" && "data" in body ? body.data : body ?? null;
  }

  /**
   * Creates a member. `plans` may only include free plans; paid membership must come from Stripe sync
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
    const res = await request(
      "POST",
      `${baseUrl}/members`,
      {
        body: JSON.stringify(payload ?? {}),
      },
      "createMember",
    );
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
    const res = await request("GET", url.toString(), {}, "listMembers");
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
      res = await activeFetch(`${baseUrl}/members/verify-token`, {
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
