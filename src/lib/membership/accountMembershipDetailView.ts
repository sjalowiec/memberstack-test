/**
 * Pure display reconciliation for the Account "Current Membership" panel.
 *
 * account-membership.ts sets Plan/Status from the live Memberstack payload only,
 * so a legacy-only member reads as "No active membership" there. This helper
 * derives the customer-safe overrides + history accordion state from the
 * authoritative server detail so Plan and Status tell one consistent story.
 *
 * Display logic only: it never changes access control, eligibility, expiration
 * math, or membership data.
 */

import type { AccountMembershipDetail } from "./accountMembershipDetail";
import { FREE_MEMBERSHIP_DISPLAY_LABEL } from "./membershipCheckoutDecision";

export interface AccountMembershipDetailView {
  /** Plan label to apply when non-null (legacy members); null keeps the live plan. */
  planOverride: string | null;
  /** Status label to apply when non-null (legacy members); null keeps the live status. */
  statusOverride: string | null;
  /** Legacy access row value, e.g. "Available through {date}" / "Ended {date}". */
  legacyAccessValue: string | null;
  /**
   * Label for the panel's single primary date row. Legacy members (any state
   * with a legacy access date) read "Legacy Access Through"; everyone else reads
   * "Member Since". Null when there is no date to show.
   */
  membershipDateLabel: string | null;
  /**
   * Value for the primary date row: the authoritative legacy access-through date
   * for legacy members, otherwise the member-since date. Null hides the row.
   */
  membershipDateValue: string | null;
  history: {
    /** Whether the history accordion should be shown at all. */
    visible: boolean;
    /** Number of customer-visible history events. */
    count: number;
    /** Accordion header text, e.g. "Membership History (5)" (null when hidden). */
    headerLabel: string | null;
  };
}

type AccountMembershipDetailViewInput = Pick<
  AccountMembershipDetail,
  | "identified"
  | "membershipName"
  | "legacyPaidThroughDate"
  | "legacyAccessActive"
  | "memberSince"
  | "history"
>;

export const LEGACY_ACCESS_THROUGH_LABEL = "Legacy Access Through";
export const MEMBER_SINCE_LABEL = "Member Since";

export function resolveAccountMembershipDetailView(
  detail: AccountMembershipDetailViewInput,
): AccountMembershipDetailView {
  const count = Array.isArray(detail.history) ? detail.history.length : 0;
  const visible = detail.identified === true && count > 0;

  // A legacy-only presentation: no current Memberstack membership, but a legacy
  // paid-through date exists (current/future -> "Legacy Access", past -> "Expired").
  const isLegacyOnly =
    detail.identified === true &&
    detail.membershipName == null &&
    detail.legacyPaidThroughDate != null;

  const legacyEnded = detail.legacyAccessActive === false;

  // Single primary date row. Legacy members (a legacy access date is present,
  // which is only the case for non-paid states) show the authoritative
  // access-through date; everyone else keeps Member Since untouched.
  const hasLegacyAccessDate =
    detail.identified === true && detail.legacyPaidThroughDate != null;
  const memberSince = detail.memberSince ?? null;
  const membershipDateValue = hasLegacyAccessDate
    ? detail.legacyPaidThroughDate
    : memberSince;
  const membershipDateLabel = membershipDateValue
    ? hasLegacyAccessDate
      ? LEGACY_ACCESS_THROUGH_LABEL
      : MEMBER_SINCE_LABEL
    : null;

  return {
    planOverride: isLegacyOnly ? FREE_MEMBERSHIP_DISPLAY_LABEL : null,
    statusOverride: isLegacyOnly ? (legacyEnded ? "Expired" : "Legacy Access") : null,
    legacyAccessValue: detail.legacyPaidThroughDate
      ? legacyEnded
        ? `Ended ${detail.legacyPaidThroughDate}`
        : `Available through ${detail.legacyPaidThroughDate}`
      : null,
    membershipDateLabel,
    membershipDateValue,
    history: {
      visible,
      count,
      headerLabel: visible ? `Membership History (${count})` : null,
    },
  };
}
