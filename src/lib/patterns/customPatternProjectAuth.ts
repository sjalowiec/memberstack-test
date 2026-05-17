/**
 * Resolves user id headers for Custom Pattern project APIs.
 *
 * Auth wiring status:
 * - **Member id (preferred):** `X-KBM-Member-Id` from Memberstack `getCurrentMember()` when logged in.
 * - **Dev fallback:** `X-KBM-Dev-User-Id` (stable id in localStorage) — server accepts only when
 *   `ALLOW_DEV_PATTERN_USER=true` on Netlify. Do not promise account saving in UI when only dev mode applies.
 *
 * TODO: Verify Memberstack session/JWT server-side (`MEMBERSTACK_SECRET_KEY`) instead of trusting client-sent id.
 */

const DEV_USER_STORAGE_KEY = "kbm_dev_pattern_user_id";

export type CustomPatternProjectAuthMode = "member" | "dev" | "none";

export type CustomPatternProjectAuth = {
  mode: CustomPatternProjectAuthMode;
  memberId?: string;
  devUserId?: string;
};

function memberIdFromMemberstackPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const id = data.id ?? data._id;
  if (typeof id === "string" && id.trim()) return id.trim();
  const auth = data.auth;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const authId = (auth as Record<string, unknown>).id;
    if (typeof authId === "string" && authId.trim()) return authId.trim();
  }
  return undefined;
}

/** Stable dev user id for local Netlify dev when Memberstack is unavailable. */
export function getOrCreateDevPatternUserId(): string {
  if (typeof localStorage === "undefined") return "dev_anonymous";
  try {
    const existing = localStorage.getItem(DEV_USER_STORAGE_KEY)?.trim();
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `dev_${crypto.randomUUID()}`
        : `dev_${Date.now().toString(36)}`;
    localStorage.setItem(DEV_USER_STORAGE_KEY, id);
    return id;
  } catch {
    return "dev_anonymous";
  }
}

export async function resolveCustomPatternProjectAuth(): Promise<CustomPatternProjectAuth> {
  if (typeof window === "undefined") return { mode: "none" };

  const ms = window.$memberstackDom;
  if (ms?.getCurrentMember) {
    try {
      const res = await ms.getCurrentMember();
      const memberId = memberIdFromMemberstackPayload(res);
      if (memberId) return { mode: "member", memberId };
    } catch {
      /* fall through */
    }
  }

  if (import.meta.env.DEV) {
    return { mode: "dev", devUserId: getOrCreateDevPatternUserId() };
  }

  return { mode: "none" };
}

export function authHeadersForCustomPatternProjects(auth: CustomPatternProjectAuth): Record<string, string> {
  if (auth.mode === "member" && auth.memberId) {
    return { "X-KBM-Member-Id": auth.memberId };
  }
  if (auth.mode === "dev" && auth.devUserId) {
    return { "X-KBM-Dev-User-Id": auth.devUserId };
  }
  return {};
}
