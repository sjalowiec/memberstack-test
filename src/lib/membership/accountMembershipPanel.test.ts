import { describe, expect, it } from "vitest";
import {
  FREE_ACCESS_MEMBERSHIPS,
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import {
  accountMembershipPanelActions,
  billingIntervalFromActivePaidConnection,
  formatMemberstackUnixDate,
  isPortalEligiblePaidPlanConnection,
  memberHasStripeCustomerPortalAccess,
  resolveAccountMembershipPanelView,
} from "./accountMembershipPanel";

type TestPayment = {
  priceId?: string;
  nextBillingDate?: number | null;
  cancelAtDate?: number | null;
  lastBillingDate?: number | null;
};

function memberWithPlans(
  connections: Array<{
    planId: string;
    status?: string;
    active?: boolean;
    priceId?: string;
    payment?: TestPayment;
  }>,
) {
  return {
    data: {
      id: "mem_test",
      planConnections: connections,
    },
  };
}

/** Same formatter the panel uses  keeps assertions timezone-stable. */
function expectedLocalDateLabel(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(unixSeconds * 1000));
}

describe("accountMembershipPanelActions", () => {
  it("shows Join for free members", () => {
    expect(accountMembershipPanelActions("free")).toEqual(["join"]);
  });

  it("shows Manage Billing for members", () => {
    expect(accountMembershipPanelActions("member")).toEqual(["manageBilling"]);
  });

  it("shows only Manage Billing for canceling members without annual switch", () => {
    expect(accountMembershipPanelActions("member", { canceling: true })).toEqual([
      "manageBilling",
    ]);
  });

  it("shows Manage Billing and Switch to Annual when eligible", () => {
    expect(
      accountMembershipPanelActions("member", {
        canceling: true,
        switchToAnnual: true,
      }),
    ).toEqual(["manageBilling", "switchToAnnual"]);
  });
});

describe("formatMemberstackUnixDate", () => {
  it("formats a valid unix-seconds timestamp as a local calendar date", () => {
    const seconds = 1786838400;
    expect(formatMemberstackUnixDate(seconds)).toBe(expectedLocalDateLabel(seconds));
  });

  it("returns null for invalid timestamps", () => {
    expect(formatMemberstackUnixDate(null)).toBeNull();
    expect(formatMemberstackUnixDate(undefined)).toBeNull();
    expect(formatMemberstackUnixDate(0)).toBeNull();
    expect(formatMemberstackUnixDate(-10)).toBeNull();
    expect(formatMemberstackUnixDate(Number.NaN)).toBeNull();
    expect(formatMemberstackUnixDate("1786838400")).toBeNull();
  });
});

describe("resolveAccountMembershipPanelView", () => {
  it("shows no active membership when there are no paid plan connections", () => {
    expect(resolveAccountMembershipPanelView(memberWithPlans([]))).toEqual({
      kind: "free",
      planLabel: "No active membership",
      planDisplayLabel: "No active membership",
      statusLabel: "No Active Membership",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: null,
      manageBillingDescription: null,
      annualSwitchWarning: null,
      visibleActions: ["join"],
    });
  });

  it("treats beta-only as free for this panel (not a paid membership)", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("free");
    expect(view.renewsLabel).toBeNull();
    expect(view.activeUntilMessage).toBeNull();
    expect(view.visibleActions).toEqual(["join"]);
  });

  it("shows active member without billing when price id is unknown", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Knit it Now Membership",
      statusLabel: "Active",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: null,
      manageBillingDescription:
        "Update your payment method, view invoices, or manage your subscription.",
      annualSwitchWarning: null,
      visibleActions: ["manageBilling"],
    });
  });

  it("shows Active member with Renews when cancelAtDate is null", () => {
    const nextBillingDate = 1786838400;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view).toMatchObject({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Monthly Membership",
      statusLabel: "Active",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: "Membership renews automatically each month.",
      visibleActions: ["manageBilling"],
    });
    expect(view.renewsLabel).toBe(expectedLocalDateLabel(nextBillingDate));
  });

  it("shows Canceling monthly with Switch to Annual, Manage Billing, and overlap warning", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: cancelAtDate,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    const dateLabel = expectedLocalDateLabel(cancelAtDate);
    expect(view).toMatchObject({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Monthly Membership",
      statusLabel: "Canceling",
      billingLabel: "Monthly",
      renewsLabel: null,
      isCanceling: true,
      autoRenewNote: null,
      manageBillingDescription:
        "You can update your payment information or reverse your cancellation from the billing portal if available.",
      visibleActions: ["manageBilling", "switchToAnnual"],
    });
    expect(view.activeUntilMessage).toBe(
      `Your membership remains active until ${dateLabel}.`,
    );
    expect(view.annualSwitchWarning).toBe(
      `Purchasing annual now will start the annual membership immediately. Your monthly membership will remain active until ${dateLabel}.`,
    );
    expect(view.visibleActions).toContain("manageBilling");
    expect(view.visibleActions).not.toContain("join");
  });

  it("does not show Switch to Annual for active monthly members", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: 1786838400,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).toEqual(["manageBilling"]);
    expect(view.annualSwitchWarning).toBeNull();
  });

  it("does not show Switch to Annual for annual members", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          nextBillingDate: 1798761600,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).toEqual(["manageBilling"]);
    expect(view.annualSwitchWarning).toBeNull();
  });

  it("does not show Switch to Annual for canceling monthly who already has annual", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          cancelAtDate,
        },
      },
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).toEqual(["manageBilling"]);
    expect(view.annualSwitchWarning).toBeNull();
  });

  it("treats removed annual Basic canceling connection as free for this panel", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          nextBillingDate: cancelAtDate,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("free");
    expect(view.visibleActions).toEqual(["join"]);
  });

  it("shows Canceling remaining legacy monthly Basic with active-until message and Manage only", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          nextBillingDate: cancelAtDate,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view).toMatchObject({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Annual Membership",
      statusLabel: "Canceling",
      billingLabel: "Annual",
      renewsLabel: null,
      isCanceling: true,
      autoRenewNote: null,
      annualSwitchWarning: null,
      visibleActions: ["manageBilling"],
    });
    expect(view.activeUntilMessage).toBe(
      `Your membership remains active until ${expectedLocalDateLabel(cancelAtDate)}.`,
    );
    expect(view.visibleActions).not.toContain("join");
    expect(view.visibleActions).not.toContain("switchToAnnual");
  });

  it("does not treat invalid cancelAtDate as canceling", () => {
    const nextBillingDate = 1786838400;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate,
          cancelAtDate: 0,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.statusLabel).toBe("Active");
    expect(view.isCanceling).toBe(false);
    expect(view.activeUntilMessage).toBeNull();
    expect(view.renewsLabel).toBe(expectedLocalDateLabel(nextBillingDate));
    expect(view.visibleActions).toEqual(["manageBilling"]);
  });

  it("shows active-until from cancelAtDate when nextBillingDate is missing", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: null,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.statusLabel).toBe("Canceling");
    expect(view.renewsLabel).toBeNull();
    expect(view.activeUntilMessage).toBe(
      `Your membership remains active until ${expectedLocalDateLabel(cancelAtDate)}.`,
    );
  });

  it("does not show a cancellation message for free accounts", () => {
    const view = resolveAccountMembershipPanelView(memberWithPlans([]));
    expect(view.activeUntilMessage).toBeNull();
    expect(view.isCanceling).toBe(false);
  });

  it("shows Renews for membership annual with nextBillingDate", () => {
    const nextBillingDate = 1798761600;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          nextBillingDate,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("member");
    expect(view.billingInterval).toBe("annual");
    expect(view.billingLabel).toBe("Annual");
    expect(view.planDisplayLabel).toBe("Annual Membership");
    expect(view.renewsLabel).toBe(expectedLocalDateLabel(nextBillingDate));
  });

  it("hides Renews for free accounts even if a stray nextBillingDate appears", () => {
    const member = memberWithPlans([]);
    expect(resolveAccountMembershipPanelView(member).renewsLabel).toBeNull();
  });

  it("hides Renews when nextBillingDate is null", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: null,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("member");
    expect(view.renewsLabel).toBeNull();
  });

  it("hides Renews for invalid nextBillingDate timestamps", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: 0,
          cancelAtDate: null,
        },
      },
    ]);
    expect(resolveAccountMembershipPanelView(member).renewsLabel).toBeNull();
  });

  it("shows active membership monthly when price id matches", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Monthly Membership",
      statusLabel: "Active",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: "Membership renews automatically each month.",
      manageBillingDescription:
        "Update your payment method, view invoices, or manage your subscription.",
      annualSwitchWarning: null,
      visibleActions: ["manageBilling"],
    });
  });

  it("shows active membership annual when price id is nested under payment", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "TRIALING",
        payment: { priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId },
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Annual Membership",
      statusLabel: "Active",
      billingInterval: "annual",
      billingLabel: "Annual",
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: "Membership renews automatically each year.",
      manageBillingDescription:
        "Update your payment method, view invoices, or manage your subscription.",
      annualSwitchWarning: null,
      visibleActions: ["manageBilling"],
    });
  });

  it("shows Manage Billing for a past_due monthly paid plan (Linda case)", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "PAST_DUE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
          nextBillingDate: 1786838400,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view).toMatchObject({
      kind: "member",
      planDisplayLabel: "Monthly Membership",
      statusLabel: "Past Due",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      renewsLabel: null,
      isCanceling: false,
      autoRenewNote: null,
      manageBillingDescription:
        "Update your payment method, view invoices, or manage your subscription.",
      visibleActions: ["manageBilling"],
    });
    expect(view.visibleActions).not.toContain("join");
    expect(memberHasStripeCustomerPortalAccess(member)).toBe(true);
  });

  it("shows Manage Billing for past_due even when active is false", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "PAST_DUE",
        active: false,
        payment: {
          priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).toEqual(["manageBilling"]);
    expect(view.statusLabel).toBe("Past Due");
    expect(view.visibleActions).not.toContain("join");
  });

  it("does not show Manage Billing for legacy-only free plan members", () => {
    const member = memberWithPlans([
      {
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).not.toContain("manageBilling");
    expect(memberHasStripeCustomerPortalAccess(member)).toBe(false);
  });

  it("keeps Become a Member for fully canceled paid connections", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "CANCELED",
        priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.visibleActions).toEqual(["join"]);
    expect(memberHasStripeCustomerPortalAccess(member)).toBe(false);
  });

  it("treats fully inactive canceled connections as free for this panel", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "CANCELED",
        priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("free");
    expect(view.renewsLabel).toBeNull();
    expect(view.activeUntilMessage).toBeNull();
    expect(view.visibleActions).toEqual(["join"]);
  });

  it("does not recognize the removed annual Basic plan as a member", () => {
    const member = memberWithPlans([
      {
        planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member).kind).toBe("free");
  });

  it("shows an active Legacy Membership (free plan) with renew/monthly checkout actions", () => {
    const member = memberWithPlans([
      {
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "member",
      planLabel: "Legacy Membership",
      planDisplayLabel: "Legacy Membership",
      statusLabel: "Active",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      autoRenewNote: null,
      manageBillingDescription: null,
      annualSwitchWarning: null,
      visibleActions: ["renewAnnual", "becomeMonthly"],
    });
    // Legacy members are not active Stripe subscribers: no Manage Billing, no join.
    const actions = resolveAccountMembershipPanelView(member).visibleActions;
    expect(actions).not.toContain("join");
    expect(actions).not.toContain("manageBilling");
    expect(actions).not.toContain("switchToAnnual");
  });

  it("does not show Switch to Annual for no-plan members", () => {
    const view = resolveAccountMembershipPanelView(memberWithPlans([]));
    expect(view.visibleActions).toEqual(["join"]);
    expect(view.annualSwitchWarning).toBeNull();
  });

  it("recognizes remaining legacy monthly Basic plan ids as members", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toMatchObject({
      kind: "member",
      planLabel: "Knit it Now Membership",
      planDisplayLabel: "Monthly Membership",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      renewsLabel: null,
      visibleActions: ["manageBilling"],
    });
  });
});

describe("billingIntervalFromActivePaidConnection", () => {
  it("returns null when price id is not in the known price index", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
        priceId: "prc_unknown-legacy",
      },
    ]);
    expect(billingIntervalFromActivePaidConnection(member)).toBeNull();
  });
});

describe("isPortalEligiblePaidPlanConnection", () => {
  it("accepts ACTIVE, TRIALING, and PAST_DUE paid connections", () => {
    expect(
      isPortalEligiblePaidPlanConnection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      isPortalEligiblePaidPlanConnection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "TRIALING",
      }),
    ).toBe(true);
    expect(
      isPortalEligiblePaidPlanConnection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "PAST_DUE",
        active: false,
      }),
    ).toBe(true);
  });

  it("rejects free legacy plans and canceled paid plans", () => {
    expect(
      isPortalEligiblePaidPlanConnection({
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        status: "ACTIVE",
      }),
    ).toBe(false);
    expect(
      isPortalEligiblePaidPlanConnection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        status: "CANCELED",
      }),
    ).toBe(false);
  });
});
