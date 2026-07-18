import { describe, expect, it } from "vitest";
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import {
  accountMembershipPanelActions,
  billingIntervalFromActivePaidConnection,
  formatMemberstackUnixDate,
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

/** Same formatter the panel uses — keeps assertions timezone-stable. */
function expectedLocalDateLabel(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(unixSeconds * 1000));
}

describe("accountMembershipPanelActions", () => {
  it("shows Join Basic and Join Premium for free members", () => {
    expect(accountMembershipPanelActions("free")).toEqual(["join-basic", "join-premium"]);
  });

  it("shows Upgrade and Manage for Basic members", () => {
    expect(accountMembershipPanelActions("basic")).toEqual(["upgrade", "manage"]);
  });

  it("shows only Manage for Premium members", () => {
    expect(accountMembershipPanelActions("premium")).toEqual(["manage"]);
  });

  it("shows only Manage for canceling Basic or Premium", () => {
    expect(accountMembershipPanelActions("basic", { canceling: true })).toEqual(["manage"]);
    expect(accountMembershipPanelActions("premium", { canceling: true })).toEqual(["manage"]);
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
  it("shows free account when there are no paid plan connections", () => {
    expect(resolveAccountMembershipPanelView(memberWithPlans([]))).toEqual({
      kind: "free",
      planLabel: "No active membership",
      statusLabel: "Free account",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      visibleActions: ["join-basic", "join-premium"],
    });
  });

  it("treats beta-only as free for this panel (not a paid Basic/Premium plan)", () => {
    const member = memberWithPlans([
      { planId: MEMBERSHIPS.beta.memberstackPlanId, status: "ACTIVE" },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("free");
    expect(view.renewsLabel).toBeNull();
    expect(view.activeUntilMessage).toBeNull();
    expect(view.visibleActions).toEqual(["join-basic", "join-premium"]);
  });

  it("shows active Basic without billing when price id is unknown", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "basic",
      planLabel: "Basic",
      statusLabel: "Active",
      billingInterval: null,
      billingLabel: null,
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      visibleActions: ["upgrade", "manage"],
    });
  });

  it("shows Active Premium with Renews when cancelAtDate is null", () => {
    const nextBillingDate = 1786838400;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
          nextBillingDate,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view).toMatchObject({
      kind: "premium",
      planLabel: "Premium",
      statusLabel: "Active",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      isCanceling: false,
      activeUntilMessage: null,
      visibleActions: ["manage"],
    });
    expect(view.renewsLabel).toBe(expectedLocalDateLabel(nextBillingDate));
  });

  it("shows Canceling Premium with active-until message and Manage only", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
          nextBillingDate: cancelAtDate,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    const dateLabel = expectedLocalDateLabel(cancelAtDate);
    expect(view).toMatchObject({
      kind: "premium",
      planLabel: "Premium",
      statusLabel: "Canceling",
      billingLabel: "Monthly",
      renewsLabel: null,
      isCanceling: true,
      visibleActions: ["manage"],
    });
    expect(view.activeUntilMessage).toBe(
      `Your membership remains active until ${dateLabel}.`,
    );
    expect(view.visibleActions).not.toContain("upgrade");
    expect(view.visibleActions).not.toContain("join-basic");
    expect(view.visibleActions).not.toContain("join-premium");
  });

  it("shows Canceling Basic with active-until message, Manage only, Upgrade hidden", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.basic.prices.annual.memberstackPriceId,
          nextBillingDate: cancelAtDate,
          cancelAtDate,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view).toMatchObject({
      kind: "basic",
      planLabel: "Basic",
      statusLabel: "Canceling",
      billingLabel: "Annual",
      renewsLabel: null,
      isCanceling: true,
      visibleActions: ["manage"],
    });
    expect(view.activeUntilMessage).toBe(
      `Your membership remains active until ${expectedLocalDateLabel(cancelAtDate)}.`,
    );
    expect(view.visibleActions).not.toContain("upgrade");
    expect(view.visibleActions).not.toContain("join-basic");
    expect(view.visibleActions).not.toContain("join-premium");
  });

  it("does not treat invalid cancelAtDate as canceling", () => {
    const nextBillingDate = 1786838400;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
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
    expect(view.visibleActions).toEqual(["manage"]);
  });

  it("shows active-until from cancelAtDate when nextBillingDate is missing", () => {
    const cancelAtDate = 1787055395;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        active: true,
        payment: {
          priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
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

  it("shows Renews for Basic annual with nextBillingDate", () => {
    const nextBillingDate = 1798761600;
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.basic.prices.annual.memberstackPriceId,
          nextBillingDate,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("basic");
    expect(view.billingLabel).toBe("Annual");
    expect(view.renewsLabel).toBe(expectedLocalDateLabel(nextBillingDate));
  });

  it("hides Renews for free accounts even if a stray nextBillingDate appears", () => {
    const member = memberWithPlans([]);
    expect(resolveAccountMembershipPanelView(member).renewsLabel).toBeNull();
  });

  it("hides Renews when nextBillingDate is null", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
          nextBillingDate: null,
          cancelAtDate: null,
        },
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("premium");
    expect(view.renewsLabel).toBeNull();
  });

  it("hides Renews for invalid nextBillingDate timestamps", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
          nextBillingDate: 0,
          cancelAtDate: null,
        },
      },
    ]);
    expect(resolveAccountMembershipPanelView(member).renewsLabel).toBeNull();
  });

  it("shows active Basic monthly when price id matches", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "basic",
      planLabel: "Basic",
      statusLabel: "Active",
      billingInterval: "monthly",
      billingLabel: "Monthly",
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      visibleActions: ["upgrade", "manage"],
    });
  });

  it("shows active Premium annual when price id is nested under payment", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "TRIALING",
        payment: { priceId: MEMBERSHIPS.premium.prices.annual.memberstackPriceId },
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toEqual({
      kind: "premium",
      planLabel: "Premium",
      statusLabel: "Active",
      billingInterval: "annual",
      billingLabel: "Annual",
      renewsLabel: null,
      isCanceling: false,
      activeUntilMessage: null,
      visibleActions: ["manage"],
    });
  });

  it("prefers Premium when both Basic and Premium are somehow active", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
      },
      {
        planId: MEMBERSHIPS.premium.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.premium.prices.monthly.memberstackPriceId,
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("premium");
    expect(view.visibleActions).toEqual(["manage"]);
  });

  it("treats fully inactive canceled connections as free for this panel", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "CANCELED",
        priceId: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
      },
    ]);
    const view = resolveAccountMembershipPanelView(member);
    expect(view.kind).toBe("free");
    expect(view.renewsLabel).toBeNull();
    expect(view.activeUntilMessage).toBeNull();
    expect(view.visibleActions).toEqual(["join-basic", "join-premium"]);
  });

  it("recognizes legacy Basic plan ids", () => {
    const member = memberWithPlans([
      {
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        status: "ACTIVE",
        priceId: MEMBERSHIPS.basic.prices.monthly.memberstackPriceId,
      },
    ]);
    expect(resolveAccountMembershipPanelView(member)).toMatchObject({
      kind: "basic",
      planLabel: "Basic",
      billingLabel: "Monthly",
      renewsLabel: null,
      visibleActions: ["upgrade", "manage"],
    });
  });
});

describe("billingIntervalFromActivePaidConnection", () => {
  it("returns null when price id is not in the known price index", () => {
    const member = memberWithPlans([
      {
        planId: MEMBERSHIPS.basic.memberstackPlanId,
        status: "ACTIVE",
        priceId: "prc_unknown-legacy",
      },
    ]);
    expect(billingIntervalFromActivePaidConnection(member)).toBeNull();
  });
});
