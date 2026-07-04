/**
 * Global membership access — the single source of truth for member-only gating.
 *
 * The GLOBAL RULE (used by every gated section: videos, tools, skill builders,
 * stitches/downloads, custom pattern systems, …):
 *
 *   Member access is granted only when the visitor is LOGGED IN **and** has at
 *   least one ACTIVE plan connection whose planId is in the global allow list
 *   (`MEMBER_ACCESS_PLAN_IDS`). Beta access counts as member access. Login alone
 *   never grants member access.
 *
 * The allow list itself lives in `src/config/memberships.ts` (`MEMBER_PLAN_IDS`)
 * so beta, basic, premium, legacy, and any future allowed plans are all
 * controlled from one place. Do NOT keep a separate plan list in any section.
 */
import { MEMBER_PLAN_IDS } from "../config/memberships";
import {
  memberEmailFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

/** Global allow list of Memberstack plan ids that grant member access. */
export const MEMBER_ACCESS_PLAN_IDS = MEMBER_PLAN_IDS;

export { MEMBER_PLAN_IDS };

const allowedPlanIds = new Set<string>(MEMBER_ACCESS_PLAN_IDS);

/** Resolved viewer state for any gated area. */
export type ViewerAccessState = "loggedOut" | "loggedInNoAccess" | "memberAccess";

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

/** True when a Memberstack plan connection is currently entitled (not canceled/expired). */
export function isActiveMemberstackPlanConnection(conn: unknown): boolean {
  const record = asRecord(conn);
  if (record.active === false) return false;

  const status = String(record.status ?? "").trim().toUpperCase();
  if (!status) return true;
  return status === "ACTIVE" || status === "TRIALING";
}

/**
 * All ACTIVE plan ids from a Memberstack member payload (`getCurrentMember`,
 * `getAppAndMember`, or a bare member record). Canceled/expired connections are
 * excluded.
 */
export function getActivePlanIds(memberOrPayload: unknown): string[] {
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

/** True when the payload represents a logged-in Memberstack member (has a member id). */
export function isMemberLoggedIn(memberOrPayload: unknown): boolean {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return false;
  const id = member.id ?? member._id;
  return typeof id === "string" ? Boolean(id.trim()) : Boolean(id);
}

/**
 * The global member-access check. True only when the viewer is logged in AND has
 * at least one active plan connection in the global allow list (beta included).
 */
export function hasMemberAccess(memberOrPayload: unknown): boolean {
  return getActivePlanIds(memberOrPayload).some((id) => allowedPlanIds.has(id));
}

/**
 * Resolved viewer state for a gated area:
 *   - `loggedOut`        ? prompt to log in
 *   - `loggedInNoAccess` ? prompt to become a member
 *   - `memberAccess`     ? unlock content
 */
export function getViewerAccessState(memberOrPayload: unknown): ViewerAccessState {
  if (!isMemberLoggedIn(memberOrPayload)) return "loggedOut";
  return hasMemberAccess(memberOrPayload) ? "memberAccess" : "loggedInNoAccess";
}

/**
 * Temporary: console debug for the global member gate (remove after verification).
 * Logs the member email, active plan ids found, whether access was granted, and
 * which gate/component made the decision.
 */
export function logMemberAccessDebug(
  gate: string,
  memberOrPayload: unknown,
  extra?: Record<string, unknown>,
): void {
  const activePlanIds = getActivePlanIds(memberOrPayload);
  console.log("[KIN member access]", {
    gate,
    memberEmail: memberEmailFromMemberstackPayload(memberOrPayload) ?? null,
    activePlanIds,
    allowedPlanIds: [...MEMBER_ACCESS_PLAN_IDS],
    hasMemberAccess: hasMemberAccess(memberOrPayload),
    viewerAccessState: getViewerAccessState(memberOrPayload),
    ...(extra ?? {}),
  });
}
