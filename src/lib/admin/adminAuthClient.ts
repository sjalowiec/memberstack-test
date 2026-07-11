/**
 * Client-side auth headers for admin reporting endpoints.
 *
 * Unlike the older `X-KBM-Member-Id` pattern (customPatternProjectAuth.ts), reporting endpoints
 * verify a real Memberstack session JWT server-side (see netlify/functions/lib/admin-auth.js), so
 * the client's job here is just to fetch that token via `$memberstackDom.getMemberCookie()` — the
 * DOM package method documented for exactly this ("JWT for Authorization header when calling site
 * APIs") — and send it as a standard `Authorization: Bearer` header.
 */

const DEV_ADMIN_STORAGE_KEY = "kbm_dev_admin_enabled";

/**
 * Local dev only: lets the admin report pages work without a real Memberstack login when
 * `PUBLIC_ALLOW_DEV_PATTERN_USER` isn't explicitly disabled. Mirrors the server's
 * `ALLOW_DEV_PATTERN_USER` gate (netlify/functions/lib/custom-pattern-projects-store.js), which is
 * hard-disabled outside of local dev — this flag alone grants nothing without that server check
 * also passing.
 */
export function isDevAdminBypassEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    !!import.meta.env?.DEV &&
    import.meta.env.PUBLIC_ALLOW_DEV_PATTERN_USER !== "false"
  );
}

async function waitForMemberstackDom(maxAttempts = 35, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return window.$memberstackDom;
}

/**
 * Resolves the `Authorization: Bearer <token>` header for an admin report request, or `{}` when
 * no session token is available (dev bypass relies on the server also allowing it — this never
 * fabricates a token). Callers should still handle 401/403 responses; this is a best-effort fetch,
 * not a guarantee the caller is an admin.
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const ms = await waitForMemberstackDom();
    const token = await ms?.getMemberCookie?.();
    if (typeof token === "string" && token.trim()) {
      return { Authorization: `Bearer ${token.trim()}` };
    }
  } catch {
    /* fall through to unauthenticated request; server decides dev-bypass eligibility */
  }
  return {};
}
