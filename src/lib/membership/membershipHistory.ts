/**
 * Customer-safe membership history timeline for the Account page.
 *
 * Assembles a single chronological (oldest -> newest) list of meaningful,
 * customer-visible membership milestones from:
 *   - the legacy join date (legacy_members.datejoined)
 *   - legacy subscription history (legacy_subscriptions)
 *   - the Memberstack account + paid plan connections
 *
 * It intentionally NEVER emits failed payments, internal audit records, Watson
 * edits, Stripe/Memberstack/database identifiers, or technical sync events. The
 * output contains only display-safe titles, descriptions, and calendar dates.
 */

import { FREE_ACCESS_MEMBERSHIPS } from "../../config/memberships";
import type { CustomerPlanConnectionDisplay } from "../watson/customerMemberstack";
import type { MemberMembershipDisplay } from "../watson/memberMembership";
import {
  formatMembershipCalendarDateFromYmd,
  ymdFromDateOnlyValue,
} from "./membershipStatusSummary";

export type MembershipHistoryEventType =
  | "joined"
  | "started"
  | "monthly_started"
  | "annual_started"
  | "renewed"
  | "legacy_annual_renewed"
  | "upgraded"
  | "changed"
  | "canceled"
  | "reactivated"
  | "legacy_imported"
  | "migrated";

export interface MembershipHistoryEvent {
  type: MembershipHistoryEventType;
  /** Customer-facing title, e.g. "Joined Knit it Now". */
  title: string;
  /** Long calendar date for display, e.g. "March 14, 2017". */
  date: string;
  /** YYYY-MM-DD used only for chronological ordering. */
  dateSort: string;
  /** Optional short, reassuring description. */
  description?: string;
}

export interface MembershipHistoryInput {
  /** legacy_members.datejoined as a calendar day (any date-only value). */
  legacyJoinedDate?: string | Date | null;
  /** Legacy subscription rows (any order). */
  legacyMemberships?: MemberMembershipDisplay[];
  /** Memberstack plan connections (customer-safe display shape). */
  connections?: CustomerPlanConnectionDisplay[];
  /** Memberstack account creation date (any date-only value). */
  memberstackAccountCreatedDate?: string | Date | null;
  /** True when this account is confidently linked to legacy history. */
  hasLegacyHistory?: boolean;
}

/** Same-date ordering: earlier lifecycle stages first, cancellations last. */
const SAME_DATE_ORDER: Record<MembershipHistoryEventType, number> = {
  joined: 0,
  legacy_imported: 1,
  migrated: 1,
  started: 2,
  monthly_started: 2,
  annual_started: 2,
  reactivated: 2,
  renewed: 3,
  legacy_annual_renewed: 3,
  upgraded: 3,
  changed: 3,
  canceled: 5,
};

function makeEvent(
  type: MembershipHistoryEventType,
  title: string,
  rawDate: string | Date | null | undefined,
  description?: string,
): MembershipHistoryEvent | null {
  const ymd = ymdFromDateOnlyValue(rawDate ?? null);
  if (!ymd) return null;
  const date = formatMembershipCalendarDateFromYmd(ymd);
  if (!date) return null;
  return description
    ? { type, title, date, dateSort: ymd, description }
    : { type, title, date, dateSort: ymd };
}

function push(
  events: MembershipHistoryEvent[],
  event: MembershipHistoryEvent | null,
): void {
  if (event) events.push(event);
}

function earliestYmd(values: Array<string | Date | null | undefined>): string | null {
  let earliest: string | null = null;
  for (const value of values) {
    const ymd = ymdFromDateOnlyValue(value ?? null);
    if (!ymd) continue;
    if (earliest === null || ymd < earliest) {
      earliest = ymd;
    }
  }
  return earliest;
}

function isMonthlyLegacyRow(row: MemberMembershipDisplay): boolean {
  return row.monthlyBillingFlag === "1";
}

function legacyRowsAscending(
  rows: MemberMembershipDisplay[],
): Array<{ row: MemberMembershipDisplay; ymd: string }> {
  return rows
    .map((row) => ({ row, ymd: ymdFromDateOnlyValue(row.startDateSort) }))
    .filter((entry): entry is { row: MemberMembershipDisplay; ymd: string } =>
      Boolean(entry.ymd),
    )
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
}

function paidConnectionsAscending(
  connections: CustomerPlanConnectionDisplay[],
  fallbackStartYmd: string | null,
): Array<{ connection: CustomerPlanConnectionDisplay; ymd: string }> {
  return connections
    .filter((connection) => connection.isPaidPlan === true)
    .map((connection) => ({
      connection,
      // Memberstack sometimes omits the plan-connection createdAt on migrated /
      // Stripe-synced members. Fall back to the account-created date so the
      // current membership's "Started" milestone still appears.
      ymd: ymdFromDateOnlyValue(connection.startDateSort) ?? fallbackStartYmd ?? "",
    }))
    .filter((entry): entry is { connection: CustomerPlanConnectionDisplay; ymd: string } =>
      Boolean(entry.ymd),
    )
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
}

/** Started event whose label matches the known billing interval. */
function startedEventForInterval(
  interval: string | null,
  ymd: string,
): MembershipHistoryEvent | null {
  const normalized = (interval ?? "").trim().toLowerCase();
  if (normalized === "monthly") {
    return makeEvent("monthly_started", "Monthly Membership Started", ymd);
  }
  if (normalized === "annual" || normalized === "year" || normalized === "yearly") {
    return makeEvent("annual_started", "Annual Membership Started", ymd);
  }
  return makeEvent("started", "Membership Started", ymd);
}

function dedupe(events: MembershipHistoryEvent[]): MembershipHistoryEvent[] {
  const seen = new Set<string>();
  const result: MembershipHistoryEvent[] = [];
  for (const event of events) {
    const key = `${event.type}|${event.dateSort}|${event.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result;
}

/**
 * Build the customer-facing, chronological membership history.
 * Returns oldest-first so the timeline reads like a story.
 */
export function buildMembershipHistory(
  input: MembershipHistoryInput,
): MembershipHistoryEvent[] {
  const legacyMemberships = input.legacyMemberships ?? [];
  const connections = input.connections ?? [];
  const events: MembershipHistoryEvent[] = [];

  const accountCreatedYmd = ymdFromDateOnlyValue(
    input.memberstackAccountCreatedDate ?? null,
  );
  const legacyAsc = legacyRowsAscending(legacyMemberships);
  const paidConnections = paidConnectionsAscending(connections, accountCreatedYmd);

  // 1. Joined Knit it Now - prefer the explicit legacy join date, otherwise the
  //    earliest known membership signal so long-time members still see an origin.
  const joinedYmd =
    ymdFromDateOnlyValue(input.legacyJoinedDate ?? null) ??
    earliestYmd([
      ...legacyAsc.map((entry) => entry.ymd),
      input.memberstackAccountCreatedDate ?? null,
      ...paidConnections.map((entry) => entry.ymd),
    ]);
  const usedLegacyStartAsJoin =
    !ymdFromDateOnlyValue(input.legacyJoinedDate ?? null) &&
    joinedYmd != null &&
    legacyAsc.length > 0 &&
    joinedYmd === legacyAsc[0]?.ymd;
  push(events, makeEvent("joined", "Joined Knit it Now", joinedYmd));

  // 2. Legacy subscription history: first paid start, renewals, cancellations.
  legacyAsc.forEach((entry, index) => {
    const monthly = isMonthlyLegacyRow(entry.row);
    // A row is a renewal when it is not the first one, or is explicitly flagged.
    const isRenewal = index > 0 || entry.row.renewalFlag === "1";

    // Avoid a redundant "Membership Started" on the very same day we already
    // synthesized a "Joined Knit it Now" milestone from this same row.
    const skipStart = index === 0 && usedLegacyStartAsJoin && !isRenewal;

    if (isRenewal) {
      push(
        events,
        monthly
          ? makeEvent("renewed", "Membership Renewed", entry.ymd)
          : makeEvent("legacy_annual_renewed", "Renewed Annual Membership", entry.ymd),
      );
    } else if (!skipStart) {
      push(
        events,
        monthly
          ? makeEvent("monthly_started", "Monthly Membership Started", entry.ymd)
          : makeEvent("annual_started", "Annual Membership Started", entry.ymd),
      );
    }

    if (entry.row.cancelledFlag === "1" && entry.row.cancelDateSort) {
      push(events, makeEvent("canceled", "Membership Canceled", entry.row.cancelDateSort));
    }
  });

  // 3. Migration to the new platform. A live "legacy membership" free connection
  //    is the clearest signal of an import; otherwise infer from account creation
  //    when legacy history exists.
  const legacyFreeConnection = connections.find(
    (connection) =>
      connection.planId === FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
  );
  const migrationDescription = "Your Knit it Now account moved to our new platform.";
  if (legacyFreeConnection) {
    push(
      events,
      makeEvent(
        "migrated",
        "Migrated to the new Knit it Now",
        legacyFreeConnection.startDateSort || input.memberstackAccountCreatedDate,
        migrationDescription,
      ),
    );
  } else if (input.hasLegacyHistory && input.memberstackAccountCreatedDate) {
    push(
      events,
      makeEvent(
        "migrated",
        "Migrated to the new Knit it Now",
        input.memberstackAccountCreatedDate,
        migrationDescription,
      ),
    );
  }

  // 4. Memberstack paid membership connections: started, changed, reactivated,
  //    and cancellations. Only paid plans are customer-meaningful here.
  let previousCanceled = false;
  paidConnections.forEach((entry, index) => {
    if (index === 0) {
      push(events, startedEventForInterval(entry.connection.billingInterval, entry.ymd));
    } else if (previousCanceled) {
      push(events, makeEvent("reactivated", "Membership Reactivated", entry.ymd));
    } else {
      push(events, makeEvent("changed", "Membership Changed", entry.ymd));
    }

    previousCanceled = false;
    if (entry.connection.canceledAtSort) {
      const canceledEvent = makeEvent(
        "canceled",
        "Membership Canceled",
        entry.connection.canceledAtSort,
      );
      if (canceledEvent) {
        events.push(canceledEvent);
        previousCanceled = true;
      }
    }
  });

  return dedupe(events).sort((a, b) => {
    const byDate = a.dateSort.localeCompare(b.dateSort);
    if (byDate !== 0) return byDate;
    return SAME_DATE_ORDER[a.type] - SAME_DATE_ORDER[b.type];
  });
}

/**
 * Order a built history for customer display: newest date first, oldest last.
 * This is the single source of truth for display ordering - callers should not
 * re-sort in CSS or DOM order. Same-day ties keep the later lifecycle stage on
 * top (e.g. a same-day "Renewed" reads above the "Started"/"Migrated" it
 * followed), which is the reverse of the oldest-first build order.
 */
export function sortMembershipHistoryForDisplay(
  events: MembershipHistoryEvent[],
): MembershipHistoryEvent[] {
  return [...events].sort((a, b) => {
    const byDate = b.dateSort.localeCompare(a.dateSort);
    if (byDate !== 0) return byDate;
    return SAME_DATE_ORDER[b.type] - SAME_DATE_ORDER[a.type];
  });
}
