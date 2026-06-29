import {
  MEMBER_PLAN_IDS,
  MEMBERSHIPS,
  VIDEO_MEMBERSHIP_PLAN_IDS,
} from "../config/memberships";
import {
  memberEmailFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

const allowedPlanIds = new Set<string>(VIDEO_MEMBERSHIP_PLAN_IDS);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function planIdFromConnection(conn: Record<string, unknown>): string {
  for (const key of ["planId", "plan", "id"] as const) {
    const value = conn[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** True when a Memberstack plan connection is currently entitled (not canceled). */
export function isActiveMemberstackPlanConnection(conn: unknown): boolean {
  const record = asRecord(conn);
  if (record.active === false) return false;

  const status = String(record.status ?? "").trim().toUpperCase();
  if (!status) return true;
  return status === "ACTIVE" || status === "TRIALING";
}

/** Active plan ids from a Memberstack member payload (`getCurrentMember`, `getAppAndMember`, etc.). */
export function activeVideoPlanIdsFromMemberPayload(memberOrPayload: unknown): string[] {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return [];

  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member.planConnections ?? data.planConnections;
  if (!Array.isArray(connections)) return [];

  const ids: string[] = [];
  for (const conn of connections) {
    const record = asRecord(conn);
    if (!isActiveMemberstackPlanConnection(record)) continue;
    const planId = planIdFromConnection(record);
    if (planId) ids.push(planId);
  }
  return ids;
}

/**
 * True when the member has an active beta, basic, or premium plan.
 * Login alone and no-plan accounts do not grant access.
 */
export function hasKinVideoAccess(memberOrPayload: unknown): boolean {
  return activeVideoPlanIdsFromMemberPayload(memberOrPayload).some((id) =>
    allowedPlanIds.has(id),
  );
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
  const activePlanIds = activeVideoPlanIdsFromMemberPayload(member);
  console.log("[KBM video access debug]", context, {
    memberEmail: memberEmailFromMemberstackPayload(member) ?? null,
    activePlanIds,
    allowedVideoPlanIds: [...VIDEO_MEMBERSHIP_PLAN_IDS],
    rawKinAccess,
    finalHasVideoAccess,
  });
}

export { MEMBER_PLAN_IDS, VIDEO_MEMBERSHIP_PLAN_IDS };
