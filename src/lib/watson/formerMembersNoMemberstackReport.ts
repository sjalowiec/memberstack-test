/**
 * Former legacy annual members with no Memberstack account (strict email list).
 *
 * Read-only Watson report: confirmed legacy annual / annual-installment members
 * whose Watson paid-through date (`legacy_members.subscriptionexpiring`) is on
 * or after 2025-11-01 and before today, with no obvious monthly evidence, then
 * a live Memberstack Admin email lookup. Only `not_found` results belong on the
 * downloadable email CSV.
 *
 * Annual product classification reuses Remaining Annual Access helpers
 * (`isObviousMonthlyMember`, `isConfirmedAnnualSingle`, `isInstallmentAnnual`).
 * Probable / unresolved / manual types are review-only and never enter the CSV.
 *
 * Never writes to Memberstack, ActiveCampaign, Stripe, or Watson.
 */
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  buildLegacyCustomerProfileUrl,
  isEmailLikeIdentifier,
  normalizeCustomerEmail,
} from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  buildMemberstackEmailIndex,
  defaultLoadMemberstackMembers,
  resolveMemberstackMemberFromIndex,
  type LoadMemberstackMembers,
  type MemberstackEmailResolution,
  type ResolveMemberstackMemberByEmail,
} from "./legacyAnnualExpiry";
import {
  buildBaseMemberFields,
  rowsToCsv,
  toDateOnlyIso,
  type CurrentLegacyMemberQueryRow,
} from "./legacyMembershipReportsShared";
import { formatLegacyTimestampDisplay } from "./memberMembership";
import { formatMemberDisplayName, type WatsonQueryFn } from "./memberSearch";
import {
  isConfirmedAnnualSingle,
  isInstallmentAnnual,
  isObviousMonthlyMember,
} from "./remainingAnnualAccessReport";

/** Inclusive lower bound for Watson paid-through dates in this report. */
export const FORMER_MEMBERS_WINDOW_START_YMD = "2025-11-01";

export const FORMER_MEMBERS_NO_MEMBERSTACK_SQL = `
  WITH window_members AS (
    SELECT
      m.memberid,
      m.fristname,
      m.lastname,
      m.email,
      m.subscriptiontype,
      m.subscriptiondate,
      m.subscriptionexpiring,
      m.monthlysubscriber,
      m.subscriptionrenewal,
      m.currentsubscriber,
      m.stripcustomerid
    FROM legacy_members m
    WHERE m.subscriptionexpiring IS NOT NULL
      AND m.subscriptionexpiring::date < $1::date
      AND m.subscriptionexpiring::date >= $2::date
  ),
  latest_sub AS (
    SELECT DISTINCT ON (s.memberid_fk)
      s.memberid_fk,
      s.subscriptionid,
      s.dollaramount,
      s.processor,
      s.subscriptionrate_id,
      s.monthlybilling,
      s.expirationdate,
      s.datebought,
      s.premium,
      s.arb_id
    FROM legacy_subscriptions s
    INNER JOIN window_members wm ON wm.memberid = s.memberid_fk
    ORDER BY s.memberid_fk, s.datebought DESC NULLS LAST, s.subscriptionid DESC
  ),
  sub_counts AS (
    SELECT
      s.memberid_fk,
      COUNT(*)::int AS subscription_row_count,
      COUNT(*) FILTER (
        WHERE COALESCE(s.monthlybilling, 0) = 0
      )::int AS non_monthly_subscription_row_count
    FROM legacy_subscriptions s
    INNER JOIN window_members wm ON wm.memberid = s.memberid_fk
    GROUP BY s.memberid_fk
  )
  SELECT
    wm.memberid,
    wm.fristname,
    wm.lastname,
    wm.email,
    wm.subscriptiontype,
    wm.subscriptiondate,
    wm.subscriptionexpiring,
    (wm.subscriptionexpiring::date - CURRENT_DATE)::int AS days_remaining,
    wm.monthlysubscriber,
    wm.subscriptionrenewal,
    wm.currentsubscriber,
    wm.stripcustomerid,
    ls.subscriptionid AS latest_subscriptionid,
    ls.dollaramount AS latest_amount,
    ls.processor AS latest_processor,
    ls.subscriptionrate_id AS latest_rate_id,
    ls.monthlybilling AS latest_monthlybilling,
    ls.expirationdate AS latest_expirationdate,
    ls.datebought AS latest_datebought,
    ls.premium AS latest_premium,
    ls.arb_id AS latest_arb_id,
    COALESCE(sc.subscription_row_count, 0) AS subscription_row_count,
    COALESCE(sc.non_monthly_subscription_row_count, 0) AS non_monthly_subscription_row_count
  FROM window_members wm
  LEFT JOIN latest_sub ls ON ls.memberid_fk = wm.memberid
  LEFT JOIN sub_counts sc ON sc.memberid_fk = wm.memberid
  ORDER BY wm.subscriptionexpiring DESC NULLS LAST, wm.memberid ASC
`;

export type FormerMemberAnnualKind =
  | "confirmed_annual_single"
  | "annual_installment";

export type FormerMemberMembershipTypeBucket =
  | FormerMemberAnnualKind
  | "monthly_like"
  | "unresolved_membership_type";

export type FormerMemberReviewBucket =
  | "email_list"
  | "memberstack_found"
  | "ambiguous"
  | "lookup_error"
  | "missing_or_invalid_email"
  | "duplicate_watson"
  | "monthly_like"
  | "unresolved_membership_type";

export type FormerMemberReportRow = {
  memberid: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string | null;
  normalizedEmail: string | null;
  subscriptionExpiringDisplay: string | null;
  subscriptionExpiringIso: string | null;
  subscriptionExpiringSort: string;
  watsonStatus: string;
  memberstackResult: string;
  memberstackId: string | null;
  qualificationReason: string;
  profileHref: string;
  bucket: FormerMemberReviewBucket;
  annualKind: FormerMemberAnnualKind | null;
  membershipTypeBucket: FormerMemberMembershipTypeBucket | null;
};

export type FormerMembersEmailListByMonth = Array<{
  month: string;
  count: number;
}>;

export type FormerMembersNoMemberstackSummary = {
  watsonCandidates: number;
  confirmedAnnualSingle: number;
  annualInstallment: number;
  monthlyLike: number;
  unresolvedMembershipType: number;
  emailList: number;
  memberstackFound: number;
  ambiguous: number;
  lookupError: number;
  missingOrInvalidEmail: number;
  duplicateWatson: number;
  emailListByExpirationMonth: FormerMembersEmailListByMonth;
};

export type FormerMembersNoMemberstackReport = {
  asOfDateDisplay: string;
  todayLosAngeles: string;
  windowStartYmd: string;
  note: string;
  summary: FormerMembersNoMemberstackSummary;
  emailList: FormerMemberReportRow[];
  confirmedAnnualSingle: FormerMemberReportRow[];
  annualInstallment: FormerMemberReportRow[];
  monthlyLike: FormerMemberReportRow[];
  unresolvedMembershipType: FormerMemberReportRow[];
  memberstackFound: FormerMemberReportRow[];
  ambiguous: FormerMemberReportRow[];
  lookupError: FormerMemberReportRow[];
  missingOrInvalidEmail: FormerMemberReportRow[];
  duplicateWatson: FormerMemberReportRow[];
};

export const FORMER_MEMBERS_EMAIL_CSV_HEADERS = [
  "First name",
  "Last name",
  "Email",
  "Old subscription end date",
  "Watson status",
  "Memberstack result",
  "Qualification reason",
] as const;

export const QUALIFICATION_CONFIRMED_ANNUAL =
  "Confirmed legacy annual; Watson paid-through on/after 2025-11-01; no Memberstack member found for this email";

export const QUALIFICATION_ANNUAL_INSTALLMENT =
  "Confirmed legacy annual installment; Watson paid-through on/after 2025-11-01; no Memberstack member found for this email";

export const MEMBERSTACK_NOT_FOUND_RESULT = "No Memberstack account";
export const MEMBERSTACK_FOUND_RESULT = "Memberstack account found";
export const MEMBERSTACK_AMBIGUOUS_RESULT = "Ambiguous email match";
export const MEMBERSTACK_LOOKUP_ERROR_RESULT = "Lookup error";
export const MISSING_EMAIL_RESULT = "Missing or invalid email";
export const DUPLICATE_WATSON_RESULT = "Duplicate Watson record";
export const MONTHLY_LIKE_RESULT = "Monthly-like exclusion";
export const UNRESOLVED_MEMBERSHIP_TYPE_RESULT = "Unresolved membership type";

const WATSON_EXPIRED_STATUS = "Expired";

const REPORT_NOTE =
  "Read-only report of confirmed legacy annual (and annual-installment) memberships whose Watson paid-through date is on or after November 1, 2025 and before today. Obvious monthly records are excluded. Probable/unresolved membership types are review-only. Memberstack account presence is a live Admin email lookup; only strict not_found rows are included in the email CSV. Incomplete or truncated Memberstack scans fail closed.";

export function isValidReportEmail(email: string | null | undefined): string | null {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized || !isEmailLikeIdentifier(normalized)) {
    return null;
  }
  return normalized;
}

export function classifyFormerMemberMembershipType(
  queryRow: CurrentLegacyMemberQueryRow,
): FormerMemberMembershipTypeBucket {
  const base = buildBaseMemberFields(queryRow);
  if (isObviousMonthlyMember(base)) {
    return "monthly_like";
  }
  if (isConfirmedAnnualSingle(base)) {
    return "confirmed_annual_single";
  }
  if (isInstallmentAnnual(base)) {
    return "annual_installment";
  }
  return "unresolved_membership_type";
}

export async function loadFormerMemberCandidates(
  todayLosAngeles: string,
  windowStartYmd: string = FORMER_MEMBERS_WINDOW_START_YMD,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CurrentLegacyMemberQueryRow[]> {
  return queryFn<CurrentLegacyMemberQueryRow>(FORMER_MEMBERS_NO_MEMBERSTACK_SQL, [
    todayLosAngeles,
    windowStartYmd,
  ]);
}

function trimNamePart(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function qualificationReasonForAnnualKind(
  kind: FormerMemberAnnualKind,
): string {
  return kind === "annual_installment"
    ? QUALIFICATION_ANNUAL_INSTALLMENT
    : QUALIFICATION_CONFIRMED_ANNUAL;
}

function buildBaseRow(
  candidate: CurrentLegacyMemberQueryRow,
  overrides: {
    normalizedEmail: string | null;
    memberstackResult: string;
    memberstackId: string | null;
    qualificationReason: string;
    bucket: FormerMemberReviewBucket;
    annualKind: FormerMemberAnnualKind | null;
    membershipTypeBucket: FormerMemberMembershipTypeBucket | null;
  },
): FormerMemberReportRow {
  const firstName = trimNamePart(candidate.fristname);
  const lastName = trimNamePart(candidate.lastname);
  const name =
    formatMemberDisplayName(candidate) ||
    overrides.normalizedEmail ||
    candidate.memberid;

  return {
    memberid: candidate.memberid,
    firstName,
    lastName,
    name,
    email: candidate.email?.trim() || null,
    normalizedEmail: overrides.normalizedEmail,
    subscriptionExpiringDisplay: formatLegacyTimestampDisplay(
      candidate.subscriptionexpiring,
    ),
    subscriptionExpiringIso: toDateOnlyIso(candidate.subscriptionexpiring),
    subscriptionExpiringSort:
      toDateOnlyIso(candidate.subscriptionexpiring) ?? "",
    watsonStatus: WATSON_EXPIRED_STATUS,
    memberstackResult: overrides.memberstackResult,
    memberstackId: overrides.memberstackId,
    qualificationReason: overrides.qualificationReason,
    profileHref: buildLegacyCustomerProfileUrl(candidate.memberid),
    bucket: overrides.bucket,
    annualKind: overrides.annualKind,
    membershipTypeBucket: overrides.membershipTypeBucket,
  };
}

function sortRows(rows: FormerMemberReportRow[]): FormerMemberReportRow[] {
  return [...rows].sort((a, b) => {
    const dateCmp = b.subscriptionExpiringSort.localeCompare(
      a.subscriptionExpiringSort,
    );
    if (dateCmp !== 0) return dateCmp;
    return a.memberid.localeCompare(b.memberid);
  });
}

function emailListByExpirationMonth(
  rows: FormerMemberReportRow[],
): FormerMembersEmailListByMonth {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const month = row.subscriptionExpiringIso?.slice(0, 7);
    if (!month) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function emptyClassifiedResult(
  watsonCandidates: number,
): Omit<
  FormerMembersNoMemberstackReport,
  "asOfDateDisplay" | "todayLosAngeles" | "windowStartYmd" | "note"
> {
  return {
    summary: {
      watsonCandidates,
      confirmedAnnualSingle: 0,
      annualInstallment: 0,
      monthlyLike: 0,
      unresolvedMembershipType: 0,
      emailList: 0,
      memberstackFound: 0,
      ambiguous: 0,
      lookupError: 0,
      missingOrInvalidEmail: 0,
      duplicateWatson: 0,
      emailListByExpirationMonth: [],
    },
    emailList: [],
    confirmedAnnualSingle: [],
    annualInstallment: [],
    monthlyLike: [],
    unresolvedMembershipType: [],
    memberstackFound: [],
    ambiguous: [],
    lookupError: [],
    missingOrInvalidEmail: [],
    duplicateWatson: [],
  };
}

/**
 * Classify Watson window candidates by membership type, then resolve Memberstack
 * only for confirmed annual / installment rows. Callers must fail closed before
 * invoking this when the Memberstack scan is truncated or unavailable.
 */
export function classifyFormerMemberCandidates(
  candidates: CurrentLegacyMemberQueryRow[],
  resolveMemberstack: (normalizedEmail: string) => MemberstackEmailResolution,
): Omit<
  FormerMembersNoMemberstackReport,
  "asOfDateDisplay" | "todayLosAngeles" | "windowStartYmd" | "note"
> {
  const monthlyLike: FormerMemberReportRow[] = [];
  const unresolvedMembershipType: FormerMemberReportRow[] = [];

  const annualEligible: Array<{
    candidate: CurrentLegacyMemberQueryRow;
    annualKind: FormerMemberAnnualKind;
  }> = [];

  for (const candidate of candidates) {
    const membershipType = classifyFormerMemberMembershipType(candidate);

    if (membershipType === "monthly_like") {
      monthlyLike.push(
        buildBaseRow(candidate, {
          normalizedEmail: isValidReportEmail(candidate.email),
          memberstackResult: MONTHLY_LIKE_RESULT,
          memberstackId: null,
          qualificationReason:
            "Obvious monthly evidence (monthlysubscriber, latest monthlybilling, or monthly amount); excluded from email list",
          bucket: "monthly_like",
          annualKind: null,
          membershipTypeBucket: "monthly_like",
        }),
      );
      continue;
    }

    if (membershipType === "unresolved_membership_type") {
      unresolvedMembershipType.push(
        buildBaseRow(candidate, {
          normalizedEmail: isValidReportEmail(candidate.email),
          memberstackResult: UNRESOLVED_MEMBERSHIP_TYPE_RESULT,
          memberstackId: null,
          qualificationReason:
            "Not confirmed annual/installment (probable, manual/complimentary, or unresolved); manual review only",
          bucket: "unresolved_membership_type",
          annualKind: null,
          membershipTypeBucket: "unresolved_membership_type",
        }),
      );
      continue;
    }

    annualEligible.push({ candidate, annualKind: membershipType });
  }

  const emailList: FormerMemberReportRow[] = [];
  const memberstackFound: FormerMemberReportRow[] = [];
  const ambiguous: FormerMemberReportRow[] = [];
  const lookupError: FormerMemberReportRow[] = [];
  const missingOrInvalidEmail: FormerMemberReportRow[] = [];
  const duplicateWatson: FormerMemberReportRow[] = [];
  const confirmedAnnualSingle: FormerMemberReportRow[] = [];
  const annualInstallment: FormerMemberReportRow[] = [];

  const pushAnnualInventory = (row: FormerMemberReportRow) => {
    if (row.annualKind === "annual_installment") {
      annualInstallment.push(row);
    } else if (row.annualKind === "confirmed_annual_single") {
      confirmedAnnualSingle.push(row);
    }
  };

  const byEmail = new Map<
    string,
    Array<{ candidate: CurrentLegacyMemberQueryRow; annualKind: FormerMemberAnnualKind }>
  >();

  for (const entry of annualEligible) {
    const normalizedEmail = isValidReportEmail(entry.candidate.email);
    if (!normalizedEmail) {
      const row = buildBaseRow(entry.candidate, {
        normalizedEmail: null,
        memberstackResult: MISSING_EMAIL_RESULT,
        memberstackId: null,
        qualificationReason:
          "Confirmed legacy annual/installment; missing or invalid email",
        bucket: "missing_or_invalid_email",
        annualKind: entry.annualKind,
        membershipTypeBucket: entry.annualKind,
      });
      missingOrInvalidEmail.push(row);
      pushAnnualInventory(row);
      continue;
    }

    const group = byEmail.get(normalizedEmail) ?? [];
    group.push(entry);
    byEmail.set(normalizedEmail, group);
  }

  for (const [normalizedEmail, group] of byEmail) {
    const distinctMemberIds = new Set(group.map((row) => row.candidate.memberid));
    if (distinctMemberIds.size > 1) {
      for (const entry of group) {
        const row = buildBaseRow(entry.candidate, {
          normalizedEmail,
          memberstackResult: DUPLICATE_WATSON_RESULT,
          memberstackId: null,
          qualificationReason: `Shared Watson email across ${distinctMemberIds.size} legacy member records; excluded from email list`,
          bucket: "duplicate_watson",
          annualKind: entry.annualKind,
          membershipTypeBucket: entry.annualKind,
        });
        duplicateWatson.push(row);
        pushAnnualInventory(row);
      }
      continue;
    }

    const entry = group[0];
    const { candidate, annualKind } = entry;

    let resolution: MemberstackEmailResolution;
    try {
      resolution = resolveMemberstack(normalizedEmail);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 200) : "lookup failed";
      const row = buildBaseRow(candidate, {
        normalizedEmail,
        memberstackResult: MEMBERSTACK_LOOKUP_ERROR_RESULT,
        memberstackId: null,
        qualificationReason: `Memberstack lookup error: ${message}`,
        bucket: "lookup_error",
        annualKind,
        membershipTypeBucket: annualKind,
      });
      lookupError.push(row);
      pushAnnualInventory(row);
      continue;
    }

    if (resolution.status === "not_found") {
      const row = buildBaseRow(candidate, {
        normalizedEmail,
        memberstackResult: MEMBERSTACK_NOT_FOUND_RESULT,
        memberstackId: null,
        qualificationReason: qualificationReasonForAnnualKind(annualKind),
        bucket: "email_list",
        annualKind,
        membershipTypeBucket: annualKind,
      });
      emailList.push(row);
      pushAnnualInventory(row);
      continue;
    }

    if (resolution.status === "unique") {
      const row = buildBaseRow(candidate, {
        normalizedEmail,
        memberstackResult: MEMBERSTACK_FOUND_RESULT,
        memberstackId: resolution.member.id,
        qualificationReason:
          "Memberstack account found for this email; excluded from email list",
        bucket: "memberstack_found",
        annualKind,
        membershipTypeBucket: annualKind,
      });
      memberstackFound.push(row);
      pushAnnualInventory(row);
      continue;
    }

    if (resolution.status === "ambiguous") {
      const row = buildBaseRow(candidate, {
        normalizedEmail,
        memberstackResult: MEMBERSTACK_AMBIGUOUS_RESULT,
        memberstackId: null,
        qualificationReason:
          "Ambiguous Memberstack email match; excluded from email list",
        bucket: "ambiguous",
        annualKind,
        membershipTypeBucket: annualKind,
      });
      ambiguous.push(row);
      pushAnnualInventory(row);
      continue;
    }

    const row = buildBaseRow(candidate, {
      normalizedEmail,
      memberstackResult: MEMBERSTACK_LOOKUP_ERROR_RESULT,
      memberstackId: null,
      qualificationReason: `Memberstack lookup error: ${resolution.error}`,
      bucket: "lookup_error",
      annualKind,
      membershipTypeBucket: annualKind,
    });
    lookupError.push(row);
    pushAnnualInventory(row);
  }

  const sortedEmailList = sortRows(emailList);
  const sortedFound = sortRows(memberstackFound);
  const sortedAmbiguous = sortRows(ambiguous);
  const sortedLookupError = sortRows(lookupError);
  const sortedMissing = sortRows(missingOrInvalidEmail);
  const sortedDuplicates = sortRows(duplicateWatson);
  const sortedMonthly = sortRows(monthlyLike);
  const sortedUnresolved = sortRows(unresolvedMembershipType);
  const sortedConfirmedAnnual = sortRows(confirmedAnnualSingle);
  const sortedInstallment = sortRows(annualInstallment);

  return {
    summary: {
      watsonCandidates: candidates.length,
      confirmedAnnualSingle: sortedConfirmedAnnual.length,
      annualInstallment: sortedInstallment.length,
      monthlyLike: sortedMonthly.length,
      unresolvedMembershipType: sortedUnresolved.length,
      emailList: sortedEmailList.length,
      memberstackFound: sortedFound.length,
      ambiguous: sortedAmbiguous.length,
      lookupError: sortedLookupError.length,
      missingOrInvalidEmail: sortedMissing.length,
      duplicateWatson: sortedDuplicates.length,
      emailListByExpirationMonth: emailListByExpirationMonth(sortedEmailList),
    },
    emailList: sortedEmailList,
    confirmedAnnualSingle: sortedConfirmedAnnual,
    annualInstallment: sortedInstallment,
    monthlyLike: sortedMonthly,
    unresolvedMembershipType: sortedUnresolved,
    memberstackFound: sortedFound,
    ambiguous: sortedAmbiguous,
    lookupError: sortedLookupError,
    missingOrInvalidEmail: sortedMissing,
    duplicateWatson: sortedDuplicates,
  };
}

export type LoadFormerMembersNoMemberstackReportOptions = {
  now?: Date;
  queryFn?: WatsonQueryFn;
  loadMemberstackMembers?: LoadMemberstackMembers;
  /**
   * Optional per-email resolver for tests. When omitted, the report loads all
   * Memberstack members once and resolves against an in-memory email index.
   */
  resolveMemberstackMemberByEmail?: ResolveMemberstackMemberByEmail;
};

export class FormerMembersReportIncompleteScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormerMembersReportIncompleteScanError";
  }
}

async function resolveEmailsForClassification(
  candidates: CurrentLegacyMemberQueryRow[],
  options: LoadFormerMembersNoMemberstackReportOptions,
): Promise<(normalizedEmail: string) => MemberstackEmailResolution> {
  const emailCounts = new Map<string, Set<string>>();
  for (const candidate of candidates) {
    const membershipType = classifyFormerMemberMembershipType(candidate);
    if (
      membershipType !== "confirmed_annual_single" &&
      membershipType !== "annual_installment"
    ) {
      continue;
    }
    const normalized = isValidReportEmail(candidate.email);
    if (!normalized) continue;
    const ids = emailCounts.get(normalized) ?? new Set<string>();
    ids.add(candidate.memberid);
    emailCounts.set(normalized, ids);
  }

  const emailsNeedingLookup = [...emailCounts.entries()]
    .filter(([, ids]) => ids.size === 1)
    .map(([email]) => email);

  if (options.resolveMemberstackMemberByEmail) {
    const resolutions = new Map<string, MemberstackEmailResolution>();
    for (const email of emailsNeedingLookup) {
      try {
        resolutions.set(
          email,
          await options.resolveMemberstackMemberByEmail(email),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 200) : "lookup failed";
        resolutions.set(email, { status: "error", error: message });
      }
    }
    return (normalizedEmail) =>
      resolutions.get(normalizedEmail) ?? { status: "not_found" };
  }

  const loadMembers =
    options.loadMemberstackMembers ?? defaultLoadMemberstackMembers;
  let members: MemberstackMember[];
  let truncated: boolean;
  try {
    ({ members, truncated } = await loadMembers());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Memberstack scan failed";
    throw new FormerMembersReportIncompleteScanError(
      `Memberstack member scan failed; refusing to build the email list. ${message}`,
    );
  }
  if (truncated) {
    throw new FormerMembersReportIncompleteScanError(
      "Memberstack member scan was truncated; refusing to treat incomplete results as missing Memberstack accounts.",
    );
  }

  const index = buildMemberstackEmailIndex(members);
  return (normalizedEmail) =>
    resolveMemberstackMemberFromIndex(index, normalizedEmail);
}

export async function loadFormerMembersNoMemberstackReport(
  options: LoadFormerMembersNoMemberstackReportOptions = {},
): Promise<FormerMembersNoMemberstackReport> {
  const now = options.now ?? new Date();
  const todayLosAngeles = calendarYmdForNow(
    now,
    MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
  );
  const windowStartYmd = FORMER_MEMBERS_WINDOW_START_YMD;
  const queryFn = options.queryFn ?? queryWatson;

  const candidates = await loadFormerMemberCandidates(
    todayLosAngeles,
    windowStartYmd,
    queryFn,
  );

  if (candidates.length === 0) {
    return {
      asOfDateDisplay: now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      todayLosAngeles,
      windowStartYmd,
      note: REPORT_NOTE,
      ...emptyClassifiedResult(0),
    };
  }

  const resolveMember = await resolveEmailsForClassification(
    candidates,
    options,
  );
  const classified = classifyFormerMemberCandidates(candidates, resolveMember);

  return {
    asOfDateDisplay: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    todayLosAngeles,
    windowStartYmd,
    note: REPORT_NOTE,
    ...classified,
  };
}

export function formerMemberEmailRowToCsvCells(
  row: FormerMemberReportRow,
): string[] {
  return [
    row.firstName ?? "",
    row.lastName ?? "",
    row.email ?? "",
    row.subscriptionExpiringDisplay ?? "",
    row.watsonStatus,
    row.memberstackResult,
    row.qualificationReason,
  ];
}

export function formerMembersEmailListToCsv(
  rows: FormerMemberReportRow[],
): string {
  return rowsToCsv(
    [...FORMER_MEMBERS_EMAIL_CSV_HEADERS],
    rows.map(formerMemberEmailRowToCsvCells),
  );
}
