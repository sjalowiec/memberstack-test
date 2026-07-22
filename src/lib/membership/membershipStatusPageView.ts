/**
 * /membership status panel view: client Memberstack is authoritative for current
 * paid membership; server summary supplies legacy transition context only when
 * the client confirms there is no active paid plan.
 */

import {
  cancelAtLabelFromActivePaidConnection,
  resolveAccountMembershipPanelView,
  type AccountMembershipPanelView,
} from "./accountMembershipPanel";
import type { MembershipStatusCtaMode } from "./membershipStatusCta";
import {
  membershipStatusPanelHeading,
  type MembershipStatusSummary,
} from "./membershipStatusSummary";
import { MEMBERSHIPS } from "../../config/memberships";

export type MembershipStatusPageFactKey =
  | "status"
  | "plan"
  | "billing"
  | "renews"
  | "through"
  | "previous";

export type MembershipStatusPageFacts = Record<
  MembershipStatusPageFactKey,
  string | null
>;

export type MembershipStatusPageView = {
  /** Where the primary status decision came from. */
  source:
    | "client_active"
    | "client_canceling"
    | "server_legacy"
    | "client_unavailable";
  heading: string;
  message: string;
  ctaMode: Exclude<MembershipStatusCtaMode, "loading" | "hidden">;
  facts: MembershipStatusPageFacts;
};

/** How /membership should present the resolved status. */
export type MembershipStatusUiMode = "modal" | "inline_blocking" | "inline_compact";

/** Compact free-account note on the sales page (purchase path). */
export const MEMBERSHIP_STATUS_FREE_ACCOUNT_COMPACT_MESSAGE =
  "You have a Knit it Now account, but it does not currently include an active Knit it Now membership.";

export function membershipStatusUiMode(
  view: MembershipStatusPageView,
): MembershipStatusUiMode {
  if (view.source === "client_active" || view.source === "client_canceling") {
    return "modal";
  }
  if (view.ctaMode === "purchase") return "inline_compact";
  return "inline_blocking";
}

const EMPTY_FACTS: MembershipStatusPageFacts = {
  status: null,
  plan: null,
  billing: null,
  renews: null,
  through: null,
  previous: null,
};

function activePlanPhrase(planLabel: string): string {
  const name = planLabel.trim() || MEMBERSHIPS.membership.name;
  return /membership$/i.test(name) ? name : `${name} membership`;
}

/** Same customer copy as the server summary for active/canceling paid members. */
export function activeMembershipCustomerMessage(
  planLabel: string,
  throughDate: string | null,
): string {
  const phrase = activePlanPhrase(planLabel);
  if (throughDate) {
    return `Your ${phrase} remains active through ${throughDate}. You do not need to subscribe again before then.`;
  }
  return `Your ${phrase} is active.`;
}

export function membershipStatusPageViewFromAccount(
  account: AccountMembershipPanelView,
  memberPayload?: unknown,
): MembershipStatusPageView | null {
  if (account.kind !== "member") return null;

  const planLabel = account.planLabel;
  if (account.isCanceling) {
    const throughDate =
      (memberPayload != null
        ? cancelAtLabelFromActivePaidConnection(memberPayload)
        : null) ??
      account.activeUntilMessage
        ?.replace(/^Your membership remains active until /i, "")
        .replace(/\.$/, "") ??
      null;

    return {
      source: "client_canceling",
      heading: throughDate
        ? `Your membership is active through ${throughDate}`
        : "Your membership is active",
      message: activeMembershipCustomerMessage(planLabel, throughDate),
      ctaMode: "manage",
      facts: {
        status: account.statusLabel,
        plan: planLabel,
        billing: account.billingLabel,
        renews: null,
        through: throughDate,
        previous: null,
      },
    };
  }

  return {
    source: "client_active",
    heading: "Your membership is active",
    message: activeMembershipCustomerMessage(planLabel, null),
    ctaMode: "manage",
    facts: {
      status: account.statusLabel,
      plan: planLabel,
      billing: account.billingLabel,
      renews: account.renewsLabel,
      through: null,
      previous: null,
    },
  };
}

function previousFactFromServer(summary: MembershipStatusSummary): string | null {
  if (summary.previousPlanName && summary.legacyExpirationDate) {
    return `${summary.previousPlanName} (ended ${summary.legacyExpirationDate})`;
  }
  if (summary.legacyExpirationDate) {
    return `Ended ${summary.legacyExpirationDate}`;
  }
  if (summary.previousPlanName) {
    return summary.previousPlanName;
  }
  return null;
}

function statusFactFromServer(summary: MembershipStatusSummary): string | null {
  switch (summary.currentStatus) {
    case "active":
      return "Active";
    case "canceling":
      return "Active through paid-through date";
    case "no_plan":
    case "inactive":
      return "No active membership";
    default:
      return null;
  }
}

/**
 * Map a server membership-status summary into the page panel view.
 * Used only when the client confirms there is no active paid membership.
 */
export function membershipStatusPageViewFromServerSummary(
  summary: MembershipStatusSummary,
): MembershipStatusPageView {
  const hideFacts =
    summary.recommendedAction === "contact_support" ||
    summary.recommendedAction === "wait" ||
    summary.currentStatus === "unknown";

  return {
    source: "server_legacy",
    heading: membershipStatusPanelHeading(summary),
    message: summary.customerFacingMessage,
    ctaMode: summary.recommendedAction,
    facts: hideFacts
      ? { ...EMPTY_FACTS }
      : {
          status: statusFactFromServer(summary),
          plan: summary.currentPlanName,
          billing: null,
          renews: null,
          through: summary.activeThroughDate,
          previous: previousFactFromServer(summary),
        },
  };
}

export function membershipStatusPageViewClientUnavailable(
  message = "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
): MembershipStatusPageView {
  return {
    source: "client_unavailable",
    heading: "We could not confirm your membership",
    message,
    ctaMode: "wait",
    facts: { ...EMPTY_FACTS },
  };
}

/**
 * Final /membership panel view.
 *
 * Precedence:
 * 1. Client Memberstack load failure ? cannot confirm
 * 2. Client active / canceling paid ? Account view wins (ignore server unknown)
 * 3. Else server legacy context (when available)
 * 4. Else wait (server missing/failed while client is free)
 */
export function resolveMembershipStatusPageView(options: {
  /** False when Memberstack DOM payload could not be loaded. */
  clientLoaded: boolean;
  memberPayload: unknown | null;
  serverSummary: MembershipStatusSummary | null;
}): MembershipStatusPageView {
  if (!options.clientLoaded) {
    return membershipStatusPageViewClientUnavailable();
  }

  const account = resolveAccountMembershipPanelView(options.memberPayload);
  const fromClient = membershipStatusPageViewFromAccount(
    account,
    options.memberPayload,
  );
  if (fromClient) {
    return fromClient;
  }

  if (options.serverSummary) {
    return membershipStatusPageViewFromServerSummary(options.serverSummary);
  }

  return membershipStatusPageViewClientUnavailable();
}

/** Shared fact values for Account vs status-panel parity assertions. */
export function accountParityFacts(
  account: AccountMembershipPanelView,
  memberPayload?: unknown,
): {
  plan: string;
  status: string;
  billing: string | null;
  renewsOrThrough: string | null;
} {
  const throughDate = account.isCanceling
    ? (memberPayload != null
        ? cancelAtLabelFromActivePaidConnection(memberPayload)
        : null) ??
      account.activeUntilMessage
        ?.replace(/^Your membership remains active until /i, "")
        .replace(/\.$/, "") ??
      null
    : null;
  return {
    plan: account.planLabel,
    status: account.statusLabel,
    billing: account.billingLabel,
    renewsOrThrough: account.isCanceling ? throughDate : account.renewsLabel,
  };
}
