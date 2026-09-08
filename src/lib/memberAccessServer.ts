/**
 * Server-side membership access: combine Memberstack plans with Watson
 * `legacy_members.subscriptionexpiring` for the free legacy plan.
 *
 * Client bundles must not import this module (it talks to Watson/Postgres).
 */
import {
  getViewerAccessState,
  hasMemberAccess,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  type ViewerAccessState,
} from "./memberAccess";
import { memberEmailFromMemberstackPayload } from "./patterns/memberstackMember";
import { resolveLegacyLinkByMemberstackEmail } from "./watson/customerIdentifier";
import type { WatsonQueryFn } from "./watson/memberSearch";

export type LoadLegacyPaidThroughYmd = (
  email: string | null | undefined,
) => Promise<string | null>;

export type EvaluatedMemberAccess = {
  hasMemberAccess: boolean;
  viewerAccessState: ViewerAccessState;
  legacyPaidThroughYmd: string | null;
};

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
 * Paid plans skip Watson. Free-legacy-only members require a valid paid-through date.
 */
export async function evaluateMemberAccessForRecord(
  record: unknown,
  deps: {
    loadPaidThroughYmd?: LoadLegacyPaidThroughYmd;
    now?: Date;
    todayYmd?: string;
  } = {},
): Promise<EvaluatedMemberAccess> {
  const load = deps.loadPaidThroughYmd ?? loadLegacyPaidThroughYmdForEmail;
  let legacyPaidThroughYmd: string | null = null;

  if (needsLegacyPaidThroughForAccess(record)) {
    try {
      legacyPaidThroughYmd = await load(memberEmailFromMemberstackPayload(record) ?? null);
    } catch {
      legacyPaidThroughYmd = null;
    }
  }

  const options = {
    legacyPaidThroughYmd,
    now: deps.now,
    todayYmd: deps.todayYmd,
  };
  const granted = hasMemberAccess(record, options);
  return {
    hasMemberAccess: granted,
    viewerAccessState: getViewerAccessState(record, options),
    legacyPaidThroughYmd,
  };
}
