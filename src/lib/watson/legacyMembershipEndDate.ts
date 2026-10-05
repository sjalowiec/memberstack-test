/**
 * Read-only latest Watson paid-through date for active legacy-membership plans.
 * Uses the same calendar date as access and renewal reminders. Does not write.
 */
import { hasPaidMemberAccess, isActiveMemberstackPlanConnection } from "../memberAccess";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import { customerEmailLookupKeys, normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  EXPIRED_LEGACY_MEMBERS_COMPLIMENTARY_SQL,
  EXPIRED_LEGACY_MEMBERS_WATSON_SQL,
  type ExpiredLegacyWatsonRow,
} from "./expiredLegacyMembersReport";
import {
  LEGACY_MEMBERSHIP_PLAN_ID,
  listMemberstackMembersForDiagnostic,
  type ComplimentaryDateRow,
  type MemberstackListClient,
} from "./legacyRenewalDiagnostic";
import { activeComplimentaryOutlastsLegacyDate } from "./legacyRenewalReminders";
import { isStaffOrTestEmail } from "./legacyMembershipReportsShared";
import type { WatsonQueryFn } from "./memberSearch";

export interface LegacyEndDateMember {
  name: string;
  email: string;
  paidThrough: string;
  paidMembership: boolean;
  complimentaryBeyondLegacy: boolean;
}

export interface LegacyEndDateUnresolved {
  name: string;
  email: string;
  reason: "no Watson match" | "no paid-through date" | "more than one Watson member";
  paidThroughDates: string[];
}

export interface LegacyEndDateGroup {
  paidThrough: string | null;
  members: LegacyEndDateMember[];
}

export interface LegacyWindDownMonth {
  month: string;
  count: number;
}

export interface LegacyWindDown {
  customerCount: number;
  alreadyExpired: number;
  byMonth: LegacyWindDownMonth[];
  ninetyPercentDate: string | null;
  remainingAfterNinetyPercent: number;
  finalDate: string | null;
  lastTen: Array<{ name: string; email: string; paidThrough: string }>;
}

export interface LegacyMembershipEndDateReport {
  ok: true;
  todayLosAngeles: string;
  truncated: boolean;
  latestConfirmed: LegacyEndDateGroup;
  nextConfirmed: LegacyEndDateGroup;
  latestStillOnLegacy: LegacyEndDateGroup;
  nextStillOnLegacy: LegacyEndDateGroup;
  windDown: LegacyWindDown;
  unresolved: LegacyEndDateUnresolved[];
  staffOrTest: {
    latestConfirmed: LegacyEndDateGroup;
    unresolved: LegacyEndDateUnresolved[];
  };
}

function planIdOf(connection: unknown): string {
  if (!connection || typeof connection !== "object") return "";
  const record = connection as Record<string, unknown>;
  for (const key of ["planId", "plan", "id"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function hasActiveLegacyPlan(member: MemberstackMember): boolean {
  const connections = Array.isArray(member.planConnections) ? member.planConnections : [];
  return connections.some(
    (connection) =>
      planIdOf(connection) === LEGACY_MEMBERSHIP_PLAN_ID &&
      isActiveMemberstackPlanConnection(connection),
  );
}

function joinedName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function indexWatsonRows(rows: ExpiredLegacyWatsonRow[]): Map<string, ExpiredLegacyWatsonRow[]> {
  const index = new Map<string, ExpiredLegacyWatsonRow[]>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const key of customerEmailLookupKeys(row.email)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const group = index.get(key) ?? [];
      if (!group.some((existing) => existing.memberid === row.memberid)) group.push(row);
      index.set(key, group);
    }
  }
  return index;
}

function watsonMatches(
  email: string | null,
  index: Map<string, ExpiredLegacyWatsonRow[]>,
): ExpiredLegacyWatsonRow[] {
  const matches = new Map<string, ExpiredLegacyWatsonRow>();
  for (const key of customerEmailLookupKeys(email)) {
    for (const row of index.get(key) ?? []) matches.set(row.memberid, row);
  }
  return [...matches.values()];
}

function groupOnDate(members: LegacyEndDateMember[], paidThrough: string | null): LegacyEndDateGroup {
  const onDate = paidThrough ? members.filter((member) => member.paidThrough === paidThrough) : [];
  onDate.sort((a, b) => a.email.localeCompare(b.email));
  return { paidThrough, members: onDate };
}

function latestDate(members: LegacyEndDateMember[]): string | null {
  return members.reduce<string | null>(
    (latest, member) => (latest == null || member.paidThrough > latest ? member.paidThrough : latest),
    null,
  );
}

function nextGroup(members: LegacyEndDateMember[]): LegacyEndDateGroup {
  const latest = latestDate(members);
  const earlier = latest ? members.filter((member) => member.paidThrough < latest) : [];
  return groupOnDate(earlier, latestDate(earlier));
}

/** Customers still on legacy access whose paid-through day is today or later. */
export function summarizeLegacyWindDown(
  members: LegacyEndDateMember[],
  todayYmd: string,
): LegacyWindDown {
  const alreadyExpired = members.filter((member) => member.paidThrough < todayYmd).length;
  const remaining = members
    .filter((member) => member.paidThrough >= todayYmd)
    .sort(
      (a, b) => a.paidThrough.localeCompare(b.paidThrough) || a.email.localeCompare(b.email),
    );
  const counts = new Map<string, number>();
  for (const member of remaining) {
    const month = member.paidThrough.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  const threshold = remaining.length * 0.9;
  let seen = 0;
  let ninetyPercentDate: string | null = null;
  for (const member of remaining) {
    seen += 1;
    if (seen >= threshold) {
      ninetyPercentDate = member.paidThrough;
      break;
    }
  }
  const remainingAfter = ninetyPercentDate
    ? remaining.filter((member) => member.paidThrough > ninetyPercentDate).length
    : 0;
  return {
    customerCount: remaining.length,
    alreadyExpired,
    byMonth: [...counts.entries()].map(([month, count]) => ({ month, count })),
    ninetyPercentDate,
    remainingAfterNinetyPercent: remainingAfter,
    finalDate: remaining.at(-1)?.paidThrough ?? null,
    lastTen: remaining.slice(-10).map((member) => ({
      name: member.name,
      email: member.email,
      paidThrough: member.paidThrough,
    })),
  };
}

export function summarizeLegacyMembershipEndDate(input: {
  todayYmd: string;
  members: MemberstackMember[];
  watsonRows: ExpiredLegacyWatsonRow[];
  complimentaryByMemberstackId: Map<string, string>;
}): Omit<LegacyMembershipEndDateReport, "ok" | "todayLosAngeles" | "truncated"> {
  const index = indexWatsonRows(input.watsonRows);
  const confirmed: LegacyEndDateMember[] = [];
  const staffConfirmed: LegacyEndDateMember[] = [];
  const unresolved: LegacyEndDateUnresolved[] = [];
  const staffUnresolved: LegacyEndDateUnresolved[] = [];

  for (const member of input.members) {
    if (!hasActiveLegacyPlan(member)) continue;
    const email = normalizeCustomerEmail(member.auth?.email) ?? "";
    const matches = watsonMatches(email, index);
    const fallbackName = joinedName(member.auth?.firstName, member.auth?.lastName);
    const staff = isStaffOrTestEmail(email) || matches.some((row) => isStaffOrTestEmail(row.email));
    const unresolvedBucket = staff ? staffUnresolved : unresolved;
    const confirmedBucket = staff ? staffConfirmed : confirmed;

    if (matches.length === 0) {
      unresolvedBucket.push({
        name: fallbackName,
        email,
        reason: "no Watson match",
        paidThroughDates: [],
      });
      continue;
    }
    if (matches.length > 1) {
      unresolvedBucket.push({
        name: fallbackName || joinedName(matches[0]?.first_name, matches[0]?.last_name),
        email: email || matches[0]?.email || "",
        reason: "more than one Watson member",
        paidThroughDates: matches
          .map((row) => row.paid_through_ymd)
          .filter((date): date is string => Boolean(date))
          .sort(),
      });
      continue;
    }
    const row = matches[0];
    const paidThrough = row?.paid_through_ymd ?? null;
    if (!paidThrough) {
      unresolvedBucket.push({
        name: joinedName(row?.first_name, row?.last_name) || fallbackName,
        email: email || row?.email || "",
        reason: "no paid-through date",
        paidThroughDates: [],
      });
      continue;
    }
    const complimentaryYmd = input.complimentaryByMemberstackId.get(member.id) ?? null;
    confirmedBucket.push({
      name: joinedName(row?.first_name, row?.last_name) || fallbackName,
      email: email || row?.email || "",
      paidThrough,
      paidMembership: hasPaidMemberAccess(member),
      complimentaryBeyondLegacy: activeComplimentaryOutlastsLegacyDate({
        memberOrPayload: member,
        legacyYmd: paidThrough,
        complimentaryYmd,
      }),
    });
  }

  const stillOnLegacy = confirmed.filter(
    (member) => !member.paidMembership && !member.complimentaryBeyondLegacy,
  );
  unresolved.sort((a, b) => a.email.localeCompare(b.email));
  staffUnresolved.sort((a, b) => a.email.localeCompare(b.email));

  return {
    latestConfirmed: groupOnDate(confirmed, latestDate(confirmed)),
    nextConfirmed: nextGroup(confirmed),
    latestStillOnLegacy: groupOnDate(stillOnLegacy, latestDate(stillOnLegacy)),
    nextStillOnLegacy: nextGroup(stillOnLegacy),
    windDown: summarizeLegacyWindDown(stillOnLegacy, input.todayYmd),
    unresolved,
    staffOrTest: {
      latestConfirmed: groupOnDate(staffConfirmed, latestDate(staffConfirmed)),
      unresolved: staffUnresolved,
    },
  };
}

export async function loadLegacyMembershipEndDate(options: {
  listMembers?: MemberstackListClient;
  queryFn?: WatsonQueryFn;
  now?: Date;
}): Promise<LegacyMembershipEndDateReport> {
  if (!options.listMembers) {
    throw new Error("Memberstack admin API is not configured.");
  }
  const queryFn = options.queryFn ?? queryWatson;
  const todayLosAngeles = calendarYmdForNow(
    options.now ?? new Date(),
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  const listed = await listMemberstackMembersForDiagnostic(options.listMembers);
  const watsonRows = await queryFn<ExpiredLegacyWatsonRow>(EXPIRED_LEGACY_MEMBERS_WATSON_SQL);
  const complimentaryRows = await queryFn<ComplimentaryDateRow>(
    EXPIRED_LEGACY_MEMBERS_COMPLIMENTARY_SQL,
  );
  return {
    ok: true,
    todayLosAngeles,
    truncated: listed.truncated,
    ...summarizeLegacyMembershipEndDate({
      todayYmd: todayLosAngeles,
      members: listed.members,
      watsonRows,
      complimentaryByMemberstackId: new Map(
        complimentaryRows
          .filter((row) => row.memberstack_id && row.paid_through_ymd)
          .map((row) => [row.memberstack_id, row.paid_through_ymd as string]),
      ),
    }),
  };
}
