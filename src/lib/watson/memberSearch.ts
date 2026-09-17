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
  return raw.trim().replace(/\s+/g, " ");
}

export function isMemberSearchQueryUsable(query: string): boolean {
  return normalizeMemberSearchQuery(query).length > 0;
}

export function memberSearchTokens(query: string): string[] {
  return normalizeMemberSearchQuery(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildMemberSearchPattern(query: string): string {
  return `%${normalizeMemberSearchQuery(query)}%`;
}

function legacyTokenMatchSql(paramIndex: number): string {
  const token = `$${paramIndex}`;
  return `(
    memberid ILIKE ${token}
    OR email ILIKE ${token}
    OR fristname ILIKE ${token}
    OR lastname ILIKE ${token}
    OR BTRIM(CONCAT_WS(' ', NULLIF(BTRIM(fristname), ''), NULLIF(BTRIM(lastname), ''))) ILIKE ${token}
    OR EXISTS (
      SELECT 1
      FROM watson_legacy_customers wlc
      WHERE wlc.legacy_memberid = legacy_members.memberid
        AND (
          wlc.email ILIKE ${token}
          OR wlc.first_name ILIKE ${token}
          OR wlc.last_name ILIKE ${token}
          OR BTRIM(CONCAT_WS(' ', NULLIF(BTRIM(wlc.first_name), ''), NULLIF(BTRIM(wlc.last_name), ''))) ILIKE ${token}
        )
    )
  )`;
}

export function buildLegacyMemberSearchSql(tokenCount: number): string {
  const safeTokenCount = Math.max(1, tokenCount);
  const predicates = Array.from({ length: safeTokenCount }, (_, index) =>
    legacyTokenMatchSql(index + 2),
  );
  const limitParam = safeTokenCount + 2;

  return `
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
    ${predicates.join("\n    AND ")}
  ORDER BY
    CASE
      WHEN LOWER(BTRIM(email)) = LOWER(BTRIM($1)) THEN 0
      WHEN LOWER(BTRIM(CONCAT_WS(' ', NULLIF(BTRIM(fristname), ''), NULLIF(BTRIM(lastname), '')))) = LOWER(BTRIM($1)) THEN 0
      WHEN EXISTS (
        SELECT 1
        FROM watson_legacy_customers wlc
        WHERE wlc.legacy_memberid = legacy_members.memberid
          AND (
            LOWER(BTRIM(wlc.email)) = LOWER(BTRIM($1))
            OR LOWER(BTRIM(CONCAT_WS(' ', NULLIF(BTRIM(wlc.first_name), ''), NULLIF(BTRIM(wlc.last_name), '')))) = LOWER(BTRIM($1))
          )
      ) THEN 0
      WHEN LOWER(BTRIM(lastname)) = LOWER(BTRIM($1)) THEN 1
      WHEN LOWER(BTRIM(fristname)) = LOWER(BTRIM($1)) THEN 1
      WHEN EXISTS (
        SELECT 1
        FROM watson_legacy_customers wlc
        WHERE wlc.legacy_memberid = legacy_members.memberid
          AND (
            LOWER(BTRIM(wlc.last_name)) = LOWER(BTRIM($1))
            OR LOWER(BTRIM(wlc.first_name)) = LOWER(BTRIM($1))
          )
      ) THEN 1
      ELSE 2
    END ASC,
    datejoined DESC NULLS LAST,
    lastname ASC NULLS LAST,
    fristname ASC NULLS LAST
  LIMIT $${limitParam}
`;
}

/** Single-token search SQL, kept for callers that inspect the default query. */
export const MEMBER_SEARCH_SQL = buildLegacyMemberSearchSql(1);

export function rankLegacyMemberSearchMatch(
  row: Pick<LegacyMemberSearchRow, "fristname" | "lastname" | "email" | "memberid">,
  query: string,
): number {
  const normalized = normalizeMemberSearchQuery(query).toLowerCase();
  if (!normalized) {
    return 2;
  }

  const email = row.email?.trim().toLowerCase() ?? "";
  const first = row.fristname?.trim().toLowerCase() ?? "";
  const last = row.lastname?.trim().toLowerCase() ?? "";
  const full = [first, last].filter(Boolean).join(" ");
  const memberid = row.memberid.trim().toLowerCase();

  if (email === normalized || full === normalized || memberid === normalized) {
    return 0;
  }
  if (first === normalized || last === normalized) {
    return 1;
  }
  return 2;
}

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

  const tokens = memberSearchTokens(normalized);
  if (tokens.length === 0) {
    return { rows: [], truncated: false, query: normalized };
  }

  const sql = buildLegacyMemberSearchSql(tokens.length);
  const rows = await queryFn<LegacyMemberSearchRow>(sql, [
    normalized,
    ...tokens.map((token) => `%${token}%`),
    MEMBER_SEARCH_LIMIT + 1,
  ]);

  return {
    query: normalized,
    rows: rows.slice(0, MEMBER_SEARCH_LIMIT),
    truncated: rows.length > MEMBER_SEARCH_LIMIT,
  };
}
