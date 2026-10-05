/**
 * Read-only production diagnostic for legacy renewal reminders.
 * Counts only. Does not write Memberstack, Watson, or ActiveCampaign.
 */
import { COMPLIMENTARY_MEMBERSHIPS, FREE_ACCESS_MEMBERSHIPS } from "../../config/memberships";
import { isActiveMemberstackPlanConnection } from "../memberAccess";
import { memberHasActivePaidMembership } from "../membership/membershipCheckoutDecision";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import { customerEmailLookupKeys, normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import { REMINDER_TAG_BY_WINDOW, REMINDER_WINDOW_DAYS } from "./legacyRenewalReminders";
import type { WatsonQueryFn } from "./memberSearch";

export const LEGACY_MEMBERSHIP_PLAN_ID =
  FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId;
export const COMPLIMENTARY_MEMBERSHIP_PLAN_ID =
  COMPLIMENTARY_MEMBERSHIPS.complimentaryMembership.memberstackPlanId;

/** Stop after this many pages so a diagnostic cannot run without a bound. */
export const LEGACY_DIAGNOSTIC_MAX_PAGES = 200;
export const LEGACY_DIAGNOSTIC_PAGE_SIZE = 100;

export const LEGACY_RENEWAL_DIAGNOSTIC_WATSON_SQL = `
  SELECT
    memberid,
    NULLIF(lower(btrim(email)), '') AS email,
    CASE
      WHEN subscriptionexpiring IS NULL THEN NULL
      ELSE to_char((subscriptionexpiring AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
    END AS paid_through_ymd
  FROM legacy_members
`;

export const LEGACY_RENEWAL_DIAGNOSTIC_COMPLIMENTARY_SQL = `
  SELECT memberstack_id, to_char(access_through, 'YYYY-MM-DD') AS paid_through_ymd
  FROM watson_complimentary_access
  WHERE access_through IS NOT NULL
`;

export const LEGACY_RENEWAL_DIAGNOSTIC_AUDIT_SQL = `
  SELECT tag_name, outcome, count(*)::int AS n
  FROM watson_legacy_renewal_reminders
  GROUP BY tag_name, outcome
  ORDER BY tag_name ASC, outcome ASC
`;

export interface MemberstackListPage {
  totalCount?: number;
  endCursor?: number | string;
  hasNextPage?: boolean;
  data?: unknown[];
}

export interface MemberstackListClient {
  listMembers: (options?: {
    limit?: number;
    after?: number | string;
    order?: "ASC" | "DESC";
  }) => Promise<MemberstackListPage>;
}

export interface WatsonPaidThroughRow {
  memberid: string;
  email: string | null;
  paid_through_ymd: string | null;
}

export interface ComplimentaryDateRow {
  memberstack_id: string;
  paid_through_ymd: string | null;
}

export interface AuditCountRow {
  tag_name: string;
  outcome: string;
  n: number;
}

export interface LegacyRenewalDateCounts {
  future: number;
  today: number;
  expired: number;
  missing: number;
  ambiguous: number;
}

export interface LegacyRenewalDiagnosticReport {
  ok: true;
  todayLosAngeles: string;
  memberstack: {
    pages: number;
    scanned: number;
    truncated: boolean;
    reportedTotalCount: number | null;
    activeLegacyMembership: number;
    inactiveLegacyConnectionOnly: number;
  };
  dates: LegacyRenewalDateCounts;
  missingBreakdown: {
    unmatched: number;
    noDate: number;
  };
  activePaidMembership: number;
  complimentaryExtendsBeyondLegacyDate: number;
  reminderLiveEnabled: boolean;
  renewalTagNames: string[];
  audit: {
    available: boolean;
    total: number;
    rows: Array<{ tagName: string; outcome: string; count: number }>;
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

function connectionsOf(member: MemberstackMember): unknown[] {
  return Array.isArray(member.planConnections) ? member.planConnections : [];
}

function hasActivePlan(member: MemberstackMember, planId: string): boolean {
  return connectionsOf(member).some(
    (connection) =>
      planIdOf(connection) === planId && isActiveMemberstackPlanConnection(connection),
  );
}

function hasInactiveLegacyOnly(member: MemberstackMember): boolean {
  const connections = connectionsOf(member).filter(
    (connection) => planIdOf(connection) === LEGACY_MEMBERSHIP_PLAN_ID,
  );
  if (connections.length === 0) return false;
  return !connections.some((connection) => isActiveMemberstackPlanConnection(connection));
}

export function legacyRenewalLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true";
}

export function renewalTagNamesInDeployedCode(): string[] {
  return REMINDER_WINDOW_DAYS.map((days) => REMINDER_TAG_BY_WINDOW[days]);
}

export function buildWatsonPaidThroughIndex(
  rows: WatsonPaidThroughRow[],
): Map<string, WatsonPaidThroughRow[]> {
  const index = new Map<string, WatsonPaidThroughRow[]>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const key of customerEmailLookupKeys(row.email)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const group = index.get(key) ?? [];
      if (!group.some((existing) => existing.memberid === row.memberid)) {
        group.push(row);
      }
      index.set(key, group);
    }
  }
  return index;
}

function watsonMatchesForEmail(
  email: string | null,
  index: Map<string, WatsonPaidThroughRow[]>,
): WatsonPaidThroughRow[] {
  const matches = new Map<string, WatsonPaidThroughRow>();
  for (const key of customerEmailLookupKeys(email)) {
    for (const row of index.get(key) ?? []) {
      matches.set(row.memberid, row);
    }
  }
  return [...matches.values()];
}

export function summarizeLegacyMembershipSegment(input: {
  todayYmd: string;
  members: MemberstackMember[];
  watsonByEmail: Map<string, WatsonPaidThroughRow[]>;
  complimentaryByMemberstackId: Map<string, string>;
}): Pick<
  LegacyRenewalDiagnosticReport,
  | "dates"
  | "missingBreakdown"
  | "activePaidMembership"
  | "complimentaryExtendsBeyondLegacyDate"
> & {
  activeLegacyMembership: number;
  inactiveLegacyConnectionOnly: number;
} {
  const dates: LegacyRenewalDateCounts = {
    future: 0,
    today: 0,
    expired: 0,
    missing: 0,
    ambiguous: 0,
  };
  const missingBreakdown = { unmatched: 0, noDate: 0 };
  let activeLegacyMembership = 0;
  let inactiveLegacyConnectionOnly = 0;
  let activePaidMembership = 0;
  let complimentaryExtendsBeyondLegacyDate = 0;

  for (const member of input.members) {
    const activeLegacy = hasActivePlan(member, LEGACY_MEMBERSHIP_PLAN_ID);
    if (!activeLegacy) {
      if (hasInactiveLegacyOnly(member)) inactiveLegacyConnectionOnly += 1;
      continue;
    }
    activeLegacyMembership += 1;
    if (memberHasActivePaidMembership(member)) activePaidMembership += 1;

    const email = normalizeCustomerEmail(member.auth?.email);
    const matches = watsonMatchesForEmail(email, input.watsonByEmail);
    if (matches.length > 1) {
      dates.ambiguous += 1;
      continue;
    }
    if (matches.length === 0) {
      dates.missing += 1;
      missingBreakdown.unmatched += 1;
      continue;
    }
    const paidThrough = matches[0]?.paid_through_ymd ?? null;
    if (!paidThrough) {
      dates.missing += 1;
      missingBreakdown.noDate += 1;
      continue;
    }
    if (paidThrough > input.todayYmd) dates.future += 1;
    else if (paidThrough === input.todayYmd) dates.today += 1;
    else dates.expired += 1;

    const complimentaryYmd = input.complimentaryByMemberstackId.get(member.id) ?? null;
    const openComplimentary =
      hasActivePlan(member, COMPLIMENTARY_MEMBERSHIP_PLAN_ID) && !complimentaryYmd;
    if (openComplimentary || (complimentaryYmd != null && complimentaryYmd > paidThrough)) {
      complimentaryExtendsBeyondLegacyDate += 1;
    }
  }

  return {
    activeLegacyMembership,
    inactiveLegacyConnectionOnly,
    dates,
    missingBreakdown,
    activePaidMembership,
    complimentaryExtendsBeyondLegacyDate,
  };
}

export async function listMemberstackMembersForDiagnostic(
  client: MemberstackListClient,
): Promise<{
  members: MemberstackMember[];
  pages: number;
  truncated: boolean;
  reportedTotalCount: number | null;
}> {
  const members: MemberstackMember[] = [];
  let after: number | string | undefined;
  let reportedTotalCount: number | null = null;
  let pages = 0;
  let truncated = false;

  for (let page = 0; page < LEGACY_DIAGNOSTIC_MAX_PAGES; page += 1) {
    const response = await client.listMembers({
      limit: LEGACY_DIAGNOSTIC_PAGE_SIZE,
      after,
      order: "ASC",
    });
    pages += 1;
    if (reportedTotalCount == null && typeof response.totalCount === "number") {
      reportedTotalCount = response.totalCount;
    }
    const data = Array.isArray(response.data) ? (response.data as MemberstackMember[]) : [];
    members.push(...data);
    if (!response.hasNextPage || data.length === 0) {
      return { members, pages, truncated: false, reportedTotalCount };
    }
    after = response.endCursor;
    if (page === LEGACY_DIAGNOSTIC_MAX_PAGES - 1) truncated = true;
  }

  return { members, pages, truncated, reportedTotalCount };
}

function isUndefinedTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: unknown }).code === "42P01") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /does not exist/i.test(message);
}

export async function loadLegacyRenewalDiagnostic(
  options: {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    listMembers?: MemberstackListClient;
    queryFn?: WatsonQueryFn;
  } = {},
): Promise<LegacyRenewalDiagnosticReport> {
  const queryFn = options.queryFn ?? queryWatson;
  const todayLosAngeles = calendarYmdForNow(
    options.now ?? new Date(),
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  if (!options.listMembers) {
    throw new Error("Memberstack admin API is not configured.");
  }
  const listed = await listMemberstackMembersForDiagnostic(options.listMembers);
  const watsonRows = await queryFn<WatsonPaidThroughRow>(LEGACY_RENEWAL_DIAGNOSTIC_WATSON_SQL);
  const complimentaryRows = await queryFn<ComplimentaryDateRow>(
    LEGACY_RENEWAL_DIAGNOSTIC_COMPLIMENTARY_SQL,
  );
  const summary = summarizeLegacyMembershipSegment({
    todayYmd: todayLosAngeles,
    members: listed.members,
    watsonByEmail: buildWatsonPaidThroughIndex(watsonRows),
    complimentaryByMemberstackId: new Map(
      complimentaryRows
        .filter((row) => row.paid_through_ymd)
        .map((row) => [row.memberstack_id, row.paid_through_ymd as string]),
    ),
  });

  let audit: LegacyRenewalDiagnosticReport["audit"] = {
    available: false,
    total: 0,
    rows: [],
  };
  try {
    const auditRows = await queryFn<AuditCountRow>(LEGACY_RENEWAL_DIAGNOSTIC_AUDIT_SQL);
    audit = {
      available: true,
      total: auditRows.reduce((sum, row) => sum + Number(row.n), 0),
      rows: auditRows.map((row) => ({
        tagName: row.tag_name,
        outcome: row.outcome,
        count: Number(row.n),
      })),
    };
  } catch (error) {
    if (!isUndefinedTable(error)) throw error;
  }

  return {
    ok: true,
    todayLosAngeles,
    memberstack: {
      pages: listed.pages,
      scanned: listed.members.length,
      truncated: listed.truncated,
      reportedTotalCount: listed.reportedTotalCount,
      activeLegacyMembership: summary.activeLegacyMembership,
      inactiveLegacyConnectionOnly: summary.inactiveLegacyConnectionOnly,
    },
    dates: summary.dates,
    missingBreakdown: summary.missingBreakdown,
    activePaidMembership: summary.activePaidMembership,
    complimentaryExtendsBeyondLegacyDate: summary.complimentaryExtendsBeyondLegacyDate,
    reminderLiveEnabled: legacyRenewalLiveEnabled(options.env),
    renewalTagNames: renewalTagNamesInDeployedCode(),
    audit,
  };
}
