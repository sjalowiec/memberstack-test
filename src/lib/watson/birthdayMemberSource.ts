/**
 * Birthday member data access.
 *
 * v1 source: legacy Postgres `legacy_members`.
 * Calendar UI consumes `BirthdayMember` only - swap the source later
 * (e.g. Memberstack) without rewriting the month-view UI.
 */

import { buildLegacyCustomerProfileUrl } from "./customerIdentifier";
import {
  CURRENT_LEGACY_MEMBER_WHERE_SQL,
  displaySubscriptionType,
  isBlankSubscriptionType,
} from "./legacyMembershipReportsShared";
import { formatLegacyTimestampDisplay } from "./memberMembership";
import { formatMemberDisplayName, type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export type BirthdayMember = {
  memberId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  birthMonth: number;
  birthDay: number;
  birthdayLabel: string;
  memberSinceDisplay: string | null;
  planDisplay: string | null;
  mailingAddressDisplay: string | null;
  mailingCountry: string | null;
  hasMailingAddress: boolean;
  profileHref: string;
  notesHref: string;
};

export interface BirthdayMemberSource {
  listActiveMembersWithBirthdays(): Promise<BirthdayMember[]>;
}

export type LegacyBirthdayMemberQueryRow = {
  memberid: string;
  fristname: string | null;
  lastname: string | null;
  birthdayinfo: Date | string | null;
  subscriptiontype: string | null;
  subscriptiondate: Date | string | null;
  datejoined: Date | string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  country: string | null;
};

export const ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL = `
  SELECT
    m.memberid,
    m.fristname,
    m.lastname,
    m.birthdayinfo,
    m.subscriptiontype,
    m.subscriptiondate,
    m.datejoined,
    m.address,
    m.address2,
    m.city,
    m.state,
    m.postalcode,
    m.country
  FROM legacy_members m
  WHERE ${CURRENT_LEGACY_MEMBER_WHERE_SQL.trim()}
    AND m.birthdayinfo IS NOT NULL
  ORDER BY m.lastname ASC NULLS LAST, m.fristname ASC NULLS LAST, m.memberid ASC
`;

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && String(value).trim());
}

/**
 * Parse month/day from legacy `birthdayinfo`.
 * Birth year is ignored (often a placeholder such as 1900).
 * Returns null for missing, unparseable, or impossible month/day values.
 */
export function parseBirthdayMonthDay(
  value: Date | string | null | undefined,
): { month: number; day: number } | null {
  if (value == null || value === "") {
    return null;
  }

  const isoDate =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim().slice(0, 10);
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return null;
  }

  // Validate against a leap year so Feb 29 remains acceptable.
  const probe = new Date(Date.UTC(2000, month - 1, day));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== 2000 ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { month, day };
}

export function formatBirthdayMonthDayLabel(month: number, day: number): string {
  const date = new Date(Date.UTC(2000, month - 1, day));
  return MONTH_DAY_FORMATTER.format(date);
}

export function buildMailingAddressParts(row: {
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  country: string | null;
}): {
  mailingAddressDisplay: string | null;
  mailingCountry: string | null;
  hasMailingAddress: boolean;
} {
  const streetLines = [row.address, row.address2]
    .filter((line) => hasText(line))
    .map((line) => String(line).trim());

  const city = hasText(row.city) ? String(row.city).trim() : "";
  const state = hasText(row.state) ? String(row.state).trim() : "";
  const postal = hasText(row.postalcode) ? String(row.postalcode).trim() : "";
  let locality = "";
  if (city && state && postal) {
    locality = `${city}, ${state} ${postal}`;
  } else if (city && state) {
    locality = `${city}, ${state}`;
  } else {
    locality = [city, state, postal].filter(Boolean).join(", ");
  }

  const country = hasText(row.country) ? String(row.country).trim() : null;
  const lines = [...streetLines];
  if (locality) lines.push(locality);
  if (country) lines.push(country);

  const hasMailingAddress =
    streetLines.length > 0 || Boolean(locality) || Boolean(country);

  return {
    mailingAddressDisplay: lines.length > 0 ? lines.join("\n") : null,
    mailingCountry: country,
    hasMailingAddress,
  };
}

export function mapLegacyBirthdayMemberRow(
  row: LegacyBirthdayMemberQueryRow,
): BirthdayMember | null {
  const birthday = parseBirthdayMonthDay(row.birthdayinfo);
  if (!birthday) {
    return null;
  }

  const memberId = String(row.memberid || "").trim();
  if (!memberId) {
    return null;
  }

  const displayName = formatMemberDisplayName(row) || memberId;
  const profileHref = buildLegacyCustomerProfileUrl(memberId);
  const address = buildMailingAddressParts(row);

  const memberSince =
    formatLegacyTimestampDisplay(row.subscriptiondate) ||
    formatLegacyTimestampDisplay(row.datejoined);

  const planDisplay = isBlankSubscriptionType(row.subscriptiontype)
    ? null
    : displaySubscriptionType(row.subscriptiontype);

  return {
    memberId,
    displayName,
    firstName: hasText(row.fristname) ? String(row.fristname).trim() : null,
    lastName: hasText(row.lastname) ? String(row.lastname).trim() : null,
    birthMonth: birthday.month,
    birthDay: birthday.day,
    birthdayLabel: formatBirthdayMonthDayLabel(birthday.month, birthday.day),
    memberSinceDisplay: memberSince,
    planDisplay,
    mailingAddressDisplay: address.mailingAddressDisplay,
    mailingCountry: address.mailingCountry,
    hasMailingAddress: address.hasMailingAddress,
    profileHref,
    notesHref: `${profileHref}#customer-notes`,
  };
}

export async function loadActiveLegacyBirthdayMembers(
  queryFn: WatsonQueryFn = queryWatson,
): Promise<BirthdayMember[]> {
  const rows = await queryFn<LegacyBirthdayMemberQueryRow>(ACTIVE_LEGACY_BIRTHDAY_MEMBERS_SQL);
  const members: BirthdayMember[] = [];
  for (const row of rows) {
    const mapped = mapLegacyBirthdayMemberRow(row);
    if (mapped) {
      members.push(mapped);
    }
  }
  return members;
}

export class LegacyBirthdayMemberSource implements BirthdayMemberSource {
  constructor(private readonly queryFn: WatsonQueryFn = queryWatson) {}

  listActiveMembersWithBirthdays(): Promise<BirthdayMember[]> {
    return loadActiveLegacyBirthdayMembers(this.queryFn);
  }
}

/** Default source for the Birthdays calendar (swap later for Memberstack). */
export function getBirthdayMemberSource(): BirthdayMemberSource {
  return new LegacyBirthdayMemberSource();
}
