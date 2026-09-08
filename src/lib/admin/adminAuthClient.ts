/**
 * Client-side auth headers for admin APIs that use requireAdminForRequest.
 *
 * The browser must send a real Memberstack session JWT (`Authorization: Bearer`) on every
 * protected request. Netlify Basic Auth on `/admin/*` is a separate gate and does not
 * authenticate these APIs.
 *
 * Token reads wait for the Memberstack DOM package and retry `getMemberCookie()` because
 * `getCurrentMember` can exist before the JWT is available. Tokens are never cached across
 * requests — each call re-reads the current session.
 */

import { openMemberstackLoginModal } from "../memberstackLogin";

export const ADMIN_SIGN_IN_REQUIRED_MESSAGE = "Sign in with your Knit it Now account to continue.";
export const ADMIN_FORBIDDEN_MESSAGE = "This Knit it Now account does not have admin access.";

/**
 * Local dev only: lets admin pages work without a real Memberstack login when
 * `PUBLIC_ALLOW_DEV_PATTERN_USER` isn't explicitly disabled. Hosted Netlify builds
 * have `import.meta.env.DEV === false`, so this never grants access on kin-dev or production.
 */
export function isDevAdminBypassEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    !!import.meta.env?.DEV &&
    import.meta.env.PUBLIC_ALLOW_DEV_PATTERN_USER !== "false"
  );
}

export type MemberstackDomLike = {
  getCurrentMember?: () => Promise<unknown>;
  getMemberCookie?: () => unknown;
  onReady?: Promise<unknown>;
};

export async function waitForMemberstackDom(
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    now?: () => MemberstackDomLike | undefined;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<MemberstackDomLike | undefined> {
  const maxAttempts = options.maxAttempts ?? 40;
  const intervalMs = options.intervalMs ?? 250;
  const now =
    options.now ??
    (() => (typeof window === "undefined" ? undefined : window.$memberstackDom));
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let i = 0; i < maxAttempts; i++) {
    const ms = now();
    if (ms?.getCurrentMember) {
      if (ms.onReady) {
        try {
          await ms.onReady;
        } catch {
          /* readiness errors are non-fatal — try to read the session anyway */
        }
      }
      return ms;
    }
    if (i < maxAttempts - 1) await sleep(intervalMs);
  }
  return now();
}

/**
 * Read the current Memberstack session JWT. Retries because the SDK can expose
 * getCurrentMember before getMemberCookie returns a token.
 */
export async function readMemberstackBearerToken(
  options: {
    attempts?: number;
    intervalMs?: number;
    memberstack?: MemberstackDomLike;
    waitForDom?: typeof waitForMemberstackDom;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<string | null> {
  if (typeof window === "undefined" && !options.memberstack && !options.waitForDom) {
    return null;
  }
  const attempts = options.attempts ?? 8;
  const intervalMs = options.intervalMs ?? 150;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const waitForDom = options.waitForDom ?? waitForMemberstackDom;
  try {
    const ms = options.memberstack ?? (await waitForDom());
    for (let i = 0; i < attempts; i++) {
      const token = await ms?.getMemberCookie?.();
      if (typeof token === "string" && token.trim()) return token.trim();
      if (i < attempts - 1) await sleep(intervalMs);
    }
  } catch {
    /* unauthenticated */
  }
  return null;
}

/**
 * Resolves the `Authorization: Bearer <token>` header for an admin request, or `{}` when
 * no session token is available. Never fabricates a token. Does not reuse a previous JWT.
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const token = await readMemberstackBearerToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export type AdminJsonResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  needsSignIn?: boolean;
  forbidden?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Authenticated JSON request for Help Hub (and other) admin APIs.
 * Reads a fresh Memberstack token immediately before each fetch.
 * Does not report success unless the HTTP response is OK and `data.ok` is true.
 */
export async function fetchAdminJson<T = Record<string, unknown>>(
  url: string,
  init: {
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
    fetchImpl?: typeof fetch;
    getHeaders?: typeof getAdminAuthHeaders;
    allowMissingToken?: boolean;
  },
): Promise<AdminJsonResult<T>> {
  const fetchImpl = init.fetchImpl ?? fetch;
  const getHeaders = init.getHeaders ?? getAdminAuthHeaders;
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const authHeaders = await getHeaders();
  Object.assign(headers, authHeaders);

  const allowMissingToken = init.allowMissingToken ?? isDevAdminBypassEnabled();
  if (!headers.Authorization && !allowMissingToken) {
    return {
      ok: false,
      status: 401,
      data: {} as T,
      error: ADMIN_SIGN_IN_REQUIRED_MESSAGE,
      needsSignIn: true,
    };
  }

  const res = await fetchImpl(url, {
    method: init.method,
    headers,
    credentials: "same-origin",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const raw = await res.json().catch(() => ({}));
  const data = asRecord(raw) as T;
  const record = asRecord(raw);
  const errorText =
    typeof record.error === "string" && record.error.trim()
      ? record.error.trim()
      : res.status === 401
        ? ADMIN_SIGN_IN_REQUIRED_MESSAGE
        : res.status === 403
          ? ADMIN_FORBIDDEN_MESSAGE
          : `Request failed (${res.status})`;

  if (res.status === 401) {
    return { ok: false, status: 401, data, error: errorText, needsSignIn: true };
  }
  if (res.status === 403) {
    return { ok: false, status: 403, data, error: errorText, forbidden: true };
  }
  if (!res.ok || record.ok !== true) {
    return { ok: false, status: res.status, data, error: errorText };
  }
  return { ok: true, status: res.status, data };
}

export type AdminHtmlResult = {
  ok: boolean;
  status: number;
  html?: string;
  error?: string;
  needsSignIn?: boolean;
  forbidden?: boolean;
};

/**
 * Authenticated HTML request for admin preview pages.
 * Reads a fresh Memberstack token immediately before each fetch.
 * Success is HTML. 401/403 are JSON errors (Sign In / Admin access required).
 */
export async function fetchAdminHtml(
  url: string,
  init: {
    method: string;
    body?: unknown;
    headers?: Record<string, string>;
    fetchImpl?: typeof fetch;
    getHeaders?: typeof getAdminAuthHeaders;
    allowMissingToken?: boolean;
  },
): Promise<AdminHtmlResult> {
  const fetchImpl = init.fetchImpl ?? fetch;
  const getHeaders = init.getHeaders ?? getAdminAuthHeaders;
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const authHeaders = await getHeaders();
  Object.assign(headers, authHeaders);

  const allowMissingToken = init.allowMissingToken ?? isDevAdminBypassEnabled();
  if (!headers.Authorization && !allowMissingToken) {
    return {
      ok: false,
      status: 401,
      error: ADMIN_SIGN_IN_REQUIRED_MESSAGE,
      needsSignIn: true,
    };
  }

  const res = await fetchImpl(url, {
    method: init.method,
    headers,
    credentials: "same-origin",
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (res.status === 401 || res.status === 403 || !res.ok) {
    const raw = await res.json().catch(() => ({}));
    const record = asRecord(raw);
    const errorText =
      typeof record.error === "string" && record.error.trim()
        ? record.error.trim()
        : res.status === 401
          ? ADMIN_SIGN_IN_REQUIRED_MESSAGE
          : res.status === 403
            ? ADMIN_FORBIDDEN_MESSAGE
            : `Request failed (${res.status})`;
    if (res.status === 401) {
      return { ok: false, status: 401, error: errorText, needsSignIn: true };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, error: errorText, forbidden: true };
    }
    return { ok: false, status: res.status, error: errorText };
  }

  const html = await res.text();
  if (!html.trim()) {
    return { ok: false, status: res.status, error: "Preview returned empty HTML." };
  }
  return { ok: true, status: res.status, html };
}

export function promptAdminSignIn(returnPath?: string): void {
  openMemberstackLoginModal(returnPath);
}
