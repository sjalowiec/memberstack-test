/**
 * Pure presentation helpers for the legacy renewal reminder preview.
 *
 * These functions only reshape the totals/details already produced by the shared
 * `runLegacyRenewalReminders` job. They contain NO eligibility, filtering, or SQL
 * logic - that lives solely in `legacyRenewalReminders.ts`.
 */
import type {
  ReminderDetail,
  ReminderOutcome,
  ReminderTotals,
} from "./legacyRenewalReminders";

export interface ReminderPreviewCard {
  id: string;
  label: string;
  value: number;
}

export interface ReminderPreviewRow {
  email: string;
  firstName: string;
  lastName: string;
  /** Legacy expiration / Watson paid-through calendar day (YYYY-MM-DD). */
  legacyExpiration: string;
  daysUntilExpiration: number;
  status: string;
  /** Coarse status group for styling: "eligible" | "skipped" | "failure". */
  statusModifier: "eligible" | "skipped" | "failure";
  reason: string;
}

/** Human-readable status label for each machine outcome. */
export const REMINDER_STATUS_LABELS: Record<ReminderOutcome, string> = {
  tagged: "Tagged",
  would_tag: "Eligible",
  skipped_active_paid: "Active Paid",
  skipped_ambiguous: "Ambiguous",
  skipped_missing_email: "Missing Email",
  skipped_staff_or_test: "Staff/Test",
  skipped_already_tagged: "Already Tagged",
  skipped_unsubscribed: "Unsubscribed",
  skipped_bounced: "Bounced",
  skipped_unconfirmed: "Unconfirmed",
  failure: "Failure",
};

/** Coarse group used purely for badge coloring. */
export function reminderStatusModifier(
  outcome: ReminderOutcome,
): ReminderPreviewRow["statusModifier"] {
  if (outcome === "would_tag" || outcome === "tagged") return "eligible";
  if (outcome === "failure") return "failure";
  return "skipped";
}

/**
 * Summary cards in the exact order requested by the preview spec. Every value is
 * read straight from the shared totals object - no recomputation.
 */
export function buildReminderPreviewCards(totals: ReminderTotals): ReminderPreviewCard[] {
  return [
    { id: "candidatesFound", label: "Candidates Found", value: totals.candidatesFound },
    { id: "eligible", label: "Eligible", value: totals.wouldTag + totals.tagged },
    { id: "skippedActivePaid", label: "Skipped - Active Paid", value: totals.skippedActivePaid },
    {
      id: "skippedAlreadyTagged",
      label: "Skipped - Already Tagged",
      value: totals.skippedAlreadyTagged,
    },
    {
      id: "skippedMissingEmail",
      label: "Skipped - Missing Email",
      value: totals.skippedMissingEmail,
    },
    { id: "skippedAmbiguous", label: "Skipped - Ambiguous", value: totals.skippedAmbiguous },
    { id: "skippedStaffOrTest", label: "Skipped - Staff/Test", value: totals.skippedStaffOrTest },
    {
      id: "skippedUnsubscribed",
      label: "Skipped - Unsubscribed",
      value: totals.skippedUnsubscribed,
    },
    { id: "skippedBounced", label: "Skipped - Bounced", value: totals.skippedBounced },
    { id: "skippedUnconfirmed", label: "Skipped - Unconfirmed", value: totals.skippedUnconfirmed },
    { id: "failures", label: "Failures", value: totals.failures },
  ];
}

/**
 * One preview row per evaluated candidate, sorted by legacy expiration date
 * ascending (ties broken by email for stable display).
 */
export function buildReminderPreviewRows(details: ReminderDetail[]): ReminderPreviewRow[] {
  return details
    .map((detail) => ({
      email: detail.email ?? "",
      firstName: detail.fristname?.trim() ?? "",
      lastName: detail.lastname?.trim() ?? "",
      legacyExpiration: detail.paidThrough ?? "",
      daysUntilExpiration: detail.windowDays,
      status: REMINDER_STATUS_LABELS[detail.outcome],
      statusModifier: reminderStatusModifier(detail.outcome),
      reason: detail.reason ?? detail.error ?? "",
    }))
    .sort((a, b) => {
      if (a.legacyExpiration !== b.legacyExpiration) {
        return a.legacyExpiration.localeCompare(b.legacyExpiration);
      }
      return a.email.localeCompare(b.email);
    });
}
