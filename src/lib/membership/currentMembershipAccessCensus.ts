/**
 * One current-membership decision per person.
 *
 * A person is one mailbox. Gmail and Googlemail share a person. Two Memberstack
 * accounts on that mailbox stay unresolved instead of being counted twice or
 * collapsed by guesswork.
 *
 * This is not the Current Legacy Members report. That report is one legacy row
 * per imported subscription screen, excludes beta, and ignores a newer paid plan.
 */
import { calendarYmdForNow } from "./membershipStatusSummary";
import { CURRENT_MEMBER_PLAN_IDS } from "../../config/memberships";
import {
  getActivePlanIds,
  hasComplimentaryMemberAccess,
  hasCurrentComplimentaryAccess,
  hasPaidMemberAccess,
  MEMBER_ACCESS_CALENDAR_TIMEZONE,
} from "../memberAccess";
import { queryWatson } from "../watson/db";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { getSharedMemberstackAdminClient } from "../watson/customerMemberstack";
import type { MemberstackMember } from "./membershipSummary";
import {
  canonicalMembershipEmail,
  decideCurrentMembershipAccess,
  type CurrentMembershipAccessDecision,
} from "./currentMembershipAccess";

export const MEMBERSHIP_ACCESS_CENSUS_PAGE_SIZE = 100;
export const MEMBERSHIP_ACCESS_CENSUS_MAX_PAGES = 200;

export const MEMBERSHIP_ACCESS_LEGACY_SQL = `
  SELECT
    m.memberid,
    m.email,
    CASE
      WHEN m.subscriptionexpiring IS NULL THEN NULL
      ELSE to_char(
        (timezone('America/Los_Angeles', m.subscriptionexpiring))::date,
        'YYYY-MM-DD'
      )
    END AS paid_through_ymd
  FROM legacy_members m
  WHERE m.email IS NOT NULL
    AND btrim(m.email) <> ''
`;

export const MEMBERSHIP_ACCESS_COMPLIMENTARY_SQL = `
  SELECT memberstack_id, to_char(access_through, 'YYYY-MM-DD') AS access_through_ymd
  FROM watson_complimentary_access
`;

export interface LegacyAccessRow {
  memberid: string;
  email: string | null;
  paidThroughYmd: string | null;
}

export interface ComplimentaryAccessFact {
  memberstackId: string;
  accessThroughYmd: string | null;
}

export type MembershipAccessYesBasis =
  | "current_paid"
  | "legacy_paid_shell"
  | "complimentary"
  | "legacy_date";

export interface MembershipAccessPerson {
  email: string;
  outcome: CurrentMembershipAccessDecision["outcome"];
  value: "yes" | "no" | null;
  /** Which access rule produced yes. Null unless outcome is yes. */
  basis: MembershipAccessYesBasis | null;
  reason: string | null;
  memberstackId: string | null;
  memberstackIds: string[];
  legacyMemberIds: string[];
}

export interface CurrentMembershipAccessCensus {
  todayLosAngeles: string;
  memberstackTruncated: boolean;
  memberstackAccountCount: number;
  legacyLoaded: boolean;
  complimentaryLoaded: boolean;
  yesByBasis: Record<MembershipAccessYesBasis, number>;
  /** Memberstack accounts with no email. They are not counted as current members. */
  missingEmail: number;
  watsonYesCount: number;
  watsonNoCount: number;
  unresolvedCount: number;
  people: MembershipAccessPerson[];
}

const currentPaidPlanIds = new Set<string>(CURRENT_MEMBER_PLAN_IDS);

function yesBasis(
  member: MemberstackMember | null,
  complimentaryThroughYmd: string | null | undefined,
  todayYmd: string,
): MembershipAccessYesBasis {
  if (member && hasPaidMemberAccess(member)) {
    const ids = getActivePlanIds(member);
    return ids.some((id) => currentPaidPlanIds.has(id)) ? "current_paid" : "legacy_paid_shell";
  }
  if (
    member &&
    hasComplimentaryMemberAccess(member) &&
    complimentaryThroughYmd !== undefined &&
    hasCurrentComplimentaryAccess(member, { complimentaryThroughYmd, todayYmd })
  ) {
    return "complimentary";
  }
  return "legacy_date";
}

export function buildCurrentMembershipAccessCensus(input: {
  todayYmd: string;
  members: MemberstackMember[];
  memberstackTruncated: boolean;
  legacyRows: LegacyAccessRow[] | null;
  complimentaryRows: ComplimentaryAccessFact[] | null;
}): CurrentMembershipAccessCensus {
  type Bucket = {
    email: string;
    members: MemberstackMember[];
    legacy: Array<{ memberid: string; ymd: string | null }>;
  };
  const buckets = new Map<string, Bucket>();
  let missingEmail = 0;

  const bucketFor = (email: string | null | undefined): Bucket | null => {
    const key = canonicalMembershipEmail(email);
    if (!key) return null;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { email: key, members: [], legacy: [] };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const member of input.members) {
    const bucket = bucketFor(member.auth?.email);
    if (!bucket) {
      missingEmail += 1;
      continue;
    }
    bucket.members.push(member);
  }
  for (const row of input.legacyRows ?? []) {
    const bucket = bucketFor(row.email);
    if (!bucket) continue;
    bucket.legacy.push({ memberid: row.memberid, ymd: row.paidThroughYmd });
  }

  const complimentaryById = new Map(
    (input.complimentaryRows ?? []).map((row) => [row.memberstackId, row.accessThroughYmd]),
  );

  const people: MembershipAccessPerson[] = [];
  for (const bucket of buckets.values()) {
    const memberIds = [...new Set(bucket.members.map((member) => member.id).filter(Boolean))];
    const memberstack =
      memberIds.length > 1
        ? "ambiguous"
        : memberIds.length === 1
          ? "unique"
          : input.memberstackTruncated
            ? "unavailable"
            : "not_found";
    const member = memberIds.length === 1 ? bucket.members.find((item) => item.id === memberIds[0]) ?? null : null;
    const complimentaryThroughYmd =
      input.complimentaryRows === null
        ? undefined
        : memberIds.length === 1
          ? (complimentaryById.get(memberIds[0]) ?? null)
          : undefined;
    const decision = decideCurrentMembershipAccess({
      memberstack,
      member,
      legacyPaidThroughYmds: input.legacyRows === null ? null : bucket.legacy.map((row) => row.ymd),
      complimentaryThroughYmd,
      todayYmd: input.todayYmd,
    });
    people.push({
      email: bucket.email,
      outcome: decision.outcome,
      value: decision.outcome === "unresolved" ? null : decision.value,
      basis:
        decision.outcome === "yes"
          ? yesBasis(member, complimentaryThroughYmd, input.todayYmd)
          : null,
      reason: decision.outcome === "unresolved" ? decision.reason : null,
      memberstackId: memberIds.length === 1 ? memberIds[0] : null,
      memberstackIds: memberIds,
      legacyMemberIds: [...new Set(bucket.legacy.map((row) => row.memberid))],
    });
  }

  people.sort((a, b) => a.email.localeCompare(b.email));
  const yesByBasis: Record<MembershipAccessYesBasis, number> = {
    current_paid: 0,
    legacy_paid_shell: 0,
    complimentary: 0,
    legacy_date: 0,
  };
  for (const person of people) {
    if (person.basis) yesByBasis[person.basis] += 1;
  }
  return {
    todayLosAngeles: input.todayYmd,
    memberstackTruncated: input.memberstackTruncated,
    memberstackAccountCount: input.members.length,
    legacyLoaded: input.legacyRows !== null,
    complimentaryLoaded: input.complimentaryRows !== null,
    yesByBasis,
    missingEmail,
    watsonYesCount: people.filter((person) => person.outcome === "yes").length,
    watsonNoCount: people.filter((person) => person.outcome === "no").length,
    unresolvedCount: people.filter((person) => person.outcome === "unresolved").length + missingEmail,
    people,
  };
}

async function loadMemberstackMembers(secretKey?: string): Promise<{
  members: MemberstackMember[];
  truncated: boolean;
}> {
  const client = await getSharedMemberstackAdminClient(secretKey);
  if (!client?.listMembers) {
    throw new Error("Memberstack admin API is not configured.");
  }
  const members: MemberstackMember[] = [];
  let after: number | string | undefined;
  for (let page = 0; page < MEMBERSHIP_ACCESS_CENSUS_MAX_PAGES; page += 1) {
    const res = await client.listMembers({
      limit: MEMBERSHIP_ACCESS_CENSUS_PAGE_SIZE,
      after,
      order: "ASC",
    });
    const data = Array.isArray(res?.data) ? (res.data as MemberstackMember[]) : [];
    members.push(...data);
    if (!res?.hasNextPage || data.length === 0) {
      return { members, truncated: false };
    }
    after = res.endCursor;
    if (page === MEMBERSHIP_ACCESS_CENSUS_MAX_PAGES - 1) {
      return { members, truncated: true };
    }
  }
  return { members, truncated: true };
}

export async function loadCurrentMembershipAccessCensus(
  options: { queryFn?: WatsonQueryFn; now?: Date; memberstackSecretKey?: string } = {},
): Promise<CurrentMembershipAccessCensus> {
  const queryFn = options.queryFn ?? queryWatson;
  const todayYmd = calendarYmdForNow(options.now ?? new Date(), MEMBER_ACCESS_CALENDAR_TIMEZONE);
  const [{ members, truncated }, legacyResult, complimentaryResult] = await Promise.all([
    loadMemberstackMembers(options.memberstackSecretKey),
    queryFn<{ memberid: string; email: string | null; paid_through_ymd: string | null }>(
      MEMBERSHIP_ACCESS_LEGACY_SQL,
    ).then(
      (rows) =>
        rows.map((row) => ({
          memberid: row.memberid,
          email: row.email,
          paidThroughYmd: row.paid_through_ymd,
        })),
      () => null,
    ),
    queryFn<{ memberstack_id: string; access_through_ymd: string | null }>(
      MEMBERSHIP_ACCESS_COMPLIMENTARY_SQL,
    ).then(
      (rows) =>
        rows.map((row) => ({
          memberstackId: row.memberstack_id,
          accessThroughYmd: row.access_through_ymd,
        })),
      () => null,
    ),
  ]);

  return buildCurrentMembershipAccessCensus({
    todayYmd,
    members,
    memberstackTruncated: truncated,
    legacyRows: legacyResult,
    complimentaryRows: complimentaryResult,
  });
}
