import { queryWatson } from "../watson/db";
import {
  buildLegacyCustomerProfileUrl,
  buildMemberstackCustomerProfileUrl,
  normalizeCustomerEmail,
} from "../watson/customerIdentifier";
import { loadCustomerMemberstackMember } from "../watson/customerMemberstack";
import type { WatsonQueryFn } from "../watson/memberSearch";

/**
 * Legacy customers whose stored email matches after trim + lowercase.
 * Does not fold Gmail and Googlemail, and does not update stored rows.
 */
export const CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL = `
  SELECT memberid
  FROM legacy_members
  WHERE LOWER(TRIM(email)) = $1
  ORDER BY memberid ASC
`;

export type ContactMemberstackEmailLookup =
  | { status: "none" }
  | { status: "one"; id: string }
  | { status: "unknown" };

function distinctIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return unique;
}

/**
 * One profile link only when the email matches exactly one customer record.
 * A legacy profile and a Memberstack profile are two records — do not pick one.
 * A failed Memberstack lookup is unknown, so do not show a legacy-only guess.
 */
export function contactCustomerHrefForMatches(input: {
  legacyMemberids: readonly string[];
  memberstackIds: readonly string[] | null;
}): string | null {
  if (input.memberstackIds == null) return null;
  const legacy = distinctIds(input.legacyMemberids);
  const memberstack = distinctIds(input.memberstackIds);
  if (legacy.length + memberstack.length !== 1) return null;
  if (legacy.length === 1) return buildLegacyCustomerProfileUrl(legacy[0]);
  return buildMemberstackCustomerProfileUrl(memberstack[0]);
}

async function lookupMemberstackByNormalizedEmail(
  normalizedEmail: string,
): Promise<ContactMemberstackEmailLookup> {
  const result = await loadCustomerMemberstackMember({ lookupValue: normalizedEmail });
  if (!result.ok) {
    return result.status === "not_found" ? { status: "none" } : { status: "unknown" };
  }
  const memberEmail = normalizeCustomerEmail(result.member.auth?.email);
  const id = result.member.id?.trim() || "";
  if (!id || memberEmail !== normalizedEmail) return { status: "unknown" };
  return { status: "one", id };
}

export async function resolveContactMessageCustomerHref(
  email: string | null | undefined,
  deps: {
    queryFn?: WatsonQueryFn;
    lookupMemberstack?: (normalizedEmail: string) => Promise<ContactMemberstackEmailLookup>;
  } = {},
): Promise<string | null> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) return null;

  const queryFn = deps.queryFn ?? queryWatson;
  const lookupMemberstack = deps.lookupMemberstack ?? lookupMemberstackByNormalizedEmail;
  const [legacyRows, memberstack] = await Promise.all([
    queryFn<{ memberid: string | null }>(CONTACT_LEGACY_CUSTOMERS_BY_EMAIL_SQL, [normalized]),
    lookupMemberstack(normalized),
  ]);

  const legacyMemberids = legacyRows.flatMap((row) =>
    typeof row.memberid === "string" && row.memberid.trim() ? [row.memberid] : [],
  );
  const memberstackIds =
    memberstack.status === "unknown"
      ? null
      : memberstack.status === "one"
        ? [memberstack.id]
        : [];

  return contactCustomerHrefForMatches({ legacyMemberids, memberstackIds });
}
