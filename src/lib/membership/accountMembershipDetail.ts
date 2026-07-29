/**
 * Customer-facing membership detail for the Account page "Membership" section.
 *
 * Extends the public membership status summary with:
 *   - Member Since (earliest known join date across legacy + Memberstack)
 *   - Billing frequency (Monthly / Annual) for active paid members
 *   - Next renewal / active-through dates
 *   - Legacy paid-through / legacy access date (when applicable)
 *   - A read-only, customer-safe membership history timeline
 *
 * The DTO is display-only: it never contains internal ids (Stripe, Memberstack,
 * legacy member ids), admin notes, or debugging fields. Member id must come from
 * a verified JWT - never from the browser request.
 */

import {
  buildCustomerMemberstackSummary,
  loadCustomerMemberstackMemberById,
  type CustomerMemberstackSummary,
  type MemberstackGetMemberClient,
} from "../watson/customerMemberstack";
import {
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "../watson/customerIdentifier";
import { buildProfileLegacyLinkState } from "../watson/customerProfile";
import type { LegacyMemberDetailRow } from "../watson/memberDetail";
import {
  getMemberMemberships,
  type MemberMembershipDisplay,
} from "../watson/memberMembership";
import type { WatsonQueryFn } from "../watson/memberSearch";
import {
  billingIntervalFromActivePaidConnection,
  renewsLabelFromActivePaidConnection,
  type AccountMembershipBillingInterval,
} from "./accountMembershipPanel";
import {
  buildMembershipHistory,
  sortMembershipHistoryForDisplay,
  type MembershipHistoryEvent,
} from "./membershipHistory";
import { legacyContextFromLink } from "./membershipStatusService";
import type { MemberstackMember } from "./membershipSummary";
import {
  buildMembershipStatusSummary,
  calendarYmdForNow,
  formatMembershipCalendarDateFromYmd,
  resolveLegacyExpirationTiming,
  ymdFromDateOnlyValue,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  type LegacyExpirationTiming,
  type MembershipStatusLegacyContext,
  type MembershipStatusSummary,
} from "./membershipStatusSummary";

export interface AccountMembershipDetail {
  identified: boolean;
  /** Current membership name, e.g. "Knit it Now Membership" (null when none). */
  membershipName: string | null;
  /** Human status label, e.g. "Active", "Canceling", "Expired", "Legacy Access". */
  statusLabel: string | null;
  /** Billing frequency label for active paid members, e.g. "Monthly". */
  billingLabel: string | null;
  /** Next renewal date for recurring memberships (null when canceling/none). */
  nextRenewalDate: string | null;
  /** Active-through date shown when a paid membership is canceling. */
  activeThroughDate: string | null;
  /** Legacy access / paid-through date when applicable (never for active paid). */
  legacyPaidThroughDate: string | null;
  /**
   * Whether the displayed legacy paid-through date is still current/future
   * (true = "Available through {date}") or has already ended
   * (false = "Ended {date}"). Null when no legacy access date is shown.
   */
  legacyAccessActive: boolean | null;
  /** Earliest known join date across all sources. */
  memberSince: string | null;
  /** Customer-safe membership milestones, ordered newest-first for display. */
  history: MembershipHistoryEvent[];
}

const BILLING_LABEL: Record<AccountMembershipBillingInterval, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

function unidentifiedDetail(): AccountMembershipDetail {
  return {
    identified: false,
    membershipName: null,
    statusLabel: null,
    billingLabel: null,
    nextRenewalDate: null,
    activeThroughDate: null,
    legacyPaidThroughDate: null,
    legacyAccessActive: null,
    memberSince: null,
    history: [],
  };
}

/**
 * One consistent customer-facing status. Active paid state (from Memberstack)
 * always wins; otherwise a current/future legacy paid-through reads as
 * "Legacy Access" and a lapsed one as "Expired".
 */
function resolveStatusLabel(
  summary: MembershipStatusSummary,
  legacyTiming: LegacyExpirationTiming | null,
): string | null {
  switch (summary.currentStatus) {
    case "canceling":
      return "Canceling";
    case "active":
      return summary.accountType === "free_membership" ? "Legacy Access" : "Active";
  }

  // Not an active/canceling paid (or active free) membership: legacy access,
  // when present, tells the story.
  if (legacyTiming === "legacy_paid_through_future") return "Legacy Access";
  if (legacyTiming === "legacy_expired") return "Expired";

  // A former paid Memberstack membership with no legacy paid-through still reads
  // as expired; a bare account with neither stays "no active membership" (null).
  if (summary.currentStatus === "inactive") return "Expired";
  return null;
}

function resolveMemberSince(
  legacyJoinedDate: string | Date | null,
  legacyMemberships: MemberMembershipDisplay[],
  memberstackSummary: CustomerMemberstackSummary | null,
): string | null {
  const candidates: Array<string | Date | null | undefined> = [
    legacyJoinedDate,
    memberstackSummary?.accountCreatedAtSort ?? null,
    ...legacyMemberships.map((row) => row.startDateSort),
    ...(memberstackSummary?.connections.map((connection) => connection.startDateSort) ?? []),
  ];

  let earliest: string | null = null;
  for (const value of candidates) {
    const ymd = ymdFromDateOnlyValue(value ?? null);
    if (!ymd) continue;
    if (earliest === null || ymd < earliest) {
      earliest = ymd;
    }
  }
  return earliest ? formatMembershipCalendarDateFromYmd(earliest) : null;
}

export function buildAccountMembershipDetail(input: {
  memberstackMember: MemberstackMember | null;
  memberstackSummary: CustomerMemberstackSummary | null;
  memberstackLookupOk: boolean;
  legacy: MembershipStatusLegacyContext;
  legacyJoinedDate?: string | Date | null;
  legacyMemberships?: MemberMembershipDisplay[];
  now?: Date;
}): AccountMembershipDetail {
  if (!input.memberstackLookupOk || !input.memberstackMember || !input.memberstackSummary) {
    return unidentifiedDetail();
  }

  const legacyMemberships = input.legacyMemberships ?? [];
  const summary = buildMembershipStatusSummary({
    memberstackMember: input.memberstackMember,
    memberstackSummary: input.memberstackSummary,
    memberstackLookupOk: input.memberstackLookupOk,
    legacy: input.legacy,
    now: input.now,
  });

  const payload = { data: input.memberstackMember };
  const billingInterval = billingIntervalFromActivePaidConnection(payload);
  const isPaidMember = summary.accountType === "paid_membership";

  const todayYmd = calendarYmdForNow(
    input.now ?? new Date(),
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  const legacyTiming =
    input.legacy.linkState === "linked"
      ? resolveLegacyExpirationTiming(input.legacy.legacyExpirationYmd, todayYmd)
      : null;

  // Legacy paid-through is historical context; hide it for active paying members.
  const legacyPaidThroughDate = isPaidMember ? null : summary.legacyExpirationDate;

  // Display order (newest-first) is decided here in shared logic so the client
  // renders the received order as-is (no CSS/DOM reversing).
  const history = sortMembershipHistoryForDisplay(
    buildMembershipHistory({
      legacyJoinedDate: input.legacyJoinedDate ?? null,
      legacyMemberships,
      connections: input.memberstackSummary.connections,
      memberstackAccountCreatedDate: input.memberstackSummary.accountCreatedAtSort || null,
      hasLegacyHistory: input.legacy.linkState === "linked",
    }),
  );

  return {
    identified: true,
    membershipName: summary.currentPlanName,
    statusLabel: resolveStatusLabel(summary, legacyTiming),
    billingLabel: billingInterval ? BILLING_LABEL[billingInterval] : null,
    nextRenewalDate: renewsLabelFromActivePaidConnection(payload),
    activeThroughDate: summary.activeThroughDate,
    legacyPaidThroughDate,
    legacyAccessActive:
      legacyPaidThroughDate == null ? null : legacyTiming !== "legacy_expired",
    memberSince: resolveMemberSince(
      input.legacyJoinedDate ?? null,
      legacyMemberships,
      input.memberstackSummary,
    ),
    history,
  };
}

export type AccountMembershipDetailDeps = {
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
  now?: Date;
};

/** Build the Account-page membership detail for a verified Memberstack member id. */
export async function loadAccountMembershipDetail(
  memberstackId: string,
  deps: AccountMembershipDetailDeps = {},
): Promise<AccountMembershipDetail> {
  const normalizedId = memberstackId.trim();
  if (!normalizedId) {
    return unidentifiedDetail();
  }

  const memberstackResult = await loadCustomerMemberstackMemberById(normalizedId, {
    secretKey: deps.secretKey,
    getClient: deps.getClient,
  });

  if (!memberstackResult.ok) {
    console.warn("[account-membership-detail] Memberstack Admin lookup unsuccessful", {
      operation: "getMember by id",
      memberstackStatus: memberstackResult.status,
    });
    return unidentifiedDetail();
  }

  const member = memberstackResult.member;
  const memberstackSummary = buildCustomerMemberstackSummary({
    member,
    configured: true,
    loadError: null,
  });

  const resolveLegacyLink = deps.resolveLegacyLink ?? resolveLegacyLinkByMemberstackEmail;
  const loadMemberships = deps.loadMemberships ?? getMemberMemberships;

  let legacy: MembershipStatusLegacyContext;
  let legacyMemberships: MemberMembershipDisplay[] = [];
  let legacyJoinedDate: string | Date | null = null;

  try {
    const link = await resolveLegacyLink(member.auth?.email, deps.queryFn);
    if (link.status === "unique") {
      const linkState = buildProfileLegacyLinkState(link, member.auth?.email);
      if (linkState.legacyMemberid && linkState.legacyMember) {
        legacyJoinedDate = joinedDateFromLegacyMember(linkState.legacyMember);
        legacyMemberships = await loadMemberships(linkState.legacyMemberid, deps.queryFn);
      }
    }
    legacy = legacyContextFromLink({
      link,
      memberstackEmail: member.auth?.email,
      memberships: legacyMemberships,
    });
  } catch {
    legacy = {
      linkState: "lookup_unavailable",
      legacyExpirationDate: null,
      legacyExpirationYmd: null,
      previousPlanName: null,
    };
    legacyMemberships = [];
    legacyJoinedDate = null;
  }

  return buildAccountMembershipDetail({
    memberstackMember: member,
    memberstackSummary,
    memberstackLookupOk: true,
    legacy,
    legacyJoinedDate,
    legacyMemberships,
    now: deps.now,
  });
}

function joinedDateFromLegacyMember(
  member: LegacyMemberDetailRow,
): string | Date | null {
  return member.datejoined ?? null;
}
