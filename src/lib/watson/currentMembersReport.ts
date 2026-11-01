/**
 * Watson Current Members.
 *
 * Same census the ActiveCampaign "Current membership access" field uses:
 * hasMemberAccess, one person per mailbox. This is not the Current Legacy
 * Members report.
 */
import {
  loadCurrentMembershipAccessCensus,
  type CurrentMembershipAccessCensus,
  type MembershipAccessPerson,
  type MembershipAccessYesBasis,
} from "../membership/currentMembershipAccessCensus";

export const CURRENT_MEMBERS_REPORT_TITLE = "Current Members";

export const CURRENT_MEMBER_BASIS_LABELS: Record<MembershipAccessYesBasis, string> = {
  current_paid: "Current paid membership",
  legacy_paid_shell: "Legacy paid plan",
  complimentary: "Complimentary access",
  legacy_date: "Watson paid-through date",
};

const GMAIL_GOOGLEMAIL_EXPLANATION =
  "Two accounts use Gmail and Googlemail versions of the same address.";

export function plainUnresolvedExplanation(
  reason: string,
  storedEmails: readonly string[],
): string {
  const domains = new Set(
    storedEmails
      .map((email) => email.trim().toLowerCase().split("@").at(-1) ?? "")
      .filter(Boolean),
  );
  if (
    reason === "ambiguous_memberstack_email" &&
    domains.has("gmail.com") &&
    domains.has("googlemail.com")
  ) {
    return GMAIL_GOOGLEMAIL_EXPLANATION;
  }
  if (reason === "ambiguous_memberstack_email") {
    return "More than one account uses this mailbox.";
  }
  if (reason === "conflicting_legacy_dates") {
    return "Watson has conflicting paid-through dates for this mailbox.";
  }
  if (reason === "legacy_date_not_loaded") {
    return "Watson paid-through dates could not be loaded.";
  }
  if (reason === "complimentary_date_not_loaded") {
    return "Complimentary access could not be checked.";
  }
  if (reason === "memberstack_unavailable") {
    return "The membership account could not be read.";
  }
  return "This person could not be counted.";
}

export const CURRENT_MEMBERS_REPORT_NOTE =
  "Current Members uses the site membership-access rule and counts one person per mailbox. ActiveCampaign’s Current membership access field uses this same census. It is not the Current Legacy Members report, which still counts imported legacy rows with a paid-through date of today or later.";

export interface CurrentMemberRow {
  email: string;
  basis: MembershipAccessYesBasis;
  basisLabel: string;
  memberstackId: string | null;
  legacyMemberIds: string[];
}

export interface UnresolvedMemberRow {
  email: string;
  explanation: string;
  storedEmails: string[];
}

export interface CurrentMembersReport {
  title: typeof CURRENT_MEMBERS_REPORT_TITLE;
  note: string;
  asOfDate: string;
  ready: boolean;
  blockedReason: string | null;
  yesCount: number;
  noCount: number;
  unresolvedCount: number;
  yesByBasis: CurrentMembershipAccessCensus["yesByBasis"];
  currentMembers: CurrentMemberRow[];
  unresolved: UnresolvedMemberRow[];
}

export function buildCurrentMembersReport(
  census: CurrentMembershipAccessCensus,
): CurrentMembersReport {
  const blockedReason = census.memberstackTruncated
    ? "The Memberstack member list was incomplete, so this total is not the current-member census."
    : !census.legacyLoaded
      ? "Watson paid-through dates did not load, so this total is not the current-member census."
      : !census.complimentaryLoaded
        ? "Complimentary access dates did not load, so this total is not the current-member census."
        : null;

  const currentMembers = census.people
    .filter((person): person is MembershipAccessPerson & { basis: MembershipAccessYesBasis } =>
      person.outcome === "yes" && person.basis != null,
    )
    .map((person) => ({
      email: person.email,
      basis: person.basis,
      basisLabel: CURRENT_MEMBER_BASIS_LABELS[person.basis],
      memberstackId: person.memberstackId,
      legacyMemberIds: person.legacyMemberIds,
    }));

  const unresolved = census.people
    .filter((person) => person.outcome === "unresolved")
    .map((person) => {
      const storedEmails = person.storedEmails.length > 0 ? person.storedEmails : [person.email];
      return {
        email: person.email,
        explanation: plainUnresolvedExplanation(person.reason ?? "", storedEmails),
        storedEmails,
      };
    });

  return {
    title: CURRENT_MEMBERS_REPORT_TITLE,
    note: CURRENT_MEMBERS_REPORT_NOTE,
    asOfDate: census.todayLosAngeles,
    ready: blockedReason == null,
    blockedReason,
    yesCount: blockedReason ? 0 : census.watsonYesCount,
    noCount: blockedReason ? 0 : census.watsonNoCount,
    unresolvedCount: census.unresolvedCount,
    yesByBasis: census.yesByBasis,
    currentMembers: blockedReason ? [] : currentMembers,
    unresolved,
  };
}

export async function loadCurrentMembersReport(): Promise<CurrentMembersReport> {
  const census = await loadCurrentMembershipAccessCensus();
  return buildCurrentMembersReport(census);
}
