/**
 * Server-side membership access: combine Memberstack plans with Watson
 * `legacy_members.subscriptionexpiring` when there is no active paid plan.
 *
 * Client bundles must not import this module (it talks to Watson/Postgres).
 */
import {
  getViewerAccessState,
  hasComplimentaryMemberAccess,
  hasMemberAccess,
  hasPaidMemberAccess,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  type MemberAccessOptions,
  type ViewerAccessState,
} from "./memberAccess";
import { memberEmailFromMemberstackPayload, memberIdFromMemberstackPayload } from "./patterns/memberstackMember";
import { loadComplimentaryAccessThroughYmd } from "./watson/complimentaryAccess";
import { resolveLegacyLinkByMemberstackEmail } from "./watson/customerIdentifier";
import type { WatsonQueryFn } from "./watson/memberSearch";

export type LoadLegacyPaidThroughYmd = (
  email: string | null | undefined,
) => Promise<string | null>;

export type EvaluatedMemberAccess = {
  hasMemberAccess: boolean;
  viewerAccessState: ViewerAccessState;
  legacyPaidThroughYmd: string | null;
  /** Saved complimentary date, or null when none is saved or the plan is absent. */
  complimentaryThroughYmd: string | null;
};

export type LoadComplimentaryThroughYmd = (
  memberstackId: string | null | undefined,
) => Promise<string | null>;

/**
 * Authoritative Watson paid-through date for a Memberstack email.
 * Unique match only. Ambiguous, missing, or failed lookups return null (fail closed).
 */
export async function loadLegacyPaidThroughYmdForEmail(
  email: string | null | undefined,
  queryFn?: WatsonQueryFn,
): Promise<string | null> {
  const link = await resolveLegacyLinkByMemberstackEmail(email, queryFn);
  if (link.status !== "unique") return null;
  return memberAccessYmdFromDateOnlyValue(link.member.subscriptionexpiring ?? null);
}

/**
 * Canonical server access decision for an Admin `getMember` record (or equivalent).
 * Paid plans skip Watson. An active complimentary plan loads its Watson
 * access-through date when one is saved. Any other logged-in member requires a
 * valid legacy paid-through date. The free Memberstack legacy plan is not required.
 */
export async function evaluateMemberAccessForRecord(
  record: unknown,
  deps: {
    loadPaidThroughYmd?: LoadLegacyPaidThroughYmd;
    loadComplimentaryThroughYmd?: LoadComplimentaryThroughYmd;
    now?: Date;
    todayYmd?: string;
  } = {},
): Promise<EvaluatedMemberAccess> {
  const loadLegacy = deps.loadPaidThroughYmd ?? loadLegacyPaidThroughYmdForEmail;
  const loadComplimentary = deps.loadComplimentaryThroughYmd ?? loadComplimentaryAccessThroughYmd;
  const options: MemberAccessOptions = {
    now: deps.now,
    todayYmd: deps.todayYmd,
  };
  let complimentaryThroughYmd: string | null = null;

  if (hasComplimentaryMemberAccess(record) && !hasPaidMemberAccess(record)) {
    try {
      complimentaryThroughYmd = await loadComplimentary(
        memberIdFromMemberstackPayload(record),
      );
      options.complimentaryThroughYmd = complimentaryThroughYmd;
    } catch {
      // Unknown date keeps the open complimentary connection. A saved expired
      // date is enforced on the next successful read.
      complimentaryThroughYmd = null;
    }
  }

  let legacyPaidThroughYmd: string | null = null;
  if (needsLegacyPaidThroughForAccess(record, options)) {
    try {
      legacyPaidThroughYmd = await loadLegacy(memberEmailFromMemberstackPayload(record) ?? null);
    } catch {
      legacyPaidThroughYmd = null;
    }
  }
  options.legacyPaidThroughYmd = legacyPaidThroughYmd;

  const granted = hasMemberAccess(record, options);
  return {
    hasMemberAccess: granted,
    viewerAccessState: getViewerAccessState(record, options),
    legacyPaidThroughYmd,
    complimentaryThroughYmd,
  };
}
