import { describe, expect, it } from "vitest";

import { FREE_ACCESS_MEMBERSHIPS, MEMBERSHIPS } from "../../config/memberships";
import { FREE_MEMBERSHIP_DISPLAY_LABEL } from "../membership/membershipCheckoutDecision";
import { buildCustomerMemberstackSummary } from "./customerMemberstack";
import {
  buildWatsonCustomerCurrentMembership,
  watsonLegacyContextFromPaidThrough,
} from "./watsonCustomerCurrentMembership";

const NOW = new Date("2026-07-30T18:00:00.000Z");

function unixSeconds(ymd: string, hourUtc = 12): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hourUtc) / 1000);
}

function paidMonthlyMember(overrides?: {
  nextBillingYmd?: string;
  cancelAtYmd?: string | null;
}) {
  const nextBillingYmd = overrides?.nextBillingYmd ?? "2026-08-30";
  const payment: Record<string, unknown> = {
    priceId: MEMBERSHIPS.membership.prices.monthly.memberstackPriceId,
    nextBillingDate: unixSeconds(nextBillingYmd),
  };
  if (overrides?.cancelAtYmd) {
    payment.cancelAtDate = unixSeconds(overrides.cancelAtYmd);
  }
  return {
    id: "mem_ana",
    auth: { email: "amc0117@icloud.com", firstName: "Ana", lastName: "Coffy" },
    createdAt: "2024-01-15T00:00:00.000Z",
    planConnections: [
      {
        id: "pc_monthly",
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
        createdAt: "2026-07-30T00:00:00.000Z",
        payment,
      },
    ],
  };
}

function paidAnnualMember() {
  return {
    id: "mem_annual",
    auth: { email: "annual@example.com" },
    createdAt: "2024-01-15T00:00:00.000Z",
    planConnections: [
      {
        id: "pc_annual",
        planId: MEMBERSHIPS.membership.memberstackPlanId,
        planName: MEMBERSHIPS.membership.name,
        status: "ACTIVE",
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        payment: {
          priceId: MEMBERSHIPS.membership.prices.annual.memberstackPriceId,
          nextBillingDate: unixSeconds("2027-01-01"),
        },
      },
    ],
  };
}

function bridgedLegacyMember() {
  return {
    id: "mem_legacy_bridge",
    auth: { email: "legacy@example.com" },
    createdAt: "2023-05-01T00:00:00.000Z",
    planConnections: [
      {
        id: "pc_legacy",
        planId: FREE_ACCESS_MEMBERSHIPS.legacyMembership.memberstackPlanId,
        planName: FREE_ACCESS_MEMBERSHIPS.legacyMembership.name,
        status: "ACTIVE",
        active: true,
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  };
}

describe("buildWatsonCustomerCurrentMembership", () => {
  it("Ana Coffy: paid monthly wins over legacy record paid-through", () => {
    const member = paidMonthlyMember({ nextBillingYmd: "2026-08-30" });
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });
    const legacy = watsonLegacyContextFromPaidThrough({
      hasLegacyHistory: true,
      legacyExpirationYmd: "2026-07-31",
      legacyExpirationDate: "July 31, 2026",
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy,
      legacyAccessThroughDisplay: "July 31, 2026",
      now: NOW,
    });

    expect(current.currentPlan).toBe("Monthly Membership");
    expect(current.currentStatus).toBe("Active");
    expect(current.primaryDateLabel).toBe("Next renewal");
    expect(current.primaryDateValue).toBe("August 30, 2026");
    expect(current.membershipSource).toBe("Memberstack/Stripe");
    expect(current.isPaidMemberstack).toBe(true);
    expect(current.membershipStatusTone).toBe("active");
  });

  it("shows Annual Membership with next renewal for active annual paid members", () => {
    const member = paidAnnualMember();
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy: watsonLegacyContextFromPaidThrough({
        hasLegacyHistory: false,
        legacyExpirationYmd: null,
        legacyExpirationDate: null,
      }),
      now: NOW,
    });

    expect(current.currentPlan).toBe("Annual Membership");
    expect(current.currentStatus).toBe("Active");
    expect(current.primaryDateLabel).toBe("Next renewal");
    expect(current.primaryDateValue).toBe("January 1, 2027");
    expect(current.membershipSource).toBe("Memberstack/Stripe");
    expect(current.isPaidMemberstack).toBe(true);
  });

  it("shows bridged Legacy Membership with Watson paid-through as current", () => {
    const member = bridgedLegacyMember();
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy: watsonLegacyContextFromPaidThrough({
        hasLegacyHistory: true,
        legacyExpirationYmd: "2026-09-15",
        legacyExpirationDate: "September 15, 2026",
      }),
      legacyAccessThroughDisplay: "September 15, 2026",
      now: NOW,
    });

    expect(current.currentPlan).toBe(FREE_MEMBERSHIP_DISPLAY_LABEL);
    expect(current.currentStatus).toBe("Legacy Access");
    expect(current.primaryDateLabel).toBe("Paid through");
    expect(current.primaryDateValue).toBe("September 15, 2026");
    expect(current.membershipSource).toBe("Legacy");
    expect(current.isPaidMemberstack).toBe(false);
  });

  it("keeps paid monthly as current when Legacy Membership plan is also still attached", () => {
    const member = {
      id: "mem_both",
      auth: { email: "both@example.com" },
      planConnections: [
        ...bridgedLegacyMember().planConnections!,
        ...paidMonthlyMember({ nextBillingYmd: "2026-08-30" }).planConnections!,
      ],
    };
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy: watsonLegacyContextFromPaidThrough({
        hasLegacyHistory: true,
        legacyExpirationYmd: "2026-07-31",
        legacyExpirationDate: "July 31, 2026",
      }),
      legacyAccessThroughDisplay: "July 31, 2026",
      now: NOW,
    });

    expect(current.currentPlan).toBe("Monthly Membership");
    expect(current.currentStatus).toBe("Active");
    expect(current.primaryDateLabel).toBe("Next renewal");
    expect(current.primaryDateValue).toBe("August 30, 2026");
    expect(current.membershipSource).toBe("Memberstack/Stripe");
    expect(current.isPaidMemberstack).toBe(true);
  });

  it("shows Expired for members whose legacy paid-through has ended and have no Memberstack plan", () => {
    const member = {
      id: "mem_expired",
      auth: { email: "expired@example.com" },
      planConnections: [],
    };
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy: watsonLegacyContextFromPaidThrough({
        hasLegacyHistory: true,
        legacyExpirationYmd: "2026-04-06",
        legacyExpirationDate: "April 6, 2026",
      }),
      legacyAccessThroughDisplay: "April 6, 2026",
      now: NOW,
    });

    expect(current.currentStatus).toBe("Expired");
    expect(current.primaryDateLabel).toBe("Paid through");
    expect(current.primaryDateValue).toBe("April 6, 2026");
    expect(current.membershipSource).toBe("Legacy");
    expect(current.isPaidMemberstack).toBe(false);
    expect(current.membershipStatusTone).toBe("inactive");
  });

  it("shows Active through when a paid monthly membership is canceling", () => {
    const member = paidMonthlyMember({
      nextBillingYmd: "2026-08-30",
      cancelAtYmd: "2026-08-18",
    });
    const summary = buildCustomerMemberstackSummary({
      member,
      configured: true,
      loadError: null,
    });

    const current = buildWatsonCustomerCurrentMembership({
      memberstackMember: member,
      memberstackSummary: summary,
      memberstackLinkStatus: "linked",
      legacy: watsonLegacyContextFromPaidThrough({
        hasLegacyHistory: false,
        legacyExpirationYmd: null,
        legacyExpirationDate: null,
      }),
      now: NOW,
    });

    expect(current.currentPlan).toBe("Monthly Membership");
    expect(current.currentStatus).toBe("Canceling");
    expect(current.primaryDateLabel).toBe("Active through");
    expect(current.primaryDateValue).toBe("August 18, 2026");
    expect(current.membershipSource).toBe("Memberstack/Stripe");
  });
});
