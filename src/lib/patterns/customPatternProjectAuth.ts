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

/**
 * Wait for the Memberstack DOM package to load and finish `onReady`.
 *
 * The save/update request runs the instant "Save Changes" is clicked, which can be before the
 * Memberstack SDK has finished initialising the session (especially for a just-registered member
 * or a freshly loaded Edit Pattern page). Reading the session before it is ready yields a stale or
 * missing token that the server rejects with "Invalid or expired session." This mirrors the
 * membership-status client's readiness handling so both authenticated callers behave the same —
 * it is not a second auth system.
 */
async function waitForMemberstackDom(
  maxAttempts = 35,
  intervalMs = 200,
): Promise<Window["$memberstackDom"] | undefined> {
  if (typeof window === "undefined") return undefined;
  for (let i = 0; i < maxAttempts; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) {
        try {
          await ms.onReady;
        } catch {
          /* readiness errors are non-fatal — fall through and try to read the session */
        }
      }
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return window.$memberstackDom;
}

/**
 * Read the current Memberstack session JWT for the Authorization header.
 *
 * Retries briefly: `getCurrentMember` can resolve before `getMemberCookie` returns a JWT, so a
 * single early read can miss a token that is about to be written. Retrying re-reads the *current*
 * session token rather than reusing a stale captured value.
 */
async function readMemberstackBearerToken(
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const attempts = options.attempts ?? 6;
  const intervalMs = options.intervalMs ?? 150;
  try {
    const ms = window.$memberstackDom;
    for (let i = 0; i < attempts; i++) {
      const token = await ms?.getMemberCookie?.();
      if (typeof token === "string" && token.trim()) return token.trim();
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
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
  const ms = await waitForMemberstackDom();
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
