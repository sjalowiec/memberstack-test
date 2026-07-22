/**
 * Resolves auth headers for Custom Pattern project APIs (and related admin callers).
 *
 * Production: `Authorization: Bearer <Memberstack JWT>` from `getMemberCookie()`.
 * The server verifies the token and derives membership from Admin API + MEMBER_PLAN_IDS.
 * Never sends `X-KBM-Member-Id` as authoritative identity.
 *
 * Dev fallback: `X-KBM-Dev-User-Id` when Astro/Netlify local-dev allow anonymous pattern user.
 */

import { memberIdFromMemberstackPayload } from "./memberstackMember";
import { DEFAULT_DEV_PATTERN_USER_ID } from "./customPatternProjectStoreKeys";
import { memberstackReadinessSnapshot, perfEnd, perfStart } from "./savedPatternsPerfLog";

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
  /** Present when a Bearer token was resolved for the current Memberstack session. */
  bearerToken?: string;
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

async function readMemberstackBearerToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const ms = window.$memberstackDom;
    const token = await ms?.getMemberCookie?.();
    if (typeof token === "string" && token.trim()) return token.trim();
  } catch {
    /* unauthenticated */
  }
  return null;
}

export async function resolveCustomPatternProjectAuth(): Promise<CustomPatternProjectAuth> {
  const authStart = perfStart();
  if (typeof window === "undefined") {
    perfEnd("2-member-auth (ssr)", authStart, { mode: "none" });
    return { mode: "none" };
  }

  const readiness = memberstackReadinessSnapshot();
  const ms = window.$memberstackDom;
  if (ms?.getCurrentMember) {
    const memberStart = perfStart();
    try {
      const res = await ms.getCurrentMember();
      const memberId = memberIdFromMemberstackPayload(res);
      perfEnd("2-member-auth getCurrentMember", memberStart, {
        ...readiness,
        memberIdResolved: Boolean(memberId),
      });
      if (memberId) {
        const bearerToken = (await readMemberstackBearerToken()) ?? undefined;
        // Without a JWT the server cannot verify identity — treat as unauthenticated.
        if (!bearerToken) {
          perfEnd("2-member-auth total", authStart, {
            mode: "none",
            reason: "missing-bearer",
            ...readiness,
          });
          return { mode: "none" };
        }
        perfEnd("2-member-auth total", authStart, { mode: "member", ...readiness });
        return { mode: "member", memberId, bearerToken };
      }
    } catch (error) {
      perfEnd("2-member-auth getCurrentMember (failed)", memberStart, {
        ...readiness,
        error: error instanceof Error ? error.message : String(error),
      });
      /* fall through */
    }
  } else {
    perfEnd("2-member-auth getCurrentMember (skipped)", authStart, {
      ...readiness,
      reason: "getCurrentMember unavailable",
    });
  }

  if (isDevCustomPatternProjectsEnabled()) {
    const devUserId = getOrCreateDevPatternUserId();
    perfEnd("2-member-auth total", authStart, { mode: "dev", ...readiness });
    return { mode: "dev", devUserId };
  }

  perfEnd("2-member-auth total", authStart, { mode: "none", ...readiness });
  return { mode: "none" };
}

/**
 * Headers for pattern project (and related) Netlify functions.
 * Member mode sends only a verified Bearer token — never a client-chosen member id.
 */
export function authHeadersForCustomPatternProjects(
  auth: CustomPatternProjectAuth,
): Record<string, string> {
  if (auth.mode === "member" && auth.bearerToken) {
    return { Authorization: `Bearer ${auth.bearerToken}` };
  }
  if (auth.mode === "dev" && auth.devUserId) {
    return { "X-KBM-Dev-User-Id": auth.devUserId };
  }
  return {};
}
