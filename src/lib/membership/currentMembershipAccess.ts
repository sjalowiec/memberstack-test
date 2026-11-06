/**
 * Current membership access for one person.
 *
 * Uses the same rules as {@link hasMemberAccess}. A scheduled cancellation
 * (`cancelAtDate` while the plan is still ACTIVE or TRIALING) keeps access.
 * This does not read or write legacy paid-through dates.
 */
import {
  hasComplimentaryMemberAccess,
  hasCurrentComplimentaryAccess,
  hasMemberAccess,
  hasPaidMemberAccess,
} from "../memberAccess";
import { customerEmailLookupKeys } from "../watson/customerIdentifier";
import type { MemberstackMember } from "./membershipSummary";

export const CURRENT_MEMBERSHIP_ACCESS_FIELD = "Current membership access";
export const CURRENT_MEMBERSHIP_ACCESS_YES = "yes" as const;
export const CURRENT_MEMBERSHIP_ACCESS_NO = "no" as const;

export type CurrentMembershipAccessValue =
  | typeof CURRENT_MEMBERSHIP_ACCESS_YES
  | typeof CURRENT_MEMBERSHIP_ACCESS_NO;

export type CurrentMembershipAccessDecision =
  | { outcome: "yes" | "no"; value: CurrentMembershipAccessValue }
  | { outcome: "unresolved"; reason: string };

/** One mailbox. Gmail and Googlemail are the same person; the stored address is not rewritten. */
export function canonicalMembershipEmail(email: string | null | undefined): string | null {
  const keys = customerEmailLookupKeys(email);
  if (keys.length === 0) return null;
  return keys.find((key) => key.endsWith("@gmail.com")) ?? keys[0];
}

export function legacyPaidThroughAgreement(
  ymds: readonly (string | null)[],
  todayYmd: string,
): "none" | "valid" | "expired" | "conflict" {
  const usable = ymds.filter((ymd): ymd is string => Boolean(ymd));
  if (usable.length === 0) return "none";
  const valid = usable.map((ymd) => ymd >= todayYmd);
  if (valid.every(Boolean)) return "valid";
  if (valid.every((item) => !item)) return "expired";
  return "conflict";
}

/**
 * Decide yes, no, or unresolved.
 * `legacyPaidThroughYmds === null` means Watson was not loaded.
 * `complimentaryThroughYmd === undefined` means that date was not loaded.
 * `null` means it was loaded and there is no saved date.
 */
export function decideCurrentMembershipAccess(input: {
  memberstack: "unique" | "not_found" | "ambiguous" | "unavailable";
  member?: MemberstackMember | null;
  legacyPaidThroughYmds: readonly (string | null)[] | null;
  complimentaryThroughYmd?: string | null;
  todayYmd: string;
}): CurrentMembershipAccessDecision {
  if (input.memberstack === "unavailable") {
    return { outcome: "unresolved", reason: "memberstack_unavailable" };
  }
  if (input.memberstack === "ambiguous") {
    return { outcome: "unresolved", reason: "ambiguous_memberstack_email" };
  }
  if (input.memberstack === "unique" && !input.member) {
    return { outcome: "unresolved", reason: "memberstack_unavailable" };
  }

  const member = input.memberstack === "unique" ? (input.member ?? null) : null;
  const agreement =
    input.legacyPaidThroughYmds === null
      ? "not_loaded"
      : legacyPaidThroughAgreement(input.legacyPaidThroughYmds, input.todayYmd);

  if (member && hasPaidMemberAccess(member)) {
    return { outcome: "yes", value: CURRENT_MEMBERSHIP_ACCESS_YES };
  }

  if (member && hasComplimentaryMemberAccess(member)) {
    if (input.complimentaryThroughYmd === undefined) {
      return { outcome: "unresolved", reason: "complimentary_date_not_loaded" };
    }
    if (
      hasCurrentComplimentaryAccess(member, {
        complimentaryThroughYmd: input.complimentaryThroughYmd,
        todayYmd: input.todayYmd,
      })
    ) {
      return { outcome: "yes", value: CURRENT_MEMBERSHIP_ACCESS_YES };
    }
  }

  if (!member) {
    return { outcome: "no", value: CURRENT_MEMBERSHIP_ACCESS_NO };
  }

  if (agreement === "conflict") {
    return { outcome: "unresolved", reason: "conflicting_legacy_dates" };
  }
  if (agreement === "not_loaded") {
    return { outcome: "unresolved", reason: "legacy_date_not_loaded" };
  }

  const legacyYmd =
    agreement === "valid"
      ? ((input.legacyPaidThroughYmds ?? []).find(
          (ymd): ymd is string => Boolean(ymd) && ymd >= input.todayYmd,
        ) ?? null)
      : agreement === "expired"
        ? ((input.legacyPaidThroughYmds ?? []).find((ymd): ymd is string => Boolean(ymd)) ?? null)
        : null;

  const access = hasMemberAccess(member, {
    legacyPaidThroughYmd: legacyYmd,
    ...(hasComplimentaryMemberAccess(member)
      ? { complimentaryThroughYmd: input.complimentaryThroughYmd ?? null }
      : {}),
    todayYmd: input.todayYmd,
  });
  return access
    ? { outcome: "yes", value: CURRENT_MEMBERSHIP_ACCESS_YES }
    : { outcome: "no", value: CURRENT_MEMBERSHIP_ACCESS_NO };
}
