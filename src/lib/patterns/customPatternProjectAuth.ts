/**
 * Resolves user id headers for Custom Pattern project APIs.
 *
 * Auth wiring status:
 * - **Member id (preferred):** `X-KBM-Member-Id` from Memberstack `getCurrentMember()` when logged in.
 * - **Dev fallback:** stable id in localStorage (sent as `X-KBM-Dev-User-Id` when available) — server uses
 *   the same id or a built-in fallback when `ALLOW_DEV_PATTERN_USER=true`. Not account-backed.
 *
 * TODO: Verify Memberstack session/JWT server-side (`MEMBERSTACK_SECRET_KEY`) instead of trusting client-sent id.
 */

import { memberIdFromMemberstackPayload } from "./memberstackMember";
import { DEFAULT_DEV_PATTERN_USER_ID } from "./customPatternProjectStoreKeys";

const DEV_USER_STORAGE_KEY = "kbm_dev_pattern_user_id";

export { DEFAULT_DEV_PATTERN_USER_ID };

/**
 * Local save/list/load when Astro dev + Netlify dev allow anonymous pattern user.
 * Never enabled in production builds (import.meta.env.DEV is false).
 */
export function isDevCustomPatternProjectsEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    !!import.meta.env?.DEV &&
    import.meta.env.PUBLIC_ALLOW_DEV_PATTERN_USER !== "false"
  );
}

export type CustomPatternProjectAuthMode = "member" | "dev" | "none";

export type CustomPatternProjectAuth = {
  mode: CustomPatternProjectAuthMode;
  memberId?: string;
  devUserId?: string;
};

/** Stable dev user id for local dev when Memberstack is unavailable. */
export function getOrCreateDevPatternUserId(): string {
  if (typeof localStorage === "undefined") return DEFAULT_DEV_PATTERN_USER_ID;
  try {
    const existing = localStorage.getItem(DEV_USER_STORAGE_KEY)?.trim();
    if (existing) return existing;
    localStorage.setItem(DEV_USER_STORAGE_KEY, DEFAULT_DEV_PATTERN_USER_ID);
    return DEFAULT_DEV_PATTERN_USER_ID;
  } catch {
    return DEFAULT_DEV_PATTERN_USER_ID;
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

  if (isDevCustomPatternProjectsEnabled()) {
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
