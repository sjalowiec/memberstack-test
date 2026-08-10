/**
 * Former members with no Memberstack account (strict email list).
 *
 * Read-only Watson report: finds legacy members whose Watson paid-through date
 * (`legacy_members.subscriptionexpiring`) ended within the last eight months,
 * then checks live Memberstack by normalized email. Only `not_found` results
 * belong on the downloadable email CSV.
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
import { rowsToCsv, toDateOnlyIso } from "./legacyMembershipReportsShared";
import { formatLegacyTimestampDisplay } from "./memberMembership";
import { formatMemberDisplayName, type WatsonQueryFn } from "./memberSearch";

/** Calendar months for the former-member lookback window. */
export const FORMER_MEMBERS_LOOKBACK_MONTHS = 8;

export const FORMER_MEMBERS_NO_MEMBERSTACK_SQL = `
  SELECT
    m.memberid,
    m.fristname,
    m.lastname,
    m.email,
    m.subscriptionexpiring
  FROM legacy_members m
  WHERE m.subscriptionexpiring IS NOT NULL
    AND m.subscriptionexpiring::date < $1::date
    AND m.subscriptionexpiring::date >= $2::date
  ORDER BY m.subscriptionexpiring DESC NULLS LAST, m.memberid ASC
`;

export type FormerMemberCandidateRow = {
  memberid: string;
  fristname: string | null;
  lastname: string | null;
  email: string | null;
  subscriptionexpiring: Date | string | null;
};

export type FormerMemberReviewBucket =
  | "email_list"
  | "memberstack_found"
  | "ambiguous"
  | "lookup_error"
  | "missing_or_invalid_email"
  | "duplicate_watson";

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
};

export type FormerMembersNoMemberstackSummary = {
  watsonCandidates: number;
  emailList: number;
  memberstackFound: number;
  ambiguous: number;
  lookupError: number;
  missingOrInvalidEmail: number;
  duplicateWatson: number;
};

export type FormerMembersNoMemberstackReport = {
  asOfDateDisplay: string;
  todayLosAngeles: string;
  windowStartYmd: string;
  lookbackMonths: number;
  note: string;
  summary: FormerMembersNoMemberstackSummary;
  emailList: FormerMemberReportRow[];
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

export const EMAIL_LIST_QUALIFICATION_REASON =
  "Watson paid-through ended within the last 8 months; no Memberstack member found for this email";

export const MEMBERSTACK_NOT_FOUND_RESULT = "No Memberstack account";
export const MEMBERSTACK_FOUND_RESULT = "Memberstack account found";
export const MEMBERSTACK_AMBIGUOUS_RESULT = "Ambiguous email match";
export const MEMBERSTACK_LOOKUP_ERROR_RESULT = "Lookup error";
export const MISSING_EMAIL_RESULT = "Missing or invalid email";
export const DUPLICATE_WATSON_RESULT = "Duplicate Watson record";

const WATSON_EXPIRED_STATUS = "Expired";

const REPORT_NOTE =
  "Read-only report. Watson paid-through comes from legacy_members.subscriptionexpiring. Memberstack account presence is a live Admin email lookup. Only strict not_found rows are included in the email CSV. Incomplete or truncated Memberstack scans fail closed and do not produce an email list.";

/**
 * Subtract calendar months from a YYYY-MM-DD string (UTC date arithmetic).
 * Used for the eight-month lookback lower bound.
 */
export function subtractMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCMonth(base.getUTCMonth() - months);
  return base.toISOString().slice(0, 10);
}

export function isValidReportEmail(email: string | null | undefined): string | null {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized || !isEmailLikeIdentifier(normalized)) {
    return null;
  }
  return normalized;
}

export async function loadFormerMemberCandidates(
  todayLosAngeles: string,
  windowStartYmd: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<FormerMemberCandidateRow[]> {
  return queryFn<FormerMemberCandidateRow>(FORMER_MEMBERS_NO_MEMBERSTACK_SQL, [
    todayLosAngeles,
    windowStartYmd,
  ]);
}

function trimNamePart(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function buildBaseRow(
  candidate: FormerMemberCandidateRow,
  overrides: {
    normalizedEmail: string | null;
    memberstackResult: string;
    memberstackId: string | null;
    qualificationReason: string;
    bucket: FormerMemberReviewBucket;
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
  };
}

/**
 * Classify Watson candidates against Memberstack resolutions (pure / testable).
 * Callers must fail closed before invoking this when the Memberstack scan is
 * truncated or unavailable.
 */
export function classifyFormerMemberCandidates(
  candidates: FormerMemberCandidateRow[],
  resolveMemberstack: (normalizedEmail: string) => MemberstackEmailResolution,
): Omit<
  FormerMembersNoMemberstackReport,
  "asOfDateDisplay" | "todayLosAngeles" | "windowStartYmd" | "lookbackMonths" | "note"
> {
  const emailList: FormerMemberReportRow[] = [];
  const memberstackFound: FormerMemberReportRow[] = [];
  const ambiguous: FormerMemberReportRow[] = [];
  const lookupError: FormerMemberReportRow[] = [];
  const missingOrInvalidEmail: FormerMemberReportRow[] = [];
  const duplicateWatson: FormerMemberReportRow[] = [];

  const byEmail = new Map<string, FormerMemberCandidateRow[]>();

  for (const candidate of candidates) {
    const normalizedEmail = isValidReportEmail(candidate.email);
    if (!normalizedEmail) {
      missingOrInvalidEmail.push(
        buildBaseRow(candidate, {
          normalizedEmail: null,
          memberstackResult: MISSING_EMAIL_RESULT,
          memberstackId: null,
          qualificationReason:
            "Watson paid-through ended within the last 8 months; missing or invalid email",
          bucket: "missing_or_invalid_email",
        }),
      );
      continue;
    }

    const group = byEmail.get(normalizedEmail) ?? [];
    group.push(candidate);
    byEmail.set(normalizedEmail, group);
  }

  for (const [normalizedEmail, group] of byEmail) {
    const distinctMemberIds = new Set(group.map((row) => row.memberid));
    if (distinctMemberIds.size > 1) {
      for (const candidate of group) {
        duplicateWatson.push(
          buildBaseRow(candidate, {
            normalizedEmail,
            memberstackResult: DUPLICATE_WATSON_RESULT,
            memberstackId: null,
            qualificationReason: `Shared Watson email across ${distinctMemberIds.size} legacy member records; excluded from email list`,
            bucket: "duplicate_watson",
          }),
        );
      }
      continue;
    }

    const candidate = group[0];
    let resolution: MemberstackEmailResolution;
    try {
      resolution = resolveMemberstack(normalizedEmail);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 200) : "lookup failed";
      lookupError.push(
        buildBaseRow(candidate, {
          normalizedEmail,
          memberstackResult: MEMBERSTACK_LOOKUP_ERROR_RESULT,
          memberstackId: null,
          qualificationReason: `Memberstack lookup error: ${message}`,
          bucket: "lookup_error",
        }),
      );
      continue;
    }

    if (resolution.status === "not_found") {
      emailList.push(
        buildBaseRow(candidate, {
          normalizedEmail,
          memberstackResult: MEMBERSTACK_NOT_FOUND_RESULT,
          memberstackId: null,
          qualificationReason: EMAIL_LIST_QUALIFICATION_REASON,
          bucket: "email_list",
        }),
      );
      continue;
    }

    if (resolution.status === "unique") {
      memberstackFound.push(
        buildBaseRow(candidate, {
          normalizedEmail,
          memberstackResult: MEMBERSTACK_FOUND_RESULT,
          memberstackId: resolution.member.id,
          qualificationReason:
            "Memberstack account found for this email; excluded from email list",
          bucket: "memberstack_found",
        }),
      );
      continue;
    }

    if (resolution.status === "ambiguous") {
      ambiguous.push(
        buildBaseRow(candidate, {
          normalizedEmail,
          memberstackResult: MEMBERSTACK_AMBIGUOUS_RESULT,
          memberstackId: null,
          qualificationReason:
            "Ambiguous Memberstack email match; excluded from email list",
          bucket: "ambiguous",
        }),
      );
      continue;
    }

    lookupError.push(
      buildBaseRow(candidate, {
        normalizedEmail,
        memberstackResult: MEMBERSTACK_LOOKUP_ERROR_RESULT,
        memberstackId: null,
        qualificationReason: `Memberstack lookup error: ${resolution.error}`,
        bucket: "lookup_error",
      }),
    );
  }

  const sortRows = (rows: FormerMemberReportRow[]) =>
    [...rows].sort((a, b) => {
      const dateCmp = b.subscriptionExpiringSort.localeCompare(
        a.subscriptionExpiringSort,
      );
      if (dateCmp !== 0) return dateCmp;
      return a.memberid.localeCompare(b.memberid);
    });

  const sortedEmailList = sortRows(emailList);
  const sortedFound = sortRows(memberstackFound);
  const sortedAmbiguous = sortRows(ambiguous);
  const sortedLookupError = sortRows(lookupError);
  const sortedMissing = sortRows(missingOrInvalidEmail);
  const sortedDuplicates = sortRows(duplicateWatson);

  return {
    summary: {
      watsonCandidates: candidates.length,
      emailList: sortedEmailList.length,
      memberstackFound: sortedFound.length,
      ambiguous: sortedAmbiguous.length,
      lookupError: sortedLookupError.length,
      missingOrInvalidEmail: sortedMissing.length,
      duplicateWatson: sortedDuplicates.length,
    },
    emailList: sortedEmailList,
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
  candidates: FormerMemberCandidateRow[],
  options: LoadFormerMembersNoMemberstackReportOptions,
): Promise<(normalizedEmail: string) => MemberstackEmailResolution> {
  const emailCounts = new Map<string, Set<string>>();
  for (const candidate of candidates) {
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
  const windowStartYmd = subtractMonthsYmd(
    todayLosAngeles,
    FORMER_MEMBERS_LOOKBACK_MONTHS,
  );
  const queryFn = options.queryFn ?? queryWatson;

  const candidates = await loadFormerMemberCandidates(
    todayLosAngeles,
    windowStartYmd,
    queryFn,
  );

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
    lookbackMonths: FORMER_MEMBERS_LOOKBACK_MONTHS,
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
