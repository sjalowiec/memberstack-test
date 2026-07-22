/**
 * Server-side loader for the public membership-status summary.
 * Member id must come from a verified JWT  never from the browser request body/query.
 */

import {
  buildCustomerMemberstackSummary,
  loadCustomerMemberstackMemberById,
  type CustomerMemberstackSummary,
  type MemberstackAdminFailureReason,
  type MemberstackGetMemberClient,
} from "../watson/customerMemberstack";
import {
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "../watson/customerIdentifier";
import { buildProfileLegacyLinkState } from "../watson/customerProfile";
import {
  buildMembershipTimelineEvents,
  resolveLegacyAccessThroughDate,
} from "../watson/customerTimeline";
import {
  getMemberMemberships,
  type MemberMembershipDisplay,
} from "../watson/memberMembership";
import type { WatsonQueryFn } from "../watson/memberSearch";
import type { MemberstackMember } from "./membershipSummary";
import {
  buildMembershipStatusSummary,
  formatMembershipCalendarDateFromYmd,
  previousPlanNameFromLegacyMemberships,
  ymdFromDateOnlyValue,
  type MembershipLegacyLinkState,
  type MembershipStatusLegacyContext,
  type MembershipStatusSummary,
} from "./membershipStatusSummary";
import {
  isLegacyMembershipExpirationEvent,
} from "../watson/customerTimeline";

export type MembershipStatusServiceDeps = {
  secretKey?: string | null;
  getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
  queryFn?: WatsonQueryFn;
  resolveLegacyLink?: (
    email: string | null | undefined,
    queryFn?: WatsonQueryFn,
  ) => Promise<LegacyEmailLinkResult>;
  loadMemberships?: (
    memberid: string,
    queryFn?: WatsonQueryFn,
  ) => Promise<MemberMembershipDisplay[]>;
  /** Deterministic clock for legacy paid-through vs expired (tests). */
  now?: Date;
};

function legacyContextFromLink(options: {
  link: LegacyEmailLinkResult;
  memberstackEmail: string | null | undefined;
  memberships: MemberMembershipDisplay[];
  legacyLookupFailed?: boolean;
}): MembershipStatusLegacyContext {
  if (options.legacyLookupFailed) {
    return {
      linkState: "lookup_unavailable",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }

  const linkState = buildProfileLegacyLinkState(options.link, options.memberstackEmail);

  if (linkState.legacyLinkAmbiguous) {
    return {
      linkState: "ambiguous",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }

  if (!linkState.hasLegacyHistory || !linkState.legacyMemberid) {
    return {
      linkState: "not_found",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }

  const timeline = buildMembershipTimelineEvents(options.memberships);
  const expirationEvent = timeline.find((event) => isLegacyMembershipExpirationEvent(event));
  const legacyExpirationYmd = ymdFromDateOnlyValue(expirationEvent?.dateSort ?? null);
  const legacyExpirationDate =
    (legacyExpirationYmd
      ? formatMembershipCalendarDateFromYmd(legacyExpirationYmd)
      : null) ?? resolveLegacyAccessThroughDate(timeline);
  const previousPlanName = previousPlanNameFromLegacyMemberships(
    options.memberships,
    // Match by display from membership rows (short month) OR by sort date via premium helper.
    options.memberships.find((row) => ymdFromDateOnlyValue(row.expirationDateSort) === legacyExpirationYmd)
      ?.expirationDate ?? legacyExpirationDate,
  );

  return {
    linkState: "linked",
    legacyExpirationDate,
    legacyExpirationYmd,
    previousPlanName,
  };
}

/**
 * Build the customer-safe membership status for a verified Memberstack member id.
 */
export async function loadMembershipStatusForMemberId(
  memberstackId: string,
  deps: MembershipStatusServiceDeps = {},
): Promise<MembershipStatusSummary> {
  const normalizedId = memberstackId.trim();
  if (!normalizedId) {
    return buildMembershipStatusSummary({
      memberstackMember: null,
      memberstackSummary: null,
      memberstackLookupOk: false,
      legacy: {
        linkState: "lookup_unavailable",
        legacyExpirationDate: null,
        legacyExpirationYmd: null,
        previousPlanName: null,
      },
    });
  }

  // Pass the verified JWT member id straight to Admin getMember (via shared client path).
  const memberstackResult = await loadCustomerMemberstackMemberById(normalizedId, {
    secretKey: deps.secretKey,
    getClient: deps.getClient,
  });

  if (!memberstackResult.ok) {
    const failureReason: MemberstackAdminFailureReason =
      memberstackResult.failureReason ??
      (memberstackResult.status === "not_found"
        ? "member_not_found"
        : "admin_lookup_failed");
    console.warn("[membership-status] Memberstack Admin lookup unsuccessful", {
      operation: "getMember by id",
      failureReason,
      memberstackStatus: memberstackResult.status,
      message: memberstackResult.error,
      diagnostic: "diagnostic" in memberstackResult ? memberstackResult.diagnostic : undefined,
    });
    return buildMembershipStatusSummary({
      memberstackMember: null,
      memberstackSummary: null,
      memberstackLookupOk: false,
      legacy: {
        linkState: "lookup_unavailable",
        legacyExpirationDate: null,
        legacyExpirationYmd: null,
        previousPlanName: null,
      },
    });
  }

  const member: MemberstackMember = memberstackResult.member;
  const memberstackSummary: CustomerMemberstackSummary = buildCustomerMemberstackSummary({
    member,
    configured: true,
    loadError: null,
  });

  const resolveLegacyLink = deps.resolveLegacyLink ?? resolveLegacyLinkByMemberstackEmail;
  const loadMemberships = deps.loadMemberships ?? getMemberMemberships;

  let legacy: MembershipStatusLegacyContext;
  try {
    const link = await resolveLegacyLink(member.auth?.email, deps.queryFn);
    let memberships: MemberMembershipDisplay[] = [];
    if (link.status === "unique") {
      const linkState = buildProfileLegacyLinkState(link, member.auth?.email);
      if (linkState.legacyMemberid) {
        memberships = await loadMemberships(linkState.legacyMemberid, deps.queryFn);
      }
    }
    legacy = legacyContextFromLink({
      link,
      memberstackEmail: member.auth?.email,
      memberships,
    });
  } catch {
    legacy = {
      linkState: "lookup_unavailable" satisfies MembershipLegacyLinkState,
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
  }

  return buildMembershipStatusSummary({
    memberstackMember: member,
    memberstackSummary,
    memberstackLookupOk: true,
    legacy,
    now: deps.now,
  });
}
