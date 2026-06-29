import { VIDEO_MEMBERSHIP_PLAN_IDS } from "../config/memberships";

const allowedPlanIds = new Set<string>(VIDEO_MEMBERSHIP_PLAN_IDS);

function memberRecordFromPayload(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;

  if (Array.isArray(root.planConnections) || root.customFields !== undefined) {
    return root;
  }

  const data = root.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    if (dataObj.member && typeof dataObj.member === "object") {
      return dataObj.member as Record<string, unknown>;
    }
    return dataObj;
  }

  return root;
}

/**
 * True when the member has an active basic or premium plan.
 * Login alone, beta, and no-plan accounts do not grant access.
 */
export function hasKinVideoAccess(memberOrPayload: unknown): boolean {
  const member = memberRecordFromPayload(memberOrPayload);
  if (!member) return false;

  const connections = Array.isArray(member.planConnections)
    ? (member.planConnections as Record<string, unknown>[])
    : [];

  for (const conn of connections) {
    const status = String(conn?.status ?? "").toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TRIALING") continue;

    const planId = typeof conn?.planId === "string" ? conn.planId.trim() : "";
    if (planId && allowedPlanIds.has(planId)) return true;
  }

  return false;
}

/** Temporary: console debug for video plan gating (remove after verification). */
export function logKinVideoAccessDebug(
  context: string,
  opts: {
    member: unknown;
    rawKinAccess: unknown;
    finalHasVideoAccess: boolean;
  },
): void {
  const { member, rawKinAccess, finalHasVideoAccess } = opts;
  const memberRecord = memberRecordFromPayload(member);
  const planConnections = Array.isArray(memberRecord?.planConnections)
    ? (memberRecord!.planConnections as Record<string, unknown>[])
    : [];
  console.log("[KBM video access debug]", context, {
    memberExists: Boolean(memberRecord),
    planConnections,
    rawKinAccess,
    finalHasVideoAccess,
  });
}
