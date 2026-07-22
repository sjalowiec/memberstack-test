/**
 * Resolve Membership Corner CTA label + destination from Memberstack state.
 *
 * Restart Membership is gated behind MEMBERSHIP_CORNER_RESTART_ENABLED until
 * sandbox confirms canceled/expired paid planConnections appear on the DOM payload.
 */

import {
  isActiveMemberstackPlanConnection,
  isMemberLoggedIn,
} from "../memberAccess";
import { memberRecordFromMemberstackPayload } from "../patterns/memberstackMember";
import {
  PAID_MEMBERSHIP_PLAN_IDS,
  memberHasActivePaidMembership,
} from "./membershipCheckoutDecision";
import { isCanceledConnectionStatus } from "./membershipSummary";

export type MembershipCornerCtaKind = "become" | "restart" | "manage";

export type MembershipCornerCta = {
  kind: MembershipCornerCtaKind;
  label: string;
  href: string;
};

/** Flip to true after sandbox confirms canceled paid planConnections on getAppAndMember. */
export const MEMBERSHIP_CORNER_RESTART_ENABLED = false;

export const MEMBERSHIP_CORNER_CTA = {
  become: {
    kind: "become",
    label: "Become a Member",
    href: "/membership",
  },
  restart: {
    kind: "restart",
    label: "Restart Membership",
    href: "/membership",
  },
  manage: {
    kind: "manage",
    label: "Manage Membership",
    href: "/account#membership",
  },
} as const satisfies Record<MembershipCornerCtaKind, MembershipCornerCta>;

const paidPlanIdSet = new Set<string>(PAID_MEMBERSHIP_PLAN_IDS);

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

function planConnectionsFromPayload(memberOrPayload: unknown): unknown[] {
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  if (!member) return [];
  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member.planConnections ?? data.planConnections;
  return Array.isArray(connections) ? connections : [];
}

/**
 * Positive evidence only: a known paid membership connection that is not
 * currently entitled and has an explicit canceled/expired status.
 * Never infer from "no active plan" alone.
 */
export function memberHasCanceledPaidMembership(memberOrPayload: unknown): boolean {
  if (!isMemberLoggedIn(memberOrPayload)) return false;

  for (const conn of planConnectionsFromPayload(memberOrPayload)) {
    const record = asRecord(conn);
    const planId = planIdFromConnection(record);
    if (!planId || !paidPlanIdSet.has(planId)) continue;
    if (isActiveMemberstackPlanConnection(record)) continue;
    const status = String(record.status ?? "").trim();
    if (status && isCanceledConnectionStatus(status)) return true;
  }
  return false;
}

export function resolveMembershipCornerCta(memberOrPayload: unknown): MembershipCornerCta {
  if (isMemberLoggedIn(memberOrPayload)) {
    if (memberHasActivePaidMembership(memberOrPayload)) {
      return { ...MEMBERSHIP_CORNER_CTA.manage };
    }
    if (MEMBERSHIP_CORNER_RESTART_ENABLED && memberHasCanceledPaidMembership(memberOrPayload)) {
      return { ...MEMBERSHIP_CORNER_CTA.restart };
    }
  }

  return { ...MEMBERSHIP_CORNER_CTA.become };
}
