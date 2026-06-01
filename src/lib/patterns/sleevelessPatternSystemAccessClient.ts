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
  planIdsGrantSleevelessSystemAccess,
  readFreeClaimFromMemberJson,
  readSleevelessSystemUnlockFromMemberJson,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";

type MemberstackDom = NonNullable<Window["$memberstackDom"]>;

declare global {
  interface Window {
    /** Last resolved Sleeveless access snapshot (sync read for access-gate fallbacks). */
    __KBM_SLEEVELESS_ACCESS__?: SleevelessUserAccess;
    /** In-flight resolution promise, memoized per page load. */
    __KBM_SLEEVELESS_ACCESS_PROMISE__?: Promise<SleevelessUserAccess>;
  }
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
    return { loggedIn: true, hasSystemAccess: true, freeClaimed: false };
  }
  if (typeof window === "undefined") return LOGGED_OUT_SLEEVELESS_ACCESS;

  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return LOGGED_OUT_SLEEVELESS_ACCESS;

  let memberPayload: unknown;
  try {
    memberPayload = await ms.getCurrentMember();
  } catch {
    return LOGGED_OUT_SLEEVELESS_ACCESS;
  }

  const memberId = memberIdFromMemberstackPayload(memberPayload);
  if (!memberId) return LOGGED_OUT_SLEEVELESS_ACCESS;

  const planIds = planIdsFromMemberstackPayload(memberPayload);
  const memberJson = await readMemberJson(ms);
  const unlockedViaJson = readSleevelessSystemUnlockFromMemberJson(memberJson);
  const claim = readFreeClaimFromMemberJson(memberJson);

  return {
    loggedIn: true,
    memberId,
    hasSystemAccess: planIdsGrantSleevelessSystemAccess(planIds) || unlockedViaJson,
    freeClaimed: claim.freeSleevelessPatternClaimed,
    freeClaimedPatternId: claim.freeSleevelessPatternId,
  };
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

export { hasSystemAccessRule as hasSleevelessPatternSystemAccess };
