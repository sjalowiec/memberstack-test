import { describe, expect, it } from "vitest";
import {
  FREE_ACCESS_MEMBERSHIPS,
  LEGACY_MEMBERSHIPS,
  MEMBERSHIPS,
  REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
} from "../../config/memberships";
import type { CustomerMemberstackSummary } from "../watson/customerMemberstack";
import type { MemberMembershipDisplay } from "../watson/memberMembership";
import type { PlanConnection } from "./membershipSummary";
import {
  buildMembershipStatusSummary,
  calendarYmdForNow,
  formatMembershipCalendarDateFromYmd,
  membershipStatusAllowsPurchase,
  membershipStatusPanelHeading,
  previousPlanNameFromLegacyMemberships,
  previousPlanNameFromMemberstack,
  resolveLegacyExpirationTiming,
  ymdFromDateOnlyValue,
} from "./membershipStatusSummary";

/** Fixed "today" for deterministic legacy paid-through tests (America/Los_Angeles calendar). */
const TODAY = "2026-07-22";

function connection(partial: Partial<PlanConnection> & { planId: string }): PlanConnection {
  return {
    active: partial.active,
    status: partial.status,
    planId: partial.planId,
    planName: partial.planName,
    createdAt: partial.createdAt,
    canceledAt: partial.canceledAt,
    payment: partial.payment,
  };
}

function summaryFromConnections(
  connections: PlanConnection[],
  overrides?: Partial<CustomerMemberstackSummary>,
): CustomerMemberstackSummary {
  const displays = connections.map((conn) => {
    const active =
      conn.active === true ||
      (conn.status || "").toUpperCase() === "ACTIVE" ||
      (conn.status || "").toUpperCase() === "TRIALING";
    return {
      connectionId: conn.id ?? null,
      planName: conn.planName ?? null,
      planId: conn.planId ?? null,
      status: conn.status ?? null,
      activeLabel: active ? "Active" : "Canceled",
      billingInterval: null,
      startDate: null,
      startDateSort: conn.createdAt ?? "",
      canceledAt: null,
      canceledAtSort: conn.canceledAt ?? "",
      isPaidPlan: true,
    };
  });
  return {
    memberstackId: "mem_test",
    email: "member@example.com",
    displayName: "Test Member",
    accountCreatedAt: null,
    accountCreatedAtSort: "",
    connections: displays,
    hasActiveConnection: displays.some((c) => c.activeLabel === "Active"),
    membershipStatusLabel: displays.some((c) => c.activeLabel === "Active")
      ? "Active"
      : displays.length === 0
        ? "No Plan"
        : "Inactive",
    configured: true,
    loadError: null,
    ...overrides,
  };
}

function legacy(partial?: Partial<Parameters<typeof buildMembershipStatusSummary>[0]["legacy"]>) {
  return {
    linkState: "not_found" as const,
    legacyExpirationDate: null,
    legacyExpirationYmd: null,
    previousPlanName: null,
    ...partial,
  };
}

function summaryWithLegacy(options: {
  ymd: string;
  planName?: string;
  connections?: PlanConnection[];
  memberId?: string;
}) {
  const connections = options.connections ?? [];
  return buildMembershipStatusSummary({
    memberstackMember: { id: options.memberId ?? "mem_legacy", planConnections: connections },
    memberstackSummary: summaryFromConnections(connections),
    memberstackLookupOk: true,
    todayYmd: TODAY,
    legacy: legacy({
      linkState: "linked",
      legacyExpirationYmd: options.ymd,
      legacyExpirationDate: formatMembershipCalendarDateFromYmd(options.ymd),
      previousPlanName: options.planName ?? "Premium",
    }),
  });
}

describe("buildMembershipStatusSummary", () => {
  it("returns unknown/wait when Memberstack lookup failed", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: null,
      memberstackSummary: null,
      memberstackLookupOk: false,
      legacy: legacy({ linkState: "lookup_unavailable" }),
    });
    expect(result.identified).toBe(false);
    expect(result.currentStatus).toBe("unknown");
    expect(result.recommendedAction).toBe("wait");
    expect(result.customerFacingMessage).toMatch(/could not confirm/i);
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
  });

  it("marks active Premium (current paid plan) as manage", () => {
    const connections = [
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_premium", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("active");
    expect(result.accountType).toBe("paid_membership");
    expect(result.recommendedAction).toBe("manage");
    expect(result.currentPlanName).toBe(MEMBERSHIPS.membership.name);
    expect(result.customerFacingMessage).toBe(
      "Your Knit it Now Membership is active. You do not need to subscribe again.",
    );
    expect(result.recommendedAction).toBe("manage");
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(membershipStatusPanelHeading(result)).toBe("Your membership is active");
  });

  it("marks active Basic (legacy paid shell) as manage", () => {
    const connections = [
      connection({
        planId: LEGACY_MEMBERSHIPS.monthlyBasic.memberstackPlanId,
        planName: LEGACY_MEMBERSHIPS.monthlyBasic.name,
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_basic", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("active");
    expect(result.recommendedAction).toBe("manage");
    expect(result.accountType).toBe("paid_membership");
  });

  it("marks an active free legacy membership as active/manage (no purchase, no billing)", () => {
    const connections = [
      connection({
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        planName: FREE_ACCESS_MEMBERSHIPS.legacyMembership.name,
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_free_legacy", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("active");
    expect(result.currentPlanName).toBe("Legacy Membership");
    expect(result.accountType).toBe("free_membership");
    expect(result.recommendedAction).toBe("manage");
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(result.customerFacingMessage).toMatch(/Legacy Membership is active/);
  });

  it("preserves a linked legacy expiration date on an active free legacy membership", () => {
    const connections = [
      connection({
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_free_legacy_exp", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      todayYmd: TODAY,
      legacy: legacy({
        linkState: "linked",
        legacyExpirationYmd: "2026-07-30",
        legacyExpirationDate: formatMembershipCalendarDateFromYmd("2026-07-30"),
        previousPlanName: "Premium",
      }),
    });
    expect(result.currentStatus).toBe("active");
    expect(result.currentPlanName).toBe("Legacy Membership");
    expect(result.recommendedAction).toBe("manage");
    expect(result.legacyExpirationDate).toBe(
      formatMembershipCalendarDateFromYmd("2026-07-30"),
    );
  });

  it("marks canceling-but-active as manage with activeThroughDate", () => {
    const cancelAt = Math.floor(Date.UTC(2026, 7, 18) / 1000);
    const connections = [
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
        payment: { cancelAtDate: cancelAt },
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_canceling", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("canceling");
    expect(result.recommendedAction).toBe("manage");
    expect(result.activeThroughDate).toMatch(/2026/);
    expect(result.customerFacingMessage).toMatch(
      /Your Knit it Now Membership remains active through .+ You do not need to subscribe again before then\./,
    );
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(membershipStatusPanelHeading(result)).toMatch(/^Your membership is active through /);
  });

  it("treats no plan as non_paid_account with purchase", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_free", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("no_plan");
    expect(result.accountType).toBe("non_paid_account");
    expect(result.recommendedAction).toBe("purchase");
    expect(result.legacyLinkState).toBe("not_found");
    expect(result.customerFacingMessage).toMatch(/does not currently include an active/i);
    expect(result.customerFacingMessage).not.toMatch(/new customer/i);
    expect(membershipStatusAllowsPurchase(result)).toBe(true);
    expect(membershipStatusPanelHeading(result)).toBe("Your Knit it Now membership status");
  });

  it("legacy not_found is purchase-eligible (not a lookup failure)", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_sb_new", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      legacy: legacy({ linkState: "not_found" }),
    });
    expect(result.recommendedAction).toBe("purchase");
    expect(result.legacyLinkState).toBe("not_found");
    expect(membershipStatusAllowsPurchase(result)).toBe(true);
  });

  it("legacy lookup_unavailable waits and does not invent purchase", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_free", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      legacy: legacy({ linkState: "lookup_unavailable" }),
    });
    expect(result.recommendedAction).toBe("wait");
    expect(result.legacyLinkState).toBe("lookup_unavailable");
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(result.customerFacingMessage).toMatch(/could not confirm/i);
  });

  it("treats beta / non-paid active plan as no paid membership", () => {
    const connections = [
      connection({
        planId: MEMBERSHIPS.beta.memberstackPlanId,
        planName: MEMBERSHIPS.beta.name,
        status: "ACTIVE",
        active: true,
      }),
    ];
    // summaryFromConnections marks any ACTIVE as Active; paid detection uses plan ids.
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_beta", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.accountType).toBe("non_paid_account");
    expect(result.recommendedAction).toBe("purchase");
    expect(result.currentStatus).toBe("no_plan");
  });

  it("treats DesignaKnit free plan as non-paid with purchase", () => {
    const connections = [
      connection({
        planId: "pln_dak-quick-start-vp4e0are",
        planName: "DAK Quick Start",
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_dak", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.accountType).toBe("non_paid_account");
    expect(result.recommendedAction).toBe("purchase");
    expect(result.customerFacingMessage).toMatch(/Knit it Now account/i);
  });

  it("treats removed Basic plan as non-paid", () => {
    const connections = [
      connection({
        planId: REMOVED_BASIC_MEMBERSHIP_PLAN_ID,
        planName: "Basic",
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_removed_basic", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.accountType).toBe("non_paid_account");
    expect(result.recommendedAction).toBe("purchase");
  });

  it("marks inactive paid connections as inactive + purchase", () => {
    const connections = [
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "CANCELED",
        active: false,
        canceledAt: "2025-01-01T00:00:00.000Z",
      }),
    ];
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_inactive", planConnections: connections },
      memberstackSummary: summaryFromConnections(connections),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    expect(result.currentStatus).toBe("inactive");
    expect(result.previousPlanName).toBe(MEMBERSHIPS.membership.name);
    expect(result.recommendedAction).toBe("purchase");
  });

  it("past legacy expiration uses ended-on wording and purchase", () => {
    const result = summaryWithLegacy({ ymd: "2026-06-30" });
    expect(result.recommendedAction).toBe("purchase");
    expect(result.legacyExpirationDate).toBe("June 30, 2026");
    expect(result.customerFacingMessage).toBe(
      "You have a Knit it Now account, but we do not currently see an active membership. Your previous Premium annual membership ended on June 30, 2026.",
    );
    expect(result.customerFacingMessage).toMatch(/ended on/i);
    expect(result.customerFacingMessage).not.toMatch(/ran through/i);
    expect(result.customerFacingMessage).not.toMatch(/still have access|currently have access/i);
    expect(membershipStatusAllowsPurchase(result)).toBe(true);
    expect(membershipStatusPanelHeading(result)).toBe("Your Knit it Now membership status");
  });

  it("past legacy without plan name uses generic ended-on wording", () => {
    const noPlan = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_past", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      todayYmd: TODAY,
      legacy: legacy({
        linkState: "linked",
        legacyExpirationYmd: "2026-06-30",
        legacyExpirationDate: "June 30, 2026",
        previousPlanName: null,
      }),
    });
    expect(noPlan.customerFacingMessage).toBe(
      "You have a Knit it Now account, but we do not currently see an active membership. Your previous annual membership ended on June 30, 2026.",
    );
    expect(noPlan.recommendedAction).toBe("purchase");
  });

  it("legacy expiration yesterday recommends purchase", () => {
    const result = summaryWithLegacy({ ymd: "2026-07-21" });
    expect(result.recommendedAction).toBe("purchase");
    expect(membershipStatusAllowsPurchase(result)).toBe(true);
  });

  it("legacy expiration today uses renew_now with immediate-start warning", () => {
    const result = summaryWithLegacy({ ymd: "2026-07-22" });
    expect(result.recommendedAction).toBe("renew_now");
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(membershipStatusPanelHeading(result)).toBe(
      "You still have membership time remaining",
    );
    expect(result.customerFacingMessage).toBe(
      "Your Premium annual membership is paid through July 22, 2026.\n\nYou can renew now. Your new membership and billing period will begin today.",
    );
    expect(result.customerFacingMessage).not.toMatch(/contact us/i);
  });

  it("legacy expiration tomorrow uses renew_now and does not claim access or say previous", () => {
    const result = summaryWithLegacy({ ymd: "2026-07-23" });
    expect(result.recommendedAction).toBe("renew_now");
    expect(result.legacyExpirationDate).toBe("July 23, 2026");
    expect(result.customerFacingMessage).toBe(
      "Your Premium annual membership is paid through July 23, 2026.\n\nYou can renew now. Your new membership and billing period will begin today.",
    );
    expect(result.customerFacingMessage).not.toMatch(/previous/i);
    expect(result.customerFacingMessage).not.toMatch(/contact us/i);
    expect(result.customerFacingMessage).not.toMatch(
      /active membership on|currently have access|you have access|site access/i,
    );
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(membershipStatusPanelHeading(result)).toBe(
      "You still have membership time remaining",
    );
  });

  it("future legacy without plan name uses generic paid-through wording", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_future", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      todayYmd: TODAY,
      legacy: legacy({
        linkState: "linked",
        legacyExpirationYmd: "2026-07-30",
        legacyExpirationDate: "July 30, 2026",
        previousPlanName: null,
      }),
    });
    expect(result.customerFacingMessage).toBe(
      "Your membership is paid through July 30, 2026.\n\nYou can renew now. Your new membership and billing period will begin today.",
    );
    expect(result.recommendedAction).toBe("renew_now");
    expect(membershipStatusPanelHeading(result)).toBe(
      "You still have membership time remaining",
    );
  });

  it("active Memberstack membership wins regardless of future legacy expiration", () => {
    const connections = [
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
      }),
    ];
    const result = summaryWithLegacy({
      ymd: "2026-07-30",
      connections,
      memberId: "mem_active_legacy",
    });
    expect(result.currentStatus).toBe("active");
    expect(result.recommendedAction).toBe("manage");
    expect(result.legacyExpirationDate).toBe("July 30, 2026");
  });

  it("canceling-but-active Memberstack wins regardless of future legacy expiration", () => {
    const cancelAt = Math.floor(Date.UTC(2026, 7, 18) / 1000);
    const connections = [
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
        payment: { cancelAtDate: cancelAt },
      }),
    ];
    const result = summaryWithLegacy({
      ymd: "2026-12-31",
      connections,
      memberId: "mem_cancel_legacy",
    });
    expect(result.currentStatus).toBe("canceling");
    expect(result.recommendedAction).toBe("manage");
  });

  it("forces contact_support for ambiguous legacy email and omits legacy dates", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_ambig", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      legacy: legacy({
        linkState: "ambiguous",
        legacyExpirationDate: "Jul 30, 2026",
        previousPlanName: "Premium",
      }),
    });
    expect(result.legacyLinkState).toBe("ambiguous");
    expect(result.legacyExpirationDate).toBeNull();
    expect(result.previousPlanName).toBeNull();
    expect(result.recommendedAction).toBe("contact_support");
    expect(membershipStatusAllowsPurchase(result)).toBe(false);
    expect(membershipStatusPanelHeading(result)).toBe("We need to check your membership");
  });

  it("does not include staff/internal fields on the summary object", () => {
    const result = buildMembershipStatusSummary({
      memberstackMember: { id: "mem_privacy", planConnections: [] },
      memberstackSummary: summaryFromConnections([]),
      memberstackLookupOk: true,
      legacy: legacy(),
    });
    const keys = Object.keys(result);
    expect(keys).not.toContain("notes");
    expect(keys).not.toContain("orders");
    expect(keys).not.toContain("addresses");
    expect(keys).not.toContain("planConnections");
    expect(keys).not.toContain("ambiguousLegacyMemberids");
    expect(JSON.stringify(result)).not.toMatch(/watson/i);
  });
});

describe("legacy calendar date helpers", () => {
  it("does not shift date-only values because of UTC/timezone parsing", () => {
    expect(ymdFromDateOnlyValue("2026-07-30")).toBe("2026-07-30");
    expect(ymdFromDateOnlyValue("2026-07-30T00:00:00.000Z")).toBe("2026-07-30");
    expect(ymdFromDateOnlyValue(new Date("2026-07-30T00:00:00.000Z"))).toBe("2026-07-30");
    expect(formatMembershipCalendarDateFromYmd("2026-07-30")).toBe("July 30, 2026");
    // Evening UTC on Jul 29 is still Jul 29 in LA; morning UTC Jul 30 is Jul 29 in LA.
    expect(calendarYmdForNow(new Date("2026-07-30T06:00:00.000Z"))).toBe("2026-07-29");
    expect(calendarYmdForNow(new Date("2026-07-30T16:00:00.000Z"))).toBe("2026-07-30");
  });

  it("treats today as legacy_paid_through_future", () => {
    expect(resolveLegacyExpirationTiming("2026-07-22", "2026-07-22")).toBe(
      "legacy_paid_through_future",
    );
    expect(resolveLegacyExpirationTiming("2026-07-21", "2026-07-22")).toBe("legacy_expired");
    expect(resolveLegacyExpirationTiming("2026-07-23", "2026-07-22")).toBe(
      "legacy_paid_through_future",
    );
  });
});

describe("previous plan helpers", () => {
  it("reads previous plan from inactive Memberstack paid connections", () => {
    const summary = summaryFromConnections([
      connection({
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "CANCELED",
        canceledAt: "2025-06-01T00:00:00.000Z",
      }),
    ]);
    expect(previousPlanNameFromMemberstack(summary)).toBe(MEMBERSHIPS.membership.name);
  });

  it("labels legacy previous plan from premium flag only when present", () => {
    const rows: MemberMembershipDisplay[] = [
      {
        subscriptionId: "1",
        subscriptionRateId: null,
        startDate: "Jan 1, 2025",
        startDateSort: "2025-01-01T00:00:00.000Z",
        expirationDate: "Jul 30, 2026",
        expirationDateSort: "2026-07-30T00:00:00.000Z",
        cancelDate: null,
        cancelDateSort: "",
        cancelledFlag: null,
        amount: null,
        amountSort: "",
        renewalFlag: null,
        monthlyBillingFlag: "0",
        premiumFlag: "1",
        processor: null,
        transactionGuid: null,
        arbId: null,
        invoiceNumber: null,
      },
    ];
    expect(previousPlanNameFromLegacyMemberships(rows, "Jul 30, 2026")).toBe("Premium");
  });
});
