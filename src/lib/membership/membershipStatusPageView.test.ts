import { describe, expect, it } from "vitest";
import { MEMBERSHIPS, MEMBERSHIP_PRICE_IDS } from "../../config/memberships";
import {
  formatMemberstackUnixDate,
  resolveAccountMembershipPanelView,
} from "./accountMembershipPanel";
import {
  accountParityFacts,
  MEMBERSHIP_STATUS_FREE_ACCOUNT_COMPACT_MESSAGE,
  membershipStatusUiMode,
  resolveMembershipStatusPageView,
} from "./membershipStatusPageView";
import type { MembershipStatusSummary } from "./membershipStatusSummary";

const NEXT_BILLING = Math.floor(Date.UTC(2026, 7, 22, 12, 0, 0) / 1000);

function memberWithPaid(options?: {
  cancelAtDate?: number | null;
  nextBillingDate?: number | null;
}) {
  const nextBillingDate = options?.nextBillingDate ?? NEXT_BILLING;
  const cancelAtDate = options?.cancelAtDate ?? null;
  return {
    data: {
      id: "mem_sb_test_active",
      planConnections: [
        {
          planId: MEMBERSHIPS.membership.memberstackPlanId,
          status: "ACTIVE",
          active: true,
          payment: {
            priceId: MEMBERSHIP_PRICE_IDS.monthly,
            nextBillingDate,
            cancelAtDate,
          },
        },
      ],
    },
  };
}

function serverUnknown(): MembershipStatusSummary {
  return {
    identified: false,
    currentStatus: "unknown",
    currentPlanName: null,
    previousPlanName: null,
    activeThroughDate: null,
    legacyExpirationDate: null,
    legacyLinkState: "lookup_unavailable",
    accountType: "unknown",
    recommendedAction: "wait",
    customerFacingMessage:
      "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
  };
}

function serverFutureLegacy(): MembershipStatusSummary {
  return {
    identified: true,
    currentStatus: "no_plan",
    currentPlanName: null,
    previousPlanName: "Premium",
    activeThroughDate: null,
    legacyExpirationDate: "July 30, 2026",
    legacyLinkState: "linked",
    accountType: "non_paid_account",
    recommendedAction: "contact_support",
    customerFacingMessage:
      "Good news! It looks like your Premium annual membership still has paid time remaining through July 30, 2026. Before you purchase another membership, please contact us so we can make sure you do not lose any of that time.",
  };
}

function serverExpiredLegacy(): MembershipStatusSummary {
  return {
    identified: true,
    currentStatus: "no_plan",
    currentPlanName: null,
    previousPlanName: "Premium",
    activeThroughDate: null,
    legacyExpirationDate: "June 30, 2026",
    legacyLinkState: "linked",
    accountType: "non_paid_account",
    recommendedAction: "purchase",
    customerFacingMessage:
      "You have a Knit it Now account, but we do not currently see an active membership. Your previous Premium annual membership ended on June 30, 2026.",
  };
}

describe("resolveMembershipStatusPageView precedence", () => {
  it("active client membership overrides server unknown/wait", () => {
    const payload = memberWithPaid();
    const view = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: payload,
      serverSummary: serverUnknown(),
    });

    expect(view.source).toBe("client_active");
    expect(view.ctaMode).toBe("manage");
    expect(view.heading).toBe("Your membership is active");
    expect(view.facts.plan).toBe("Knit it Now Membership");
    expect(view.facts.status).toBe("Active");
    expect(view.facts.billing).toBe("Monthly");
    expect(view.facts.renews).toBe(formatMemberstackUnixDate(NEXT_BILLING));
    expect(view.facts.previous).toBeNull();
    expect(view.message).toBe("Your Knit it Now Membership is active.");
  });

  it("canceling client membership overrides server unknown/wait", () => {
    const cancelAt = Math.floor(Date.UTC(2026, 7, 18) / 1000);
    const payload = memberWithPaid({ cancelAtDate: cancelAt, nextBillingDate: cancelAt });
    const view = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: payload,
      serverSummary: serverUnknown(),
    });

    expect(view.source).toBe("client_canceling");
    expect(view.ctaMode).toBe("manage");
    expect(view.facts.status).toBe("Canceling");
    expect(view.facts.renews).toBeNull();
    expect(view.facts.through).toBeTruthy();
    expect(view.heading).toMatch(/^Your membership is active through /);
  });

  it("Account and status panel share plan/status/billing/renewal facts", () => {
    const payload = memberWithPaid();
    const account = resolveAccountMembershipPanelView(payload);
    const page = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: payload,
      serverSummary: serverUnknown(),
    });
    const parity = accountParityFacts(account, payload);

    expect(page.facts.plan).toBe(parity.plan);
    expect(page.facts.status).toBe(parity.status);
    expect(page.facts.billing).toBe(parity.billing);
    expect(page.facts.renews).toBe(parity.renewsOrThrough);
  });

  it("no active client membership uses future legacy server context (contact)", () => {
    const view = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: { data: { id: "mem_free", planConnections: [] } },
      serverSummary: serverFutureLegacy(),
    });
    expect(view.source).toBe("server_legacy");
    expect(view.ctaMode).toBe("contact_support");
    expect(view.message).toMatch(/paid time remaining/);
  });

  it("no active client membership uses expired legacy server context (purchase)", () => {
    const view = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: { data: { id: "mem_free", planConnections: [] } },
      serverSummary: serverExpiredLegacy(),
    });
    expect(view.source).toBe("server_legacy");
    expect(view.ctaMode).toBe("purchase");
  });

  it("client Memberstack failure is the cannot-confirm case", () => {
    const view = resolveMembershipStatusPageView({
      clientLoaded: false,
      memberPayload: null,
      serverSummary: serverUnknown(),
    });
    expect(view.source).toBe("client_unavailable");
    expect(view.heading).toBe("We could not confirm your membership");
    expect(view.ctaMode).toBe("wait");
  });

  it("free client + missing server summary waits without inventing purchase", () => {
    const view = resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: { data: { id: "mem_free", planConnections: [] } },
      serverSummary: null,
    });
    expect(view.ctaMode).toBe("wait");
    expect(view.heading).toBe("We could not confirm your membership");
  });

  it("maps active/canceling to modal and blocking/purchase to inline modes", () => {
    expect(
      membershipStatusUiMode(
        resolveMembershipStatusPageView({
          clientLoaded: true,
          memberPayload: memberWithPaid(),
          serverSummary: null,
        }),
      ),
    ).toBe("modal");
    expect(
      membershipStatusUiMode(
        resolveMembershipStatusPageView({
          clientLoaded: true,
          memberPayload: { data: { id: "mem_free", planConnections: [] } },
          serverSummary: serverFutureLegacy(),
        }),
      ),
    ).toBe("inline_blocking");
    expect(
      membershipStatusUiMode(
        resolveMembershipStatusPageView({
          clientLoaded: true,
          memberPayload: { data: { id: "mem_free", planConnections: [] } },
          serverSummary: serverExpiredLegacy(),
        }),
      ),
    ).toBe("inline_compact");
    expect(MEMBERSHIP_STATUS_FREE_ACCOUNT_COMPACT_MESSAGE).toMatch(/does not currently include/);
  });
});
