import { queryWatson } from "./db";

export const MEMBER_SEARCH_LIMIT = 50;

export interface LegacyMemberSearchRow {
  memberid: string;
  fristname: string | null;
  lastname: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  datejoined: Date | string | null;
}

export type WatsonQueryFn = <T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;

export function normalizeMemberSearchQuery(raw: string): string {
  return raw.trim();
}

export function isMemberSearchQueryUsable(query: string): boolean {
  return normalizeMemberSearchQuery(query).length > 0;
}

export function buildMemberSearchPattern(query: string): string {
  return `%${normalizeMemberSearchQuery(query)}%`;
}

export const MEMBER_SEARCH_SQL = `
  SELECT
    memberid,
    fristname,
    lastname,
    email,
    city,
    state,
    datejoined
  FROM legacy_members
  WHERE
    memberid ILIKE $1
    OR email ILIKE $1
    OR fristname ILIKE $1
    OR lastname ILIKE $1
  ORDER BY datejoined DESC NULLS LAST, lastname ASC NULLS LAST, fristname ASC NULLS LAST
  LIMIT $2
`;

export function formatMemberDisplayName(row: Pick<LegacyMemberSearchRow, "fristname" | "lastname">): string {
  const parts = [row.fristname, row.lastname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "";
}

export function formatMemberLocation(row: Pick<LegacyMemberSearchRow, "city" | "state">): string {
  const parts = [row.city, row.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

export function formatMemberJoinedDate(value: LegacyMemberSearchRow["datejoined"]): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function formatMemberJoinedDateDisplay(value: LegacyMemberSearchRow["datejoined"]): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function searchLegacyMembers(
  query: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<{ rows: LegacyMemberSearchRow[]; truncated: boolean; query: string }> {
  const normalized = normalizeMemberSearchQuery(query);
  if (!isMemberSearchQueryUsable(normalized)) {
    return { rows: [], truncated: false, query: normalized };
  }

  const pattern = buildMemberSearchPattern(normalized);
  const rows = await queryFn<LegacyMemberSearchRow>(MEMBER_SEARCH_SQL, [
    pattern,
    MEMBER_SEARCH_LIMIT + 1,
  ]);

  return {
    query: normalized,
    rows: rows.slice(0, MEMBER_SEARCH_LIMIT),
    truncated: rows.length > MEMBER_SEARCH_LIMIT,
  };
}
