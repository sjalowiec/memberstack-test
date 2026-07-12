import { queryWatson } from "./db";
import { formatMemberJoinedDateDisplay, type WatsonQueryFn } from "./memberSearch";

export interface LegacyMemberDetailRow {
  memberid: string;
  fristname: string | null;
  lastname: string | null;
  email: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  country: string | null;
  birthdayinfo: Date | string | null;
  datejoined: Date | string | null;
  active: number | null;
  betaactive: number | null;
  currentsubscriber: number | null;
}

export interface MemberOverviewField {
  label: string;
  value: string;
}

export const MEMBER_DETAIL_SQL = `
  SELECT
    memberid,
    fristname,
    lastname,
    email,
    address,
    address2,
    city,
    state,
    postalcode,
    country,
    birthdayinfo,
    datejoined,
    active,
    betaactive,
    currentsubscriber
  FROM legacy_members
  WHERE memberid = $1
  LIMIT 1
`;

export function hasDisplayValue(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

export function formatBirthdayMonthDay(
  value: LegacyMemberDetailRow["birthdayinfo"],
): string | null {
  if (!value) {
    return null;
  }

  const isoDate =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatLegacyMemberStatus(active: number | null): string | null {
  if (active == null) {
    return null;
  }
  return active === 1 ? "Active" : active === 0 ? "Inactive" : String(active);
}

export function formatMailingAddress(
  row: Pick<LegacyMemberDetailRow, "address" | "address2">,
): string | null {
  const lines = [row.address, row.address2].filter((line) => hasDisplayValue(line)) as string[];
  if (lines.length === 0) {
    return null;
  }
  return lines.join("\n");
}

export function buildMemberSearchReturnUrl(rawQuery: string | null | undefined): string {
  const query = rawQuery?.trim();
  if (!query) {
    return "/watson";
  }
  return `/watson?q=${encodeURIComponent(query)}`;
}

export function buildMemberOverviewFields(row: LegacyMemberDetailRow): MemberOverviewField[] {
  const fields: MemberOverviewField[] = [];

  const push = (label: string, value: string | null | undefined): void => {
    if (hasDisplayValue(value)) {
      fields.push({ label, value: String(value).trim() });
    }
  };

  push("Member ID", row.memberid);
  push("First name", row.fristname);
  push("Last name", row.lastname);
  push("Email", row.email);
  push("Mailing address", formatMailingAddress(row));
  push("City", row.city);
  push("State", row.state);
  push("Zip / Postal code", row.postalcode);
  push("Country", row.country);

  push("Birthday", formatBirthdayMonthDay(row.birthdayinfo));
  push("Date joined", formatMemberJoinedDateDisplay(row.datejoined));
  push("Legacy member status", formatLegacyMemberStatus(row.active));

  return fields;
}

export function watsonMemberNotFoundHtml(memberid: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Member not found | Watson</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; color: #243015; }
      main { max-width: 36rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { line-height: 1.5; color: #475569; }
      a { color: #3f6212; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <h1>Member not found</h1>
      <p>No legacy member exists with ID <strong>${escapeHtml(memberid)}</strong>.</p>
      <p><a href="/watson">Back to member search</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function getLegacyMemberById(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyMemberDetailRow | null> {
  const normalized = memberid.trim();
  if (!normalized) {
    return null;
  }

  const rows = await queryFn<LegacyMemberDetailRow>(MEMBER_DETAIL_SQL, [normalized]);
  return rows[0] ?? null;
}
