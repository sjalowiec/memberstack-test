/**
 * Legacy annual membership expiration reconciliation.
 *
 * Legacy annual members were imported into Memberstack with the free
 * "legacy membership" access plan (`pln_legacy-membership-t012x0xw0`) but have no
 * Stripe subscription. Their paid-through date lives only in Watson
 * (`legacy_members.subscriptionexpiring`). Because Memberstack plan connections
 * are authoritative for site access (`hasMemberAccess`), an expired annual member
 * keeps full access forever until the free plan connection is removed.
 *
 * This module reconciles that gap: it finds legacy members whose Watson
 * paid-through date has passed (America/Los_Angeles calendar day) and removes the
 * free legacy plan from their Memberstack record - but only when the member does
 * not also hold another active paid membership (a renewed member keeps access).
 *
 * Access enforcement stays in Memberstack: this process only removes plan
 * connections. It never changes `hasMemberAccess` and never grants access.
 *
 * The calendar rule matches the membership status API
 * (`membershipStatusSummary.ts`): the paid-through date itself still has access;
 * expiration happens only when `subscriptionexpiring::date` is strictly earlier
 * than today in America/Los_Angeles.
 */
import { getMemberstackAdminClient } from "../../../netlify/functions/lib/memberstack-admin.js";
import { FREE_ACCESS_MEMBERSHIPS } from "../../config/memberships";
import { getActivePlanIds } from "../memberAccess";
import { memberHasActivePaidMembership } from "../membership/membershipCheckoutDecision";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import { fetchAllMembers } from "../membership/membershipSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import { normalizeCustomerEmail } from "./customerIdentifier";
import {
  getSharedMemberstackAdminClient,
  resolveMemberstackMemberByExactEmail,
} from "./customerMemberstack";
import { queryWatson } from "./db";
import type { WatsonQueryFn } from "./memberSearch";

/** The single free legacy membership access plan that this process may remove. */
export const LEGACY_ANNUAL_PLAN_ID =
  FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;

export type LegacyAnnualExpiryTrigger = "manual" | "scheduled";

/** One expired legacy member selected from Watson as a removal candidate. */
export interface ExpiredLegacyMemberCandidate {
  memberid: string;
  email: string | null;
  subscriptionexpiring: Date | string | null;
}

/**
 * Selects legacy members whose Watson paid-through date is strictly before the
 * supplied Los Angeles calendar day. The paid-through day itself is excluded
 * (still has access). The `$1::date` bind keeps the comparison on the business
 * calendar instead of the database server timezone.
 */
export const EXPIRED_LEGACY_MEMBERS_SQL = `
  SELECT
    m.memberid,
    m.email,
    m.subscriptionexpiring
  FROM legacy_members m
  WHERE m.subscriptionexpiring IS NOT NULL
    AND m.subscriptionexpiring::date < $1::date
  ORDER BY m.subscriptionexpiring ASC NULLS LAST, m.memberid ASC
`;

export async function loadExpiredLegacyAnnualCandidates(
  todayLosAngelesYmd: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ExpiredLegacyMemberCandidate[]> {
  return queryFn<ExpiredLegacyMemberCandidate>(EXPIRED_LEGACY_MEMBERS_SQL, [
    todayLosAngelesYmd,
  ]);
}

/** Per-member decision from the current Memberstack record (pure / testable). */
export type LegacyExpiryDecision = "remove" | "already_removed" | "active_paid";

/**
 * Decide what to do with a resolved Memberstack member.
 *
 * Order matters:
 *  1. Another active paid plan ? retain (a renewed member keeps access).
 *  2. No active legacy plan connection ? nothing to remove (idempotent).
 *  3. Otherwise ? remove the legacy plan.
 */
export function decideLegacyPlanAction(
  member: MemberstackMember,
): LegacyExpiryDecision {
  const payload = { data: member };
  if (memberHasActivePaidMembership(payload)) {
    return "active_paid";
  }
  const activePlanIds = getActivePlanIds(payload);
  if (!activePlanIds.includes(LEGACY_ANNUAL_PLAN_ID)) {
    return "already_removed";
  }
  return "remove";
}

/** Result of resolving a Watson email to a unique Memberstack member. */
export type MemberstackEmailResolution =
  | { status: "unique"; member: MemberstackMember }
  | { status: "not_found" }
  | { status: "ambiguous" }
  | { status: "error"; error: string };

export type ResolveMemberstackMemberByEmail = (
  email: string,
) => Promise<MemberstackEmailResolution>;

/** Bulk Memberstack member loader (single paged Admin `listMembers` scan). */
export type LoadMemberstackMembers = () => Promise<{
  members: MemberstackMember[];
  truncated: boolean;
}>;

export type RemoveLegacyPlan = (
  memberId: string,
  planId: string,
) => Promise<void>;

export type LegacyExpiryOutcome =
  | "removed"
  | "already_removed"
  | "active_paid"
  | "no_match"
  | "failure";

export interface LegacyAnnualExpiryDetail {
  legacyMemberId: string;
  email: string | null;
  memberstackId: string | null;
  outcome: LegacyExpiryOutcome;
  /** Short machine-readable reason for skips (e.g. "missing_email"). */
  reason?: string;
  /** Sanitized error message for failures only. */
  error?: string;
}

export interface LegacyAnnualExpiryResult {
  ok: boolean;
  dryRun: boolean;
  todayLosAngeles: string;
  triggerSource: LegacyAnnualExpiryTrigger;
  candidatesFound: number;
  /** Legacy plans removed (live), or that would be removed (dry-run). */
  legacyPlansRemoved: number;
  skippedAlreadyRemoved: number;
  skippedActivePaid: number;
  skippedNoUniqueMatch: number;
  failures: number;
  details: LegacyAnnualExpiryDetail[];
  errorMessage: string | null;
  completedAt: string | null;
}

export interface RunLegacyAnnualExpiryOptions {
  /** When true (default), report changes without modifying Memberstack. */
  dryRun?: boolean;
  triggerSource?: LegacyAnnualExpiryTrigger;
  /** Deterministic "now" for the LA calendar day (tests inject this). */
  now?: Date;
  queryFn?: WatsonQueryFn;
  /**
   * Per-email resolver (legacy path). When omitted, the run loads all
   * Memberstack members once via {@link loadMemberstackMembers} and resolves
   * candidates against an in-memory email index instead.
   */
  resolveMemberstackMemberByEmail?: ResolveMemberstackMemberByEmail;
  /** Bulk member loader (defaults to a single paged Admin `listMembers` scan). */
  loadMemberstackMembers?: LoadMemberstackMembers;
  removeLegacyPlan?: RemoveLegacyPlan;
}

/** Production email ? Memberstack member resolver (Admin API, exact email). */
export async function defaultResolveMemberstackMemberByEmail(
  email: string,
): Promise<MemberstackEmailResolution> {
  const result = await resolveMemberstackMemberByExactEmail(email);
  if (result.ok) {
    return { status: "unique", member: result.member };
  }
  if (result.status === "not_found") {
    return { status: "not_found" };
  }
  return { status: "error", error: result.error };
}

/**
 * Loads every Memberstack member once (paged Admin `listMembers`) so the
 * reconciliation can resolve Watson candidates from memory instead of issuing
 * one Admin `getMember` request per expired member. Building the Admin client
 * once here also avoids the repeated non-production secret-warning log that a
 * per-member client rebuild produced.
 */
export async function defaultLoadMemberstackMembers(): Promise<{
  members: MemberstackMember[];
  truncated: boolean;
}> {
  const client = await getSharedMemberstackAdminClient();
  if (!client) {
    throw new Error("Memberstack admin API is not configured.");
  }
  return fetchAllMembers(client);
}

/**
 * Index Memberstack members by normalized email. An email shared by more than
 * one distinct Memberstack member id is preserved so it can be treated as
 * ambiguous (skipped) rather than silently reconciled.
 */
export function buildMemberstackEmailIndex(
  members: MemberstackMember[],
): Map<string, MemberstackMember[]> {
  const index = new Map<string, MemberstackMember[]>();
  for (const member of members) {
    const normalizedEmail = normalizeCustomerEmail(member.auth?.email);
    if (!normalizedEmail) continue;
    const group = index.get(normalizedEmail) ?? [];
    group.push(member);
    index.set(normalizedEmail, group);
  }
  return index;
}

/** Resolve one normalized email against a prebuilt index (pure / testable). */
export function resolveMemberstackMemberFromIndex(
  index: Map<string, MemberstackMember[]>,
  normalizedEmail: string,
): MemberstackEmailResolution {
  const matches = index.get(normalizedEmail) ?? [];
  if (matches.length === 0) {
    return { status: "not_found" };
  }
  const distinctIds = new Set(matches.map((member) => member.id));
  if (distinctIds.size > 1) {
    return { status: "ambiguous" };
  }
  return { status: "unique", member: matches[0] };
}

/** Production legacy-plan remover (Memberstack Admin `remove-plan`). */
export async function defaultRemoveLegacyPlan(
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

/**
 * Reconcile expired legacy annual members against Memberstack.
 *
 * Idempotent: members whose legacy plan is already absent are counted as
 * "already removed", so repeated runs are safe. Per-member errors are captured
 * and never abort the batch.
 */
export async function runLegacyAnnualExpiry(
  options: RunLegacyAnnualExpiryOptions = {},
): Promise<LegacyAnnualExpiryResult> {
  const now = options.now ?? new Date();
  const todayLosAngeles = calendarYmdForNow(
    now,
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  const dryRun = options.dryRun ?? true;
  const triggerSource = options.triggerSource ?? "manual";
  const queryFn = options.queryFn ?? queryWatson;
  const removeLegacyPlan = options.removeLegacyPlan ?? defaultRemoveLegacyPlan;

  const result: LegacyAnnualExpiryResult = {
    ok: false,
    dryRun,
    todayLosAngeles,
    triggerSource,
    candidatesFound: 0,
    legacyPlansRemoved: 0,
    skippedAlreadyRemoved: 0,
    skippedActivePaid: 0,
    skippedNoUniqueMatch: 0,
    failures: 0,
    details: [],
    errorMessage: null,
    completedAt: null,
  };

  try {
    const candidates = await loadExpiredLegacyAnnualCandidates(
      todayLosAngeles,
      queryFn,
    );
    result.candidatesFound = candidates.length;

    // Group by normalized email so a single email shared by multiple distinct
    // legacy member rows is treated as ambiguous (skipped, not silently removed).
    const byEmail = new Map<string, ExpiredLegacyMemberCandidate[]>();
    for (const candidate of candidates) {
      const normalizedEmail = normalizeCustomerEmail(candidate.email);
      if (!normalizedEmail) {
        result.skippedNoUniqueMatch += 1;
        result.details.push({
          legacyMemberId: candidate.memberid,
          email: candidate.email,
          memberstackId: null,
          outcome: "no_match",
          reason: "missing_email",
        });
        continue;
      }
      const group = byEmail.get(normalizedEmail) ?? [];
      group.push(candidate);
      byEmail.set(normalizedEmail, group);
    }

    // Resolve Memberstack membership for the candidate emails. Default path:
    // load every Memberstack member once and reconcile against an in-memory
    // email index (one paged scan, not one Admin lookup per expired member).
    // An injected `resolveMemberstackMemberByEmail` keeps the legacy per-email
    // path available for tests.
    let resolveMember: ResolveMemberstackMemberByEmail;
    if (options.resolveMemberstackMemberByEmail) {
      resolveMember = options.resolveMemberstackMemberByEmail;
    } else if (byEmail.size === 0) {
      resolveMember = async () => ({ status: "not_found" });
    } else {
      const loadMembers =
        options.loadMemberstackMembers ?? defaultLoadMemberstackMembers;
      const { members } = await loadMembers();
      const index = buildMemberstackEmailIndex(members);
      resolveMember = async (email) =>
        resolveMemberstackMemberFromIndex(index, email);
    }

    for (const [email, group] of byEmail) {
      const distinctMemberIds = new Set(group.map((row) => row.memberid));
      if (distinctMemberIds.size > 1) {
        for (const candidate of group) {
          result.skippedNoUniqueMatch += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: null,
            outcome: "no_match",
            reason: "ambiguous_legacy_email",
          });
        }
        continue;
      }

      const candidate = group[0];
      try {
        const resolution = await resolveMember(email);

        if (resolution.status === "not_found") {
          result.skippedNoUniqueMatch += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: null,
            outcome: "no_match",
            reason: "memberstack_not_found",
          });
          continue;
        }

        if (resolution.status === "ambiguous") {
          result.skippedNoUniqueMatch += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: null,
            outcome: "no_match",
            reason: "ambiguous_memberstack_match",
          });
          continue;
        }

        if (resolution.status === "error") {
          result.failures += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: null,
            outcome: "failure",
            reason: "memberstack_lookup_failed",
            error: resolution.error,
          });
          continue;
        }

        const member = resolution.member;
        const decision = decideLegacyPlanAction(member);

        if (decision === "active_paid") {
          result.skippedActivePaid += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: member.id,
            outcome: "active_paid",
            reason: "other_active_paid_plan",
          });
          continue;
        }

        if (decision === "already_removed") {
          result.skippedAlreadyRemoved += 1;
          result.details.push({
            legacyMemberId: candidate.memberid,
            email: candidate.email,
            memberstackId: member.id,
            outcome: "already_removed",
            reason: "legacy_plan_not_active",
          });
          continue;
        }

        if (!dryRun) {
          await removeLegacyPlan(member.id, LEGACY_ANNUAL_PLAN_ID);
        }
        result.legacyPlansRemoved += 1;
        result.details.push({
          legacyMemberId: candidate.memberid,
          email: candidate.email,
          memberstackId: member.id,
          outcome: "removed",
          reason: dryRun ? "would_remove" : "removed",
        });
      } catch (error) {
        result.failures += 1;
        result.details.push({
          legacyMemberId: candidate.memberid,
          email: candidate.email,
          memberstackId: null,
          outcome: "failure",
          error: sanitizeError(error),
        });
      }
    }

    result.ok = true;
    result.completedAt = new Date().toISOString();
    return result;
  } catch (error) {
    result.ok = false;
    result.errorMessage = sanitizeError(error);
    return result;
  }
}
