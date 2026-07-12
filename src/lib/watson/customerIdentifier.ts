import { queryWatson } from "./db";
import {
  getLegacyMemberById,
  type LegacyMemberDetailRow,
} from "./memberDetail";
import { type WatsonQueryFn } from "./memberSearch";

export type CustomerIdentifierKind = "memberid" | "email" | "memberstack_id";
export type CustomerProfileRouteType = "legacy" | "memberstack";

export interface CustomerResolution {
  memberid: string | null;
  member: LegacyMemberDetailRow | null;
  identifierKind: CustomerIdentifierKind;
  normalizedIdentifier: string;
}

export const MEMBER_BY_EMAIL_SQL = `
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
  WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
  ORDER BY datejoined DESC NULLS LAST, memberid ASC
`;

export type LegacyEmailLinkResult =
  | { status: "unique"; member: LegacyMemberDetailRow }
  | { status: "ambiguous"; members: LegacyMemberDetailRow[] }
  | { status: "none" };

export function normalizeCustomerIdentifier(raw: string): string {
  return raw.trim();
}

export function normalizeCustomerEmail(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized || null;
}

export function emailsMatchForLegacyLink(
  legacyEmail: string | null | undefined,
  memberstackEmail: string | null | undefined,
): boolean {
  const left = normalizeCustomerEmail(legacyEmail);
  const right = normalizeCustomerEmail(memberstackEmail);
  return Boolean(left && right && left === right);
}

export function isEmailLikeIdentifier(value: string): boolean {
  const normalized = normalizeCustomerIdentifier(value);
  return normalized.includes("@") && normalized.length >= 3;
}

export function isMemberstackMemberId(value: string): boolean {
  return /^mem_[a-z0-9]+$/i.test(normalizeCustomerIdentifier(value));
}

export function classifyCustomerIdentifier(raw: string): CustomerIdentifierKind {
  const normalized = normalizeCustomerIdentifier(raw);
  if (!normalized) {
    return "memberid";
  }
  if (isMemberstackMemberId(normalized)) {
    return "memberstack_id";
  }
  if (isEmailLikeIdentifier(normalized)) {
    return "email";
  }
  return "memberid";
}

export async function getLegacyMembersByEmail(
  email: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyMemberDetailRow[]> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) {
    return [];
  }

  return queryFn<LegacyMemberDetailRow>(MEMBER_BY_EMAIL_SQL, [normalized]);
}

export async function resolveLegacyLinkByMemberstackEmail(
  email: string | null | undefined,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyEmailLinkResult> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) {
    return { status: "none" };
  }

  const members = await getLegacyMembersByEmail(normalized, queryFn);
  if (members.length === 0) {
    return { status: "none" };
  }
  if (members.length === 1) {
    return { status: "unique", member: members[0] };
  }
  return { status: "ambiguous", members };
}

export async function resolveCustomerByMemberid(
  memberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CustomerResolution> {
  const normalized = normalizeCustomerIdentifier(memberid);
  const member = await getLegacyMemberById(normalized, queryFn);

  return {
    memberid: member ? member.memberid : null,
    member,
    identifierKind: "memberid",
    normalizedIdentifier: normalized,
  };
}

export async function resolveCustomerByEmail(
  email: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<CustomerResolution> {
  const normalized = normalizeCustomerIdentifier(email);
  const link = await resolveLegacyLinkByMemberstackEmail(normalized, queryFn);
  const member = link.status === "unique" ? link.member : null;

  return {
    memberid: member?.memberid ?? null,
    member,
    identifierKind: "email",
    normalizedIdentifier: normalized,
  };
}

export function buildLegacyCustomerProfileUrl(
  memberid: string,
  searchQuery?: string | null,
): string {
  const base = `/watson/customers/legacy/${encodeURIComponent(memberid)}`;
  const query = searchQuery?.trim();
  if (!query) {
    return base;
  }
  return `${base}?q=${encodeURIComponent(query)}`;
}

export function buildMemberstackCustomerProfileUrl(
  memberstackId: string,
  searchQuery?: string | null,
): string {
  const base = `/watson/customers/memberstack/${encodeURIComponent(memberstackId)}`;
  const query = searchQuery?.trim();
  if (!query) {
    return base;
  }
  return `${base}?q=${encodeURIComponent(query)}`;
}

/** @deprecated Use buildLegacyCustomerProfileUrl or buildMemberstackCustomerProfileUrl. */
export function buildCustomerProfileUrl(
  memberstackId: string,
  searchQuery?: string | null,
): string {
  return buildMemberstackCustomerProfileUrl(memberstackId, searchQuery);
}

export function buildLegacyMemberDetailUrl(memberid: string): string {
  return `/watson/members/${encodeURIComponent(memberid)}`;
}

export function buildCustomerSearchReturnUrl(rawQuery: string | null | undefined): string {
  const query = rawQuery?.trim();
  if (!query) {
    return "/watson/customers";
  }
  return `/watson/customers?q=${encodeURIComponent(query)}`;
}
