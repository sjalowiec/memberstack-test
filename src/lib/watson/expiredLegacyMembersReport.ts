/**
 * Read-only list of active legacy-membership members whose Watson paid-through
 * date is before today in America/Los_Angeles. Does not write anything.
 */
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import type { ActiveCampaignListStatus } from "../activecampaign/client";
import {
  getActivePlanIds,
  hasCurrentComplimentaryAccess,
  hasPaidMemberAccess,
  isActiveMemberstackPlanConnection,
} from "../memberAccess";
import { billingIntervalFromActivePaidConnection } from "../membership/accountMembershipPanel";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import { customerEmailLookupKeys, normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  LEGACY_MEMBERSHIP_PLAN_ID,
  listMemberstackMembersForDiagnostic,
  type ComplimentaryDateRow,
  type MemberstackListClient,
} from "./legacyRenewalDiagnostic";
import type { WatsonQueryFn } from "./memberSearch";

const MONTHLY_PAID_PLAN_IDS = new Set<string>([
  LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlyPremium.memberstackPlanId,
  LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
  LEGACY_MEMBERSHIPS.importedMonthlySubscription.memberstackPlanId,
]);
const ANNUAL_PAID_PLAN_IDS = new Set<string>([
  LEGACY_MEMBERSHIPS.grandfatheredAnnual.memberstackPlanId,
]);
const CURRENT_PAID_PLAN_ID = MEMBERSHIPS.membership.memberstackPlanId;

export const EXPIRED_LEGACY_MEMBERS_WATSON_SQL = `
  SELECT
    memberid,
    NULLIF(btrim(fristname), '') AS first_name,
    NULLIF(btrim(lastname), '') AS last_name,
    NULLIF(lower(btrim(email)), '') AS email,
    CASE
      WHEN subscriptionexpiring IS NULL THEN NULL
      ELSE to_char((subscriptionexpiring AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
    END AS paid_through_ymd
  FROM legacy_members
`;

export const EXPIRED_LEGACY_MEMBERS_COMPLIMENTARY_SQL = `
  SELECT memberstack_id, to_char(access_through, 'YYYY-MM-DD') AS paid_through_ymd
  FROM watson_complimentary_access
  WHERE access_through IS NOT NULL
`;

export interface ExpiredLegacyWatsonRow {
  memberid: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  paid_through_ymd: string | null;
}

export type PaidMembershipLabel = "no" | "monthly" | "annual" | "paid";
export type KnitItNowListLabel =
  | "subscribed"
  | "unsubscribed"
  | "not on list"
  | "unconfirmed"
  | "bounced"
  | "not in ActiveCampaign"
  | "unknown";

export interface ExpiredLegacyMemberRow {
  name: string;
  email: string;
  paidThrough: string;
  daysSinceExpiration: number;
  paidMembership: PaidMembershipLabel;
  complimentaryAccess: boolean;
  knitItNowList: KnitItNowListLabel;
}

export interface UnresolvedLegacyMemberRow {
  name: string;
  email: string;
  reason: "no Watson match" | "no paid-through date" | "more than one Watson member";
  watsonMembers: Array<{ name: string; email: string; paidThrough: string | null }>;
}

export interface ExpiredLegacyMembersReport {
  ok: true;
  todayLosAngeles: string;
  truncated: boolean;
  noOtherAccess: ExpiredLegacyMemberRow[];
  covered: ExpiredLegacyMemberRow[];
  unresolved: UnresolvedLegacyMemberRow[];
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

function personName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function memberstackName(member: MemberstackMember): string {
  return personName(member.auth?.firstName, member.auth?.lastName);
}

function watsonName(row: ExpiredLegacyWatsonRow): string {
  return personName(row.first_name, row.last_name);
}

export function daysSincePaidThrough(todayYmd: string, paidThroughYmd: string): number {
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  const paidThrough = Date.parse(`${paidThroughYmd}T00:00:00Z`);
  return Math.round((today - paidThrough) / 86_400_000);
}

export function paidMembershipLabel(member: MemberstackMember): PaidMembershipLabel {
  if (!hasPaidMemberAccess(member)) return "no";
  const interval = billingIntervalFromActivePaidConnection(member);
  if (interval === "monthly" || interval === "annual") return interval;
  const active = new Set(getActivePlanIds(member));
  const monthly = [...active].some((id) => MONTHLY_PAID_PLAN_IDS.has(id));
  const annual = [...active].some((id) => ANNUAL_PAID_PLAN_IDS.has(id));
  const current = active.has(CURRENT_PAID_PLAN_ID);
  if (annual && !monthly && !current) return "annual";
  if (monthly && !annual && !current) return "monthly";
  return "paid";
}

export function knitItNowListLabel(
  status: ActiveCampaignListStatus | "no_contact" | null,
): KnitItNowListLabel {
  switch (status) {
    case "active":
      return "subscribed";
    case "unsubscribed":
      return "unsubscribed";
    case "not_on_list":
      return "not on list";
    case "unconfirmed":
      return "unconfirmed";
    case "bounced":
      return "bounced";
    case "no_contact":
      return "not in ActiveCampaign";
    default:
      return "unknown";
  }
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

export function classifyExpiredLegacyMembers(input: {
  todayYmd: string;
  members: MemberstackMember[];
  watsonRows: ExpiredLegacyWatsonRow[];
  complimentaryByMemberstackId: Map<string, string>;
}): {
  expired: Array<Omit<ExpiredLegacyMemberRow, "knitItNowList"> & { emailKey: string }>;
  unresolved: UnresolvedLegacyMemberRow[];
} {
  const index = indexWatsonRows(input.watsonRows);
  const expired: Array<Omit<ExpiredLegacyMemberRow, "knitItNowList"> & { emailKey: string }> = [];
  const unresolved: UnresolvedLegacyMemberRow[] = [];

  for (const member of input.members) {
    if (!hasActiveLegacyPlan(member)) continue;
    const email = normalizeCustomerEmail(member.auth?.email) ?? "";
    const matches = watsonMatches(email, index);
    const fallbackName = memberstackName(member);
    if (matches.length === 0) {
      unresolved.push({
        name: fallbackName,
        email,
        reason: "no Watson match",
        watsonMembers: [],
      });
      continue;
    }
    if (matches.length > 1) {
      unresolved.push({
        name: fallbackName || watsonName(matches[0]),
        email: email || matches[0]?.email || "",
        reason: "more than one Watson member",
        watsonMembers: matches.map((row) => ({
          name: watsonName(row) || fallbackName,
          email: row.email ?? email,
          paidThrough: row.paid_through_ymd,
        })),
      });
      continue;
    }
    const row = matches[0];
    const paidThrough = row?.paid_through_ymd ?? null;
    if (!paidThrough) {
      unresolved.push({
        name: watsonName(row) || fallbackName,
        email: email || row?.email || "",
        reason: "no paid-through date",
        watsonMembers: [
          {
            name: watsonName(row),
            email: row?.email ?? email,
            paidThrough: null,
          },
        ],
      });
      continue;
    }
    if (paidThrough >= input.todayYmd) continue;
    const complimentaryYmd = input.complimentaryByMemberstackId.has(member.id)
      ? (input.complimentaryByMemberstackId.get(member.id) ?? null)
      : null;
    expired.push({
      name: watsonName(row) || fallbackName,
      email: email || row?.email || "",
      emailKey: email || normalizeCustomerEmail(row?.email) || "",
      paidThrough,
      daysSinceExpiration: daysSincePaidThrough(input.todayYmd, paidThrough),
      paidMembership: paidMembershipLabel(member),
      complimentaryAccess: hasCurrentComplimentaryAccess(member, {
        complimentaryThroughYmd: complimentaryYmd,
        todayYmd: input.todayYmd,
      }),
    });
  }

  expired.sort(
    (a, b) => b.daysSinceExpiration - a.daysSinceExpiration || a.email.localeCompare(b.email),
  );
  unresolved.sort((a, b) => a.email.localeCompare(b.email) || a.reason.localeCompare(b.reason));
  return { expired, unresolved };
}

export async function loadExpiredLegacyMembersReport(options: {
  listMembers?: MemberstackListClient;
  queryFn?: WatsonQueryFn;
  now?: Date;
  listStatusForEmail?: (email: string) => Promise<ActiveCampaignListStatus | "no_contact" | null>;
}): Promise<ExpiredLegacyMembersReport> {
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
  const classified = classifyExpiredLegacyMembers({
    todayYmd: todayLosAngeles,
    members: listed.members,
    watsonRows,
    complimentaryByMemberstackId: new Map(
      complimentaryRows
        .filter((row) => row.memberstack_id && row.paid_through_ymd)
        .map((row) => [row.memberstack_id, row.paid_through_ymd as string]),
    ),
  });

  const listLabels = new Map<string, KnitItNowListLabel>();
  if (options.listStatusForEmail) {
    const emails = [
      ...new Set(classified.expired.map((row) => row.emailKey).filter(Boolean)),
    ];
    for (const email of emails) {
      try {
        listLabels.set(email, knitItNowListLabel(await options.listStatusForEmail(email)));
      } catch {
        listLabels.set(email, "unknown");
      }
    }
  }

  const withList = classified.expired.map((row) => {
    const { emailKey: _emailKey, ...rest } = row;
    return {
      ...rest,
      knitItNowList: listLabels.get(row.emailKey) ?? "unknown",
    };
  });

  return {
    ok: true,
    todayLosAngeles,
    truncated: listed.truncated,
    noOtherAccess: withList.filter(
      (row) => row.paidMembership === "no" && !row.complimentaryAccess,
    ),
    covered: withList.filter((row) => row.paidMembership !== "no" || row.complimentaryAccess),
    unresolved: classified.unresolved,
  };
}
