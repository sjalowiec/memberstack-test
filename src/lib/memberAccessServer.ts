/**
 * Server-side membership access: combine Memberstack plans with Watson
 * `legacy_members.subscriptionexpiring`.
 *
 * A paid plan still loads Watson so a returned null means the lookup found no
 * date. A thrown lookup stays not loaded and is not reported as "not found".
 * Client bundles must not import this module (it talks to Watson/Postgres).
 */
import {
  getViewerAccessState,
  hasComplimentaryMemberAccess,
  hasMemberAccess,
  hasPaidMemberAccess,
  isMemberLoggedIn,
  memberAccessYmdFromDateOnlyValue,
  needsLegacyPaidThroughForAccess,
  type LegacyPaidThroughLookup,
  type MemberAccessOptions,
  type PaidBillingInterval,
  type ViewerAccessState,
} from "./memberAccess";
import {
  billingIntervalFromActivePaidConnection,
  renewsLabelFromActivePaidConnection,
} from "./membership/accountMembershipPanel";
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
  /**
   * Watson date when {@link legacyPaidThroughLookup} is `found` or `not_found`.
   * Null for both `not_found` and `not_loaded`; use the lookup field to tell
   * those apart.
   */
  legacyPaidThroughYmd: string | null;
  legacyPaidThroughLookup: LegacyPaidThroughLookup;
  /** Saved complimentary date, or null when none is saved or the plan is absent. */
  complimentaryThroughYmd: string | null;
  /**
   * True when the Watson legacy lookup threw and access was not otherwise
   * granted. Callers should say "could not confirm" rather than "no membership".
   */
  legacyLookupFailed: boolean;
  /** True when the Admin record has an active or trialing paid plan. */
  serverConfirmedPaidAccess: boolean;
  serverConfirmedPaidBillingInterval: PaidBillingInterval | null;
  /**
   * Stripe `payment.nextBillingDate` for the confirmed paid plan, formatted.
   * Null when there is no paid plan or Stripe did not provide the date.
   * This is never the Watson paid-through date.
   */
  serverConfirmedPaidRenewsLabel: string | null;
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
 * Paid plans grant access on their own and still load Watson so a null date
 * means the lookup found nothing. An active complimentary plan loads its Watson
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

  const serverConfirmedPaidAccess = hasPaidMemberAccess(record);
  const serverConfirmedPaidBillingInterval: PaidBillingInterval | null = serverConfirmedPaidAccess
    ? billingIntervalFromActivePaidConnection(record)
    : null;
  const serverConfirmedPaidRenewsLabel = serverConfirmedPaidAccess
    ? renewsLabelFromActivePaidConnection(record)
    : null;

  let legacyPaidThroughLookup: LegacyPaidThroughLookup = "not_loaded";
  let legacyPaidThroughYmd: string | null = null;
  let legacyLookupFailed = false;
  const shouldLoadLegacy =
    isMemberLoggedIn(record) &&
    (serverConfirmedPaidAccess || needsLegacyPaidThroughForAccess(record, options));

  if (shouldLoadLegacy) {
    try {
      legacyPaidThroughYmd = await loadLegacy(memberEmailFromMemberstackPayload(record) ?? null);
      legacyPaidThroughLookup = legacyPaidThroughYmd ? "found" : "not_found";
    } catch {
      legacyPaidThroughLookup = "not_loaded";
      legacyPaidThroughYmd = null;
      legacyLookupFailed = true;
    }
  }
  options.legacyPaidThroughYmd = legacyPaidThroughYmd;

  const granted = hasMemberAccess(record, options);
  return {
    hasMemberAccess: granted,
    viewerAccessState: getViewerAccessState(record, options),
    legacyPaidThroughYmd,
    legacyPaidThroughLookup,
    complimentaryThroughYmd,
    legacyLookupFailed: legacyLookupFailed && !granted,
    serverConfirmedPaidAccess,
    serverConfirmedPaidBillingInterval,
    serverConfirmedPaidRenewsLabel,
  };
}
