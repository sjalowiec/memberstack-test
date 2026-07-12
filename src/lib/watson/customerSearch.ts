import {
  buildLegacyCustomerProfileUrl,
  buildLegacyMemberDetailUrl,
  buildMemberstackCustomerProfileUrl,
  classifyCustomerIdentifier,
  isMemberstackMemberId,
  resolveCustomerByMemberid,
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "./customerIdentifier";
import {
  isConnectionCurrentlyActive,
  type MemberstackMember,
} from "../membership/membershipSummary";
import {
  formatMemberstackDisplayName,
  loadCustomerMemberstackMember,
  resolveMemberstackMemberByExactEmail,
  searchMemberstackCustomerDirectory,
  type MemberstackGetMemberClient,
} from "./customerMemberstack";
import {
  formatMemberDisplayName,
  formatMemberJoinedDate,
  formatMemberJoinedDateDisplay,
  formatMemberLocation,
  isMemberSearchQueryUsable,
  MEMBER_SEARCH_LIMIT,
  searchLegacyMembers,
  type LegacyMemberSearchRow,
  type WatsonQueryFn,
} from "./memberSearch";

export const CUSTOMER_NAME_SEARCH_MIN_LENGTH = 2;

export function canRunMemberstackDirectorySearch(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) {
    return false;
  }

  const kind = classifyCustomerIdentifier(normalized);
  if (kind === "memberstack_id" || kind === "email") {
    return true;
  }

  return normalized.length >= CUSTOMER_NAME_SEARCH_MIN_LENGTH;
}

export type CustomerSearchLinkStatus =
  | "linked"
  | "legacy_only"
  | "memberstack_only"
  | "ambiguous_email";

export interface CustomerSearchResultRow {
  memberstackId: string | null;
  legacyMemberid: string | null;
  name: string;
  email: string | null;
  location: string;
  datejoinedDisplay: string;
  datejoinedSort: string;
  membershipStatus: string | null;
  profileHref: string | null;
  legacyProfileHref: string | null;
  memberstackProfileHref: string | null;
  legacyMemberHref: string | null;
  linkStatus: CustomerSearchLinkStatus;
  statusLabel: string;
}

function legacyRowFromLink(link: LegacyEmailLinkResult): LegacyMemberSearchRow | null {
  if (link.status !== "unique") {
    return null;
  }

  const member = link.member;
  return {
    memberid: member.memberid,
    fristname: member.fristname,
    lastname: member.lastname,
    email: member.email,
    city: member.city,
    state: member.state,
    datejoined: member.datejoined,
  };
}

async function resolveUniqueLegacySearchRow(
  email: string | null | undefined,
  queryFn?: WatsonQueryFn,
): Promise<LegacyMemberSearchRow | null> {
  if (!email) {
    return null;
  }
  const link = await resolveLegacyLinkByMemberstackEmail(email, queryFn);
  return legacyRowFromLink(link);
}

export interface CustomerSearchResult {
  query: string;
  rows: CustomerSearchResultRow[];
  truncated: boolean;
  configured: boolean;
  searchError: string | null;
}

type SearchDeps = {
  queryFn?: WatsonQueryFn;
  secretKey?: string | null;
  getClient?: (secretKey: string | null) => Promise<MemberstackGetMemberClient | null>;
};

function buildLinkedSearchRow(
  member: MemberstackMember,
  legacyMember: LegacyMemberSearchRow,
  searchQuery: string,
): CustomerSearchResultRow {
  const membershipStatus = (member.planConnections ?? []).some((connection) =>
    isConnectionCurrentlyActive(connection),
  )
    ? "Active"
    : "Inactive";

  return {
    memberstackId: member.id,
    legacyMemberid: legacyMember.memberid,
    name: formatMemberDisplayName(legacyMember),
    email: member.auth?.email ?? legacyMember.email,
    location: formatMemberLocation(legacyMember),
    datejoinedDisplay: formatMemberJoinedDateDisplay(legacyMember.datejoined),
    datejoinedSort: formatMemberJoinedDate(legacyMember.datejoined),
    membershipStatus,
    profileHref: buildMemberstackCustomerProfileUrl(member.id, searchQuery),
    legacyProfileHref: buildLegacyCustomerProfileUrl(legacyMember.memberid, searchQuery),
    memberstackProfileHref: buildMemberstackCustomerProfileUrl(member.id, searchQuery),
    legacyMemberHref: buildLegacyMemberDetailUrl(legacyMember.memberid),
    linkStatus: "linked",
    statusLabel: "Linked legacy + Memberstack",
  };
}

function buildMemberstackOnlySearchRow(
  member: MemberstackMember,
  searchQuery: string,
): CustomerSearchResultRow {
  const membershipStatus = (member.planConnections ?? []).some((connection) =>
    isConnectionCurrentlyActive(connection),
  )
    ? "Active"
    : "Inactive";

  return {
    memberstackId: member.id,
    legacyMemberid: null,
    name: formatMemberstackDisplayName(member),
    email: member.auth?.email ?? null,
    location: "",
    datejoinedDisplay: "",
    datejoinedSort: "",
    membershipStatus,
    profileHref: buildMemberstackCustomerProfileUrl(member.id, searchQuery),
    legacyProfileHref: null,
    memberstackProfileHref: buildMemberstackCustomerProfileUrl(member.id, searchQuery),
    legacyMemberHref: null,
    linkStatus: "memberstack_only",
    statusLabel: "Memberstack customer",
  };
}

function buildLegacyOnlySearchRow(
  legacyMember: LegacyMemberSearchRow,
  searchQuery: string,
): CustomerSearchResultRow {
  return {
    memberstackId: null,
    legacyMemberid: legacyMember.memberid,
    name: formatMemberDisplayName(legacyMember),
    email: legacyMember.email,
    location: formatMemberLocation(legacyMember),
    datejoinedDisplay: formatMemberJoinedDateDisplay(legacyMember.datejoined),
    datejoinedSort: formatMemberJoinedDate(legacyMember.datejoined),
    membershipStatus: null,
    profileHref: buildLegacyCustomerProfileUrl(legacyMember.memberid, searchQuery),
    legacyProfileHref: buildLegacyCustomerProfileUrl(legacyMember.memberid, searchQuery),
    memberstackProfileHref: null,
    legacyMemberHref: buildLegacyMemberDetailUrl(legacyMember.memberid),
    linkStatus: "legacy_only",
    statusLabel: "Legacy customer (not linked to Memberstack)",
  };
}

function buildAmbiguousLegacySearchRow(
  legacyMember: LegacyMemberSearchRow,
  searchQuery: string,
): CustomerSearchResultRow {
  return {
    memberstackId: null,
    legacyMemberid: legacyMember.memberid,
    name: formatMemberDisplayName(legacyMember),
    email: legacyMember.email,
    location: formatMemberLocation(legacyMember),
    datejoinedDisplay: formatMemberJoinedDateDisplay(legacyMember.datejoined),
    datejoinedSort: formatMemberJoinedDate(legacyMember.datejoined),
    membershipStatus: null,
    profileHref: buildLegacyCustomerProfileUrl(legacyMember.memberid, searchQuery),
    legacyProfileHref: buildLegacyCustomerProfileUrl(legacyMember.memberid, searchQuery),
    memberstackProfileHref: null,
    legacyMemberHref: buildLegacyMemberDetailUrl(legacyMember.memberid),
    linkStatus: "ambiguous_email",
    statusLabel: "Legacy customer (shared email)",
  };
}

async function enrichLegacyRowWithMemberstack(
  legacyMember: LegacyMemberSearchRow,
  searchQuery: string,
  deps: SearchDeps,
): Promise<CustomerSearchResultRow> {
  const member = await resolveMemberstackMemberByExactEmail(legacyMember.email, {
    secretKey: deps.secretKey,
    getClient: deps.getClient,
  });
  if (member) {
    return buildLinkedSearchRow(member, legacyMember, searchQuery);
  }
  return buildLegacyOnlySearchRow(legacyMember, searchQuery);
}

function dedupeSearchRows(rows: CustomerSearchResultRow[]): CustomerSearchResultRow[] {
  const seen = new Set<string>();
  const deduped: CustomerSearchResultRow[] = [];

  for (const row of rows) {
    const key =
      row.linkStatus === "linked" && row.memberstackId && row.legacyMemberid
        ? `linked:${row.memberstackId}:${row.legacyMemberid}`
        : row.memberstackId
          ? `memberstack:${row.memberstackId}`
          : `legacy:${row.legacyMemberid}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

export async function searchCustomers(
  query: string,
  deps: SearchDeps = {},
): Promise<CustomerSearchResult> {
  const normalized = query.trim();
  if (!isMemberSearchQueryUsable(normalized)) {
    return {
      query: normalized,
      rows: [],
      truncated: false,
      configured: false,
      searchError: null,
    };
  }

  const kind = classifyCustomerIdentifier(normalized);
  const rows: CustomerSearchResultRow[] = [];
  let truncated = false;
  let configured = true;
  let searchError: string | null = null;

  if (isMemberstackMemberId(normalized)) {
    const direct = await loadCustomerMemberstackMember({
      lookupValue: normalized,
      secretKey: deps.secretKey,
      getClient: deps.getClient,
    });
    if (direct.ok) {
      const legacyRow = await resolveUniqueLegacySearchRow(
        direct.member.auth?.email,
        deps.queryFn,
      );
      rows.push(
        legacyRow
          ? buildLinkedSearchRow(direct.member, legacyRow, normalized)
          : buildMemberstackOnlySearchRow(direct.member, normalized),
      );
    } else {
      searchError = direct.error;
      configured = direct.error !== "Memberstack admin API is not configured.";
    }

    return { query: normalized, rows, truncated: false, configured, searchError };
  }

  if (kind === "email") {
    const member = await resolveMemberstackMemberByExactEmail(normalized, {
      secretKey: deps.secretKey,
      getClient: deps.getClient,
    });
    if (member) {
      const legacyRow = await resolveUniqueLegacySearchRow(normalized, deps.queryFn);
      rows.push(
        legacyRow
          ? buildLinkedSearchRow(member, legacyRow, normalized)
          : buildMemberstackOnlySearchRow(member, normalized),
      );
    }

    const legacyLink = await resolveLegacyLinkByMemberstackEmail(normalized, deps.queryFn);
    if (legacyLink.status === "unique") {
      if (!member) {
        rows.push(
          buildLegacyOnlySearchRow(
            {
              memberid: legacyLink.member.memberid,
              fristname: legacyLink.member.fristname,
              lastname: legacyLink.member.lastname,
              email: legacyLink.member.email,
              city: legacyLink.member.city,
              state: legacyLink.member.state,
              datejoined: legacyLink.member.datejoined,
            },
            normalized,
          ),
        );
      }
    } else if (legacyLink.status === "ambiguous") {
      for (const legacyMember of legacyLink.members) {
        rows.push(
          buildAmbiguousLegacySearchRow(
            {
              memberid: legacyMember.memberid,
              fristname: legacyMember.fristname,
              lastname: legacyMember.lastname,
              email: legacyMember.email,
              city: legacyMember.city,
              state: legacyMember.state,
              datejoined: legacyMember.datejoined,
            },
            normalized,
          ),
        );
      }
    }

    return {
      query: normalized,
      rows: dedupeSearchRows(rows),
      truncated: false,
      configured,
      searchError: rows.length === 0 ? "No customers found for this email." : null,
    };
  }

  if (kind === "memberid") {
    const legacyResolution = await resolveCustomerByMemberid(normalized, deps.queryFn);
    if (legacyResolution.member) {
      rows.push(
        await enrichLegacyRowWithMemberstack(
          {
            memberid: legacyResolution.member.memberid,
            fristname: legacyResolution.member.fristname,
            lastname: legacyResolution.member.lastname,
            email: legacyResolution.member.email,
            city: legacyResolution.member.city,
            state: legacyResolution.member.state,
            datejoined: legacyResolution.member.datejoined,
          },
          normalized,
          deps,
        ),
      );
      return { query: normalized, rows, truncated: false, configured, searchError: null };
    }
  }

  if (!canRunMemberstackDirectorySearch(normalized)) {
    return {
      query: normalized,
      rows: [],
      truncated: false,
      configured: true,
      searchError: `Enter at least ${CUSTOMER_NAME_SEARCH_MIN_LENGTH} characters for a name search.`,
    };
  }

  const directory = await searchMemberstackCustomerDirectory(normalized, {
    secretKey: deps.secretKey,
    getClient: deps.getClient,
    limit: MEMBER_SEARCH_LIMIT,
  });
  configured = directory.configured;
  searchError = directory.error;
  truncated = directory.truncated;

  for (const member of directory.members) {
    const legacyRow = await resolveUniqueLegacySearchRow(member.auth?.email, deps.queryFn);
    rows.push(
      legacyRow
        ? buildLinkedSearchRow(member, legacyRow, normalized)
        : buildMemberstackOnlySearchRow(member, normalized),
    );
  }

  if (rows.length < MEMBER_SEARCH_LIMIT) {
    const legacyNameMatches = await searchLegacyMembers(normalized, deps.queryFn);
    truncated = truncated || legacyNameMatches.truncated;

    for (const legacyMember of legacyNameMatches.rows) {
      if (rows.length >= MEMBER_SEARCH_LIMIT) {
        truncated = true;
        break;
      }
      const enriched = await enrichLegacyRowWithMemberstack(legacyMember, normalized, deps);
      rows.push(enriched);
    }
  }

  return {
    query: normalized,
    rows: dedupeSearchRows(rows).slice(0, MEMBER_SEARCH_LIMIT),
    truncated,
    configured,
    searchError,
  };
}

export function describeCustomerSearchQuery(query: string): string {
  const kind = classifyCustomerIdentifier(query);
  switch (kind) {
    case "email":
      return "exact email";
    case "memberstack_id":
      return "Memberstack member ID";
    case "memberid":
      return "legacy member ID";
    default:
      return "name, email, or customer ID";
  }
}

export { MEMBER_SEARCH_LIMIT };
