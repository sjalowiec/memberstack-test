/**
 * Server-side loader for the Member Account Repair form.
 * Read-only Watson/Memberstack lookups already used by customer profiles.
 * Never writes Memberstack, Stripe, Watson, or Netlify Blob data.
 */

import {
  loadLegacyCustomerProfile,
  loadMemberstackCustomerProfile,
  type CustomerProfileData,
  type CustomerProfileDeps,
  type CustomerProfileLoadResult,
} from "./customerProfile";
import {
  buildLegacyCustomerProfileUrl,
  buildMemberstackCustomerProfileUrl,
} from "./customerIdentifier";
import {
  buildDetectedAccountData,
  buildMemberAccountRepairHref,
  emptyMemberAccountRepairValues,
  hasMemberAccountRepairSource,
  parseMemberAccountRepairSource,
  valuesFromCustomerProfile,
  type DetectedAccountField,
  type MemberAccountRepairStatusExtras,
  type MemberAccountRepairValues,
} from "./memberAccountRepair";
import { getMemberSavedPatternCount } from "./memberSavedPatterns";
import { type WatsonQueryFn } from "./memberSearch";
import { queryWatson } from "./db";

export const LEGACY_STRIPE_CUSTOMER_ID_SQL = `
  SELECT stripcustomerid
  FROM legacy_members
  WHERE memberid = $1
  LIMIT 1
`;

export interface MemberAccountRepairPageData {
  values: MemberAccountRepairValues;
  detected: DetectedAccountField[];
  prefilled: boolean;
  source: { legacyMemberid: string | null; memberstackId: string | null };
  backHref: string | null;
  loadError: string | null;
}

export type MemberAccountRepairLoadDeps = CustomerProfileDeps & {
  savedPatternCountFn?: typeof getMemberSavedPatternCount;
};

function profileBackHref(profile: CustomerProfileData): string {
  if (profile.profileType === "legacy" && profile.legacyMemberid) {
    return buildLegacyCustomerProfileUrl(profile.legacyMemberid);
  }
  if (profile.memberstackId) {
    return buildMemberstackCustomerProfileUrl(profile.memberstackId);
  }
  if (profile.legacyMemberid) {
    return buildLegacyCustomerProfileUrl(profile.legacyMemberid);
  }
  return buildMemberAccountRepairHref({});
}

function blankPageData(
  source: MemberAccountRepairPageData["source"],
  loadError: string | null = null,
): MemberAccountRepairPageData {
  return {
    values: emptyMemberAccountRepairValues(),
    detected: [],
    prefilled: false,
    source,
    backHref: null,
    loadError,
  };
}

export async function loadLegacyStripeCustomerId(
  legacyMemberid: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<string | null> {
  const id = legacyMemberid.trim();
  if (!id) {
    return null;
  }
  try {
    const rows = await queryFn<{ stripcustomerid: string | null }>(LEGACY_STRIPE_CUSTOMER_ID_SQL, [
      id,
    ]);
    const value = rows[0]?.stripcustomerid;
    return value && String(value).trim() ? String(value).trim() : null;
  } catch {
    return null;
  }
}

export async function loadMemberAccountRepairStatusExtras(
  legacyMemberid: string | null,
  deps: MemberAccountRepairLoadDeps = {},
): Promise<MemberAccountRepairStatusExtras> {
  const memberid = legacyMemberid?.trim() || null;
  if (!memberid) {
    return { stripeCustomerId: null, savedPatternCount: null };
  }

  const queryFn = deps.queryFn ?? queryWatson;
  const savedPatternCountFn = deps.savedPatternCountFn ?? getMemberSavedPatternCount;

  const [stripeCustomerId, savedPatternCount] = await Promise.all([
    loadLegacyStripeCustomerId(memberid, queryFn),
    savedPatternCountFn(memberid, queryFn).catch(() => null),
  ]);

  return { stripeCustomerId, savedPatternCount };
}

async function loadRepairCustomerProfile(
  source: { legacyMemberid: string | null; memberstackId: string | null },
  deps: MemberAccountRepairLoadDeps,
): Promise<CustomerProfileLoadResult> {
  if (source.legacyMemberid) {
    return loadLegacyCustomerProfile(source.legacyMemberid, deps);
  }
  return loadMemberstackCustomerProfile(source.memberstackId ?? "", deps);
}

export async function loadMemberAccountRepairPageData(
  searchParams: { get: (name: string) => string | null },
  deps: MemberAccountRepairLoadDeps = {},
): Promise<MemberAccountRepairPageData> {
  const source = parseMemberAccountRepairSource(searchParams);
  if (!hasMemberAccountRepairSource(source)) {
    return blankPageData(source);
  }

  const result = await loadRepairCustomerProfile(source, deps);
  if (!result.ok) {
    const message =
      result.reason === "not_found"
        ? "Watson customer was not found. The form is blank so you can fill it in."
        : result.message;
    return blankPageData(source, message);
  }

  const extras = await loadMemberAccountRepairStatusExtras(result.profile.legacyMemberid, deps);
  return {
    values: valuesFromCustomerProfile(result.profile),
    detected: buildDetectedAccountData(result.profile, extras),
    prefilled: true,
    source: {
      legacyMemberid: result.profile.legacyMemberid,
      memberstackId: result.profile.memberstackId,
    },
    backHref: profileBackHref(result.profile),
    loadError: null,
  };
}
