/**
 * Memberstack-backed resolver for {@link SleevelessUserAccess}.
 *
 * Claim storage: the one-time free pattern claim is stored on the Memberstack member's JSON
 * (`getMemberJSON` / `updateMemberJSON`) — the existing account-tied metadata mechanism — NOT in
 * localStorage. Entitlement is read from Memberstack plan connections plus a member-JSON unlock flag.
 *
 * Reuses the same `window.$memberstackDom` + dev-bypass patterns as the sleeveless login gate.
 */
import { devBypass } from "../devBypass";
import { memberIdFromMemberstackPayload } from "./memberstackMember";
import {
  hasSleevelessPatternSystemAccess as hasSystemAccessRule,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  mergeFreeClaimIntoMemberJson,
  mergeFreeClaimResetIntoMemberJson,
  planIdsGrantSleevelessSystemAccess,
  readFreeClaimFromMemberJson,
  readSleevelessSystemUnlockFromMemberJson,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

type MemberstackDom = NonNullable<Window["$memberstackDom"]>;

/**
 * Where the resolved access decision came from. DEBUG/DIAGNOSTIC ONLY — this never feeds an access
 * rule; it just labels which branch of {@link resolveAccessUncached} produced the snapshot so the
 * localhost debug badge can show it. See `src/scripts/sleevelessAccessDebugBadge.ts`.
 */
export type SleevelessAccessSource =
  | "dev-bypass"
  | "memberstack-plan"
  | "member-json-unlock"
  | "free"
  | "logged-out";

/** DEBUG-only diagnostic snapshot describing how access was resolved. Not used by any rule. */
export interface SleevelessAccessDebug {
  source: SleevelessAccessSource;
  loggedIn: boolean;
  hasSystemAccess: boolean;
  freeClaimed: boolean;
  freeClaimedPatternId?: string;
  memberId?: string;
  planIds: string[];
  unlockedViaJson: boolean;
  /** Extra context for logged-out outcomes (e.g. why no member was found). */
  reason?: string;
  at: number;
}

declare global {
  interface Window {
    /** Last resolved Sleeveless access snapshot (sync read for access-gate fallbacks). */
    __KBM_SLEEVELESS_ACCESS__?: SleevelessUserAccess;
    /** In-flight resolution promise, memoized per page load. */
    __KBM_SLEEVELESS_ACCESS_PROMISE__?: Promise<SleevelessUserAccess>;
    /** DEBUG-only: how the last access decision was reached (dev builds only). */
    __KBM_SLEEVELESS_ACCESS_DEBUG__?: SleevelessAccessDebug;
  }
}

/**
 * DEBUG-only: stash how the last access decision was reached so the localhost badge can show it.
 * No-op outside the Astro dev server (`import.meta.env.DEV`) and during SSR, so production builds
 * carry zero overhead and never expose this. This records observations only — it changes nothing.
 */
function recordAccessDebug(debug: SleevelessAccessDebug): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env?.DEV) return;
  window.__KBM_SLEEVELESS_ACCESS_DEBUG__ = debug;
}

/** DEBUG-only: read the last recorded access-source diagnostic, or null. */
export function getSleevelessAccessDebug(): SleevelessAccessDebug | null {
  if (typeof window === "undefined") return null;
  return window.__KBM_SLEEVELESS_ACCESS_DEBUG__ ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Pulls plan ids from a Memberstack `getCurrentMember()` payload, regardless of nesting. */
export function planIdsFromMemberstackPayload(payload: unknown): string[] {
  const root = asRecord(payload);
  const data = asRecord(root.data ?? root);
  const member = asRecord((data.member as unknown) ?? data);
  const connections = member.planConnections ?? data.planConnections;
  if (!Array.isArray(connections)) return [];
  const ids: string[] = [];
  for (const conn of connections) {
    const rec = asRecord(conn);
    const id = rec.planId ?? rec.plan ?? rec.id;
    if (typeof id === "string" && id.trim()) ids.push(id.trim());
  }
  return ids;
}

async function readMemberJson(ms: MemberstackDom): Promise<unknown> {
  if (typeof ms.getMemberJSON !== "function") return {};
  try {
    const res = await ms.getMemberJSON();
    const root = asRecord(res);
    return root.data !== undefined ? root.data : res;
  } catch {
    return {};
  }
}

async function resolveAccessUncached(): Promise<SleevelessUserAccess> {
  if (devBypass) {
    recordAccessDebug({
      source: "dev-bypass",
      loggedIn: true,
      hasSystemAccess: true,
      freeClaimed: false,
      planIds: [],
      unlockedViaJson: false,
      at: Date.now(),
    });
    return { loggedIn: true, hasSystemAccess: true, freeClaimed: false };
  }
  if (typeof window === "undefined") return LOGGED_OUT_SLEEVELESS_ACCESS;

  const loggedOut = (reason: string): SleevelessUserAccess => {
    recordAccessDebug({
      source: "logged-out",
      loggedIn: false,
      hasSystemAccess: false,
      freeClaimed: false,
      planIds: [],
      unlockedViaJson: false,
      reason,
      at: Date.now(),
    });
    return LOGGED_OUT_SLEEVELESS_ACCESS;
  };

  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return loggedOut("memberstack-dom-unavailable");

  let memberPayload: unknown;
  try {
    memberPayload = await ms.getCurrentMember();
  } catch {
    return loggedOut("getCurrentMember-error");
  }

  const memberId = memberIdFromMemberstackPayload(memberPayload);
  if (!memberId) return loggedOut("no-member-id");

  const planIds = planIdsFromMemberstackPayload(memberPayload);
  const memberJson = await readMemberJson(ms);
  const unlockedViaJson = readSleevelessSystemUnlockFromMemberJson(memberJson);
  const claim = readFreeClaimFromMemberJson(memberJson);

  const grantedByPlan = planIdsGrantSleevelessSystemAccess(planIds);
  const hasSystemAccess = grantedByPlan || unlockedViaJson;

  recordAccessDebug({
    source: grantedByPlan ? "memberstack-plan" : unlockedViaJson ? "member-json-unlock" : "free",
    loggedIn: true,
    hasSystemAccess,
    freeClaimed: claim.freeSleevelessPatternClaimed,
    freeClaimedPatternId: claim.freeSleevelessPatternId,
    memberId,
    planIds,
    unlockedViaJson,
    at: Date.now(),
  });

  return {
    loggedIn: true,
    memberId,
    hasSystemAccess,
    freeClaimed: claim.freeSleevelessPatternClaimed,
    freeClaimedPatternId: claim.freeSleevelessPatternId,
  };
}

/**
 * Resolve the visitor's Sleeveless access WITHOUT priming the shared sync cache or memoized promise.
 *
 * Use this when you only need a one-off access read and must not change the cached snapshot that
 * other cache-reading gates rely on (e.g. the saved-pattern Copy gate falls back to an open default
 * until the cache is primed; priming it here would silently change unrelated UI). Each call performs
 * a fresh Memberstack read, so prefer {@link resolveSleevelessUserAccess} on hot paths.
 */
export function resolveSleevelessUserAccessSnapshot(): Promise<SleevelessUserAccess> {
  return resolveAccessUncached();
}

/** Resolve the visitor's Sleeveless access (memoized per page load). Primes the sync cache. */
export function resolveSleevelessUserAccess(): Promise<SleevelessUserAccess> {
  if (typeof window === "undefined") return resolveAccessUncached();
  if (!window.__KBM_SLEEVELESS_ACCESS_PROMISE__) {
    window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = resolveAccessUncached().then((access) => {
      window.__KBM_SLEEVELESS_ACCESS__ = access;
      return access;
    });
  }
  return window.__KBM_SLEEVELESS_ACCESS_PROMISE__;
}

/** Last resolved access snapshot, or null before resolution completes. */
export function getCachedSleevelessUserAccess(): SleevelessUserAccess | null {
  if (typeof window === "undefined") return null;
  return window.__KBM_SLEEVELESS_ACCESS__ ?? null;
}

/** Clears the cache so the next resolve re-reads Memberstack (on login/logout). */
export function invalidateSleevelessUserAccessCache(): void {
  if (typeof window === "undefined") return;
  window.__KBM_SLEEVELESS_ACCESS__ = undefined;
  window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = undefined;
}

/**
 * Records that the account has used its one-time pattern creation allowance, in Memberstack member
 * JSON (account-tied). Callers invoke this on the first saved pattern only. Updates the local cache.
 */
export async function markFreeSleevelessPatternClaimed(patternId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const ms = window.$memberstackDom;
  if (!ms || typeof ms.getMemberJSON !== "function" || typeof ms.updateMemberJSON !== "function") {
    return false;
  }

  try {
    const current = await readMemberJson(ms);
    const merged = mergeFreeClaimIntoMemberJson(current, {
      freeSleevelessPatternClaimed: true,
      freeSleevelessPatternId: patternId,
    });
    await ms.updateMemberJSON({ json: merged });

    const prev = getCachedSleevelessUserAccess();
    if (prev) {
      const next: SleevelessUserAccess = {
        ...prev,
        freeClaimed: true,
        freeClaimedPatternId: patternId,
      };
      window.__KBM_SLEEVELESS_ACCESS__ = next;
      window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = Promise.resolve(next);
    }
    return true;
  } catch {
    return false;
  }
}

/** Result of an admin/support free-claim reset attempt. */
export interface ResetFreeSleevelessClaimResult {
  ok: boolean;
  /** Memberstack member id whose claim was reset (when resolvable). */
  memberId?: string;
  /** Why the reset could not be performed (failure only). */
  reason?: string;
}

/**
 * ADMIN/SUPPORT ONLY. Clears the one-time free Sleeveless Pattern claim for the CURRENTLY logged-in
 * Memberstack member by writing `freeSleevelessPatternClaimed: false` / `freeSleevelessPatternId: null`
 * back to member JSON (all other keys preserved). Invalidates the access cache so the next resolve
 * re-reads Memberstack. This is a deliberately small, current-member-only reset for testing/support —
 * it does NOT look up other members.
 */
export async function resetFreeSleevelessPatternClaimForCurrentMember(): Promise<ResetFreeSleevelessClaimResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "no-window" };
  }
  const ms = window.$memberstackDom;
  if (!ms || typeof ms.getMemberJSON !== "function" || typeof ms.updateMemberJSON !== "function") {
    return { ok: false, reason: "memberstack-json-unavailable" };
  }

  let memberId: string | undefined;
  try {
    if (typeof ms.getCurrentMember === "function") {
      memberId = memberIdFromMemberstackPayload(await ms.getCurrentMember());
    }
  } catch {
    memberId = undefined;
  }
  if (!memberId) {
    return { ok: false, reason: "no-member-id" };
  }

  try {
    const current = await readMemberJson(ms);
    const merged = mergeFreeClaimResetIntoMemberJson(current);
    await ms.updateMemberJSON({ json: merged });
    invalidateSleevelessUserAccessCache();
    return { ok: true, memberId };
  } catch {
    return { ok: false, memberId, reason: "update-failed" };
  }
}

export { hasSystemAccessRule as hasSleevelessPatternSystemAccess };
