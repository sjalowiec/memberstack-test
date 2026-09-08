/**
 * Server-side loader for the public membership-status summary.
 * Member id must come from a verified JWT - never from the browser request body/query.
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

export function legacyContextFromLink(options: {
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

  // Authoritative current paid-through: legacy_members.subscriptionexpiring only.
  // Subscription history may label previous plans and the history accordion; it
  // must never stand in as the current access date.
  const subscriptionExpiringYmd = ymdFromDateOnlyValue(
    linkState.legacyMember?.subscriptionexpiring ?? null,
  );
  const previousPlanName = previousPlanNameFromLegacyMemberships(
    options.memberships,
    subscriptionExpiringYmd
      ? (options.memberships.find(
          (row) =>
            ymdFromDateOnlyValue(row.expirationDateSort) === subscriptionExpiringYmd,
        )?.expirationDate ??
        formatMembershipCalendarDateFromYmd(subscriptionExpiringYmd))
      : null,
  );

  return {
    linkState: "linked",
    legacyExpirationDate: subscriptionExpiringYmd
      ? formatMembershipCalendarDateFromYmd(subscriptionExpiringYmd)
      : null,
    legacyExpirationYmd: subscriptionExpiringYmd,
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
