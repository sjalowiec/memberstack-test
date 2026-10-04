/**
 * Removes an expired complimentary plan connection from Memberstack.
 *
 * The access gate already denies a saved access-through date that is before
 * today in America/Los_Angeles. This job only removes
 * `pln_complimentary-membership-30-days-ai28093g` so the Memberstack record
 * matches. It does not remove paid plans or the legacy membership plan.
 * The access-through day itself is still valid.
 */
import { COMPLIMENTARY_MEMBERSHIPS } from "../../config/memberships";
import { getActivePlanIds } from "../memberAccess";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import { getMemberstackAdminClient } from "../../../netlify/functions/lib/memberstack-admin.js";
import {
  EXPIRED_COMPLIMENTARY_ACCESS_SQL,
  type ComplimentaryAccessRow,
} from "./complimentaryAccess";
import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";

export const COMPLIMENTARY_PLAN_ID =
  COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;

export type ComplimentaryExpiryDecision = "remove" | "already_removed";

/** Remove the complimentary plan when it is still active. Paid plans are left alone. */
export function decideComplimentaryPlanAction(
  member: MemberstackMember,
): ComplimentaryExpiryDecision {
  const activePlanIds = getActivePlanIds({ data: member });
  if (!activePlanIds.includes(COMPLIMENTARY_PLAN_ID)) return "already_removed";
  return "remove";
}

export type RemoveComplimentaryPlan = (memberId: string, planId: string) => Promise<void>;

export type LoadExpiredComplimentaryRows = (
  todayLosAngelesYmd: string,
) => Promise<ComplimentaryAccessRow[]>;

export type LoadMemberstackMemberById = (
  memberstackId: string,
) => Promise<MemberstackMember | null>;

export interface ComplimentaryExpiryDetail {
  memberstackId: string;
  accessThrough: string | null;
  outcome: "removed" | "already_removed" | "not_found" | "failure";
  reason?: string;
  error?: string;
}

export interface ComplimentaryExpiryResult {
  ok: boolean;
  dryRun: boolean;
  todayLosAngeles: string;
  triggerSource: "manual" | "scheduled";
  candidatesFound: number;
  complimentaryPlansRemoved: number;
  skippedAlreadyRemoved: number;
  skippedNotFound: number;
  failures: number;
  details: ComplimentaryExpiryDetail[];
  errorMessage: string | null;
}

export async function defaultRemoveComplimentaryPlan(
  memberId: string,
  planId: string,
): Promise<void> {
  const client = getMemberstackAdminClient() as {
    removePlan?: (memberId: string, planId: string) => Promise<unknown>;
  } | null;
  if (!client || typeof client.removePlan !== "function") {
    throw new Error("Memberstack admin API is not configured for removePlan.");
  }
  await client.removePlan(memberId, planId);
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

function ymdFromRow(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

/**
 * For each Watson complimentary date before today, remove only the complimentary
 * plan. Members who also have a paid plan keep that paid plan and its access.
 */
export async function runComplimentaryExpiry(
  options: {
    dryRun?: boolean;
    triggerSource?: "manual" | "scheduled";
    now?: Date;
    queryFn?: WatsonQueryFn;
    loadExpiredRows?: LoadExpiredComplimentaryRows;
    loadMember?: LoadMemberstackMemberById;
    removeComplimentaryPlan?: RemoveComplimentaryPlan;
  } = {},
): Promise<ComplimentaryExpiryResult> {
  const now = options.now ?? new Date();
  const todayLosAngeles = calendarYmdForNow(now, MEMBERSHIP_STATUS_CALENDAR_TIMEZONE);
  const dryRun = options.dryRun ?? true;
  const queryFn = options.queryFn ?? queryWatson;
  const loadExpiredRows =
    options.loadExpiredRows ??
    (async (today) => queryFn<ComplimentaryAccessRow>(EXPIRED_COMPLIMENTARY_ACCESS_SQL, [today]));
  const removeComplimentaryPlan = options.removeComplimentaryPlan ?? defaultRemoveComplimentaryPlan;
  const loadMember =
    options.loadMember ??
    (async (memberstackId: string) => {
      const client = getMemberstackAdminClient();
      if (!client?.getMember) {
        throw new Error("Memberstack admin API is not configured.");
      }
      const record = await client.getMember(memberstackId);
      if (!record || typeof record !== "object") return null;
      return record as MemberstackMember;
    });

  const result: ComplimentaryExpiryResult = {
    ok: false,
    dryRun,
    todayLosAngeles,
    triggerSource: options.triggerSource ?? "manual",
    candidatesFound: 0,
    complimentaryPlansRemoved: 0,
    skippedAlreadyRemoved: 0,
    skippedNotFound: 0,
    failures: 0,
    details: [],
    errorMessage: null,
  };

  try {
    const rows = await loadExpiredRows(todayLosAngeles);
    result.candidatesFound = rows.length;

    for (const row of rows) {
      const memberstackId = row.memberstack_id;
      const accessThrough = ymdFromRow(row.access_through);
      try {
        const member = await loadMember(memberstackId);
        if (!member) {
          result.skippedNotFound += 1;
          result.details.push({
            memberstackId,
            accessThrough,
            outcome: "not_found",
            reason: "memberstack_not_found",
          });
          continue;
        }

        const decision = decideComplimentaryPlanAction(member);
        if (decision === "already_removed") {
          result.skippedAlreadyRemoved += 1;
          result.details.push({
            memberstackId,
            accessThrough,
            outcome: "already_removed",
            reason: "complimentary_plan_not_active",
          });
          continue;
        }

        if (!dryRun) {
          await removeComplimentaryPlan(member.id || memberstackId, COMPLIMENTARY_PLAN_ID);
        }
        result.complimentaryPlansRemoved += 1;
        result.details.push({
          memberstackId,
          accessThrough,
          outcome: "removed",
          reason: dryRun ? "would_remove" : "removed",
        });
      } catch (error) {
        result.failures += 1;
        result.details.push({
          memberstackId,
          accessThrough,
          outcome: "failure",
          error: sanitizeError(error),
        });
      }
    }

    result.ok = true;
    return result;
  } catch (error) {
    result.errorMessage = sanitizeError(error);
    return result;
  }
}
