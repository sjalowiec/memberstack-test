/**
 * Memberstack-backed resolver for {@link SleevelessUserAccess}.
 *
 * Per-system free claims are stored on Memberstack member JSON (`getMemberJSON` /
 * `updateMemberJSON`) — account-tied, not localStorage.
 */
import { getActivePlanIds } from "../memberAccess";
import { devBypass } from "../devBypass";
import { memberIdFromMemberstackPayload } from "./memberstackMember";
import { logPatternEditGateDebug } from "./patternEditGateDebug";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";
import {
  mergeFreeClaimForSystemIntoMemberJson,
  mergeAllFreeClaimsResetIntoMemberJson,
  readFreeClaimsBySystemFromMemberJson,
} from "./patternSystemFreeClaim";
import type { PatternSystemId } from "./patternSystemId";
import {
  computeHasSystemAccessFlag,
  hasSleevelessPatternSystemAccess as hasSystemAccessRule,
  LOGGED_OUT_SLEEVELESS_ACCESS,
  readSleevelessSystemUnlockFromMemberJson,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

type MemberstackDom = NonNullable<Window["$memberstackDom"]>;

export type SleevelessAccessSource =
  | "dev-bypass"
  | "memberstack-plan"
  | "member-json-unlock"
  | "free"
  | "logged-out";

export interface SleevelessAccessDebug {
  source: SleevelessAccessSource;
  loggedIn: boolean;
  hasSystemAccess: boolean;
  freeClaimsBySystem: SleevelessUserAccess["freeClaimsBySystem"];
  memberId?: string;
  planIds: string[];
  unlockedViaJson: boolean;
  reason?: string;
  at: number;
}

declare global {
  interface Window {
    __KBM_SLEEVELESS_ACCESS__?: SleevelessUserAccess;
    __KBM_SLEEVELESS_ACCESS_PROMISE__?: Promise<SleevelessUserAccess>;
    __KBM_SLEEVELESS_ACCESS_DEBUG__?: SleevelessAccessDebug;
  }
}

function recordAccessDebug(debug: SleevelessAccessDebug): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env?.DEV) return;
  window.__KBM_SLEEVELESS_ACCESS_DEBUG__ = debug;
}

export function getSleevelessAccessDebug(): SleevelessAccessDebug | null {
  if (typeof window === "undefined") return null;
  return window.__KBM_SLEEVELESS_ACCESS_DEBUG__ ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function devBypassAccessSnapshot(): SleevelessUserAccess {
  const access: SleevelessUserAccess = {
    loggedIn: true,
    activePlanIds: [],
    hasSystemAccess: true,
    freeClaimsBySystem: {},
  };
  recordAccessDebug({
    source: "dev-bypass",
    loggedIn: true,
    hasSystemAccess: true,
    freeClaimsBySystem: {},
    planIds: [],
    unlockedViaJson: false,
    at: Date.now(),
  });
  return access;
}

function loggedOutAccessSnapshot(reason: string): SleevelessUserAccess {
  recordAccessDebug({
    source: "logged-out",
    loggedIn: false,
    hasSystemAccess: false,
    freeClaimsBySystem: {},
    planIds: [],
    unlockedViaJson: false,
    reason,
    at: Date.now(),
  });
  return LOGGED_OUT_SLEEVELESS_ACCESS;
}

function resolveAccessSource(
  activePlanIds: readonly string[],
  sleevelessUnlockedViaJson: boolean,
): SleevelessAccessSource {
  const snapshot: SleevelessUserAccess = {
    loggedIn: true,
    activePlanIds,
    sleevelessUnlockedViaJson,
    hasSystemAccess: false,
    freeClaimsBySystem: {},
  };
  if (hasSystemAccessRule(snapshot, "sleeveless") || hasSystemAccessRule(snapshot, "drop-shoulder")) {
    if (activePlanIds.length > 0) return "memberstack-plan";
    if (sleevelessUnlockedViaJson) return "member-json-unlock";
  }
  return "free";
}

async function resolveMemberstackAccess(ms: MemberstackDom): Promise<SleevelessUserAccess | null> {
  let memberPayload: unknown;
  try {
    memberPayload = await ms.getCurrentMember();
  } catch {
    return null;
  }

  const memberId = memberIdFromMemberstackPayload(memberPayload);
  if (!memberId) return null;

  const activePlanIds = getActivePlanIds(memberPayload);
  const memberJson = await readMemberJson(ms);
  const sleevelessUnlockedViaJson = readSleevelessSystemUnlockFromMemberJson(memberJson);
  const freeClaimsBySystem = readFreeClaimsBySystemFromMemberJson(memberJson);

  const base = {
    loggedIn: true as const,
    memberId,
    activePlanIds,
    sleevelessUnlockedViaJson,
    freeClaimsBySystem,
  };
  const hasSystemAccess = computeHasSystemAccessFlag(base);

  recordAccessDebug({
    source: resolveAccessSource(activePlanIds, sleevelessUnlockedViaJson),
    loggedIn: true,
    hasSystemAccess,
    freeClaimsBySystem,
    memberId,
    planIds: [...activePlanIds],
    unlockedViaJson: sleevelessUnlockedViaJson,
    at: Date.now(),
  });

  return {
    ...base,
    hasSystemAccess,
  };
}

async function resolveAccessUncached(): Promise<SleevelessUserAccess> {
  if (typeof window === "undefined") return LOGGED_OUT_SLEEVELESS_ACCESS;

  // Wait for Memberstack before resolving — avoids caching dev-bypass access on localhost
  // while a real nosub/member session is still loading.
  await waitForMemberstackDom();

  const ms = window.$memberstackDom;
  if (ms?.getCurrentMember) {
    // Also wait for the session to be RESTORED (not just the method to exist) so a member
    // returning right after a login reload — when `member.login` does not fire — is not read as
    // logged-out and cached that way, which would block them from creating their first pattern.
    await waitForMemberstackReady(ms);
    const memberAccess = await resolveMemberstackAccess(ms);
    if (memberAccess) return memberAccess;
  }

  if (devBypass) {
    logPatternEditGateDebug("resolveAccessUncached.dev-bypass-fallback", {
      accessSource: "dev-bypass",
      extra: { memberstackReady: Boolean(ms?.getCurrentMember) },
    });
    return devBypassAccessSnapshot();
  }

  if (!ms?.getCurrentMember) return loggedOutAccessSnapshot("memberstack-dom-unavailable");
  return loggedOutAccessSnapshot("no-member-id");
}

export function resolveSleevelessUserAccessSnapshot(): Promise<SleevelessUserAccess> {
  return resolveAccessUncached();
}

export function resolveSleevelessUserAccess(): Promise<SleevelessUserAccess> {
  if (typeof window === "undefined") return resolveAccessUncached();
  if (!window.__KBM_SLEEVELESS_ACCESS_PROMISE__) {
    window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = resolveAccessUncached().then((access) => {
      window.__KBM_SLEEVELESS_ACCESS__ = access;
      return access;
    });
    wireMemberstackAccessCacheInvalidation();
  }
  return window.__KBM_SLEEVELESS_ACCESS_PROMISE__;
}

let memberstackAccessInvalidationWired = false;

function wireMemberstackAccessCacheInvalidation(): void {
  if (memberstackAccessInvalidationWired || typeof window === "undefined") return;
  memberstackAccessInvalidationWired = true;

  const rebind = (): void => {
    invalidateSleevelessUserAccessCache();
    logPatternEditGateDebug("access-cache.invalidated", {
      extra: { reason: "memberstack-auth-change" },
    });
  };

  void waitForMemberstackDom().then(() => {
    const ms = window.$memberstackDom;
    if (ms && typeof ms.on === "function") {
      ms.on("member.login", rebind);
      ms.on("member.logout", rebind);
    }
  });
}

export function getCachedSleevelessUserAccess(): SleevelessUserAccess | null {
  if (typeof window === "undefined") return null;
  return window.__KBM_SLEEVELESS_ACCESS__ ?? null;
}

export function invalidateSleevelessUserAccessCache(): void {
  if (typeof window === "undefined") return;
  window.__KBM_SLEEVELESS_ACCESS__ = undefined;
  window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = undefined;
}

/**
 * Records that the account has used its one-time free pattern allowance for a pattern system.
 * Updates the local cache.
 */
export async function markFreePatternClaimedForSystem(
  systemId: PatternSystemId,
  patternId: string,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const ms = window.$memberstackDom;
  if (!ms || typeof ms.getMemberJSON !== "function" || typeof ms.updateMemberJSON !== "function") {
    return false;
  }

  try {
    const current = await readMemberJson(ms);
    const merged = mergeFreeClaimForSystemIntoMemberJson(current, systemId, patternId);
    await ms.updateMemberJSON({ json: merged });

    const prev = getCachedSleevelessUserAccess();
    if (prev) {
      const nextClaims = readFreeClaimsBySystemFromMemberJson(merged);
      const next: SleevelessUserAccess = {
        ...prev,
        freeClaimsBySystem: nextClaims,
      };
      window.__KBM_SLEEVELESS_ACCESS__ = next;
      window.__KBM_SLEEVELESS_ACCESS_PROMISE__ = Promise.resolve(next);
    }
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Use {@link markFreePatternClaimedForSystem}. */
export async function markFreeSleevelessPatternClaimed(patternId: string): Promise<boolean> {
  return markFreePatternClaimedForSystem("sleeveless", patternId);
}

export interface ResetFreeSleevelessClaimResult {
  ok: boolean;
  memberId?: string;
  reason?: string;
}

/** ADMIN/SUPPORT ONLY — clears all per-system free claims for the current member. */
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
    const merged = mergeAllFreeClaimsResetIntoMemberJson(current);
    await ms.updateMemberJSON({ json: merged });
    invalidateSleevelessUserAccessCache();
    return { ok: true, memberId };
  } catch {
    return { ok: false, memberId, reason: "update-failed" };
  }
}

export { hasSystemAccessRule as hasSleevelessPatternSystemAccess };
