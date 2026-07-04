/**
 * Video access — thin wrapper around the global member-access helper.
 *
 * Videos no longer maintain their own plan list. Everything routes through
 * `src/lib/memberAccess.ts`, which uses the global allow list (`MEMBER_PLAN_IDS`
 * from `src/config/memberships.ts`). Kept for backwards compatibility with the
 * many `hasKinVideoAccess` / `logKinVideoAccessDebug` call sites.
 */
import { MEMBER_PLAN_IDS } from "../config/memberships";
import {
  getActivePlanIds,
  hasMemberAccess,
  isActiveMemberstackPlanConnection,
  MEMBER_ACCESS_PLAN_IDS,
} from "./memberAccess";
import { memberEmailFromMemberstackPayload } from "./patterns/memberstackMember";

/**
 * @deprecated Use `MEMBER_ACCESS_PLAN_IDS` from `memberAccess`.
 * Alias kept so existing imports keep compiling; it is the same global list.
 */
export const VIDEO_MEMBERSHIP_PLAN_IDS = MEMBER_ACCESS_PLAN_IDS;

export { isActiveMemberstackPlanConnection };

/** @deprecated Use `getActivePlanIds` from `memberAccess`. */
export function activeVideoPlanIdsFromMemberPayload(memberOrPayload: unknown): string[] {
  return getActivePlanIds(memberOrPayload);
}

/**
 * @deprecated Use `hasMemberAccess` from `memberAccess`.
 * True when the member has an active beta, basic, premium, or legacy plan.
 */
export function hasKinVideoAccess(memberOrPayload: unknown): boolean {
  return hasMemberAccess(memberOrPayload);
}

/** Temporary: console debug for video plan gating (remove after verification). */
export function logKinVideoAccessDebug(
  context: string,
  opts: {
    member: unknown;
    rawKinAccess?: unknown;
    finalHasVideoAccess: boolean;
  },
): void {
  const { member, rawKinAccess, finalHasVideoAccess } = opts;
  const activePlanIds = getActivePlanIds(member);
  console.log("[KBM video access debug]", context, {
    memberEmail: memberEmailFromMemberstackPayload(member) ?? null,
    activePlanIds,
    allowedVideoPlanIds: [...MEMBER_ACCESS_PLAN_IDS],
    rawKinAccess,
    finalHasVideoAccess,
  });
}

export { MEMBER_PLAN_IDS };
