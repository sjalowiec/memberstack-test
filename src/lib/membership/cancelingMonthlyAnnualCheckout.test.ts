import { describe, expect, it } from "vitest";
import { LEGACY_MEMBERSHIPS, MEMBERSHIPS, RETIRED_MONTHLY_SUBSCRIPTION_PRICE_ID } from "../../config/memberships";
import {
  annualSwitchOverlapWarning,
  canPurchaseAnnualWhileCancelingMonthly,
} from "./cancelingMonthlyAnnualCheckout";

function memberWithPlans(
  connections: Array<{
    planId: string;
    status?: string;
    active?: boolean;
    priceId?: string;
    payment?: {
      priceId?: string;
      cancelAtDate?: number | null;
      nextBillingDate?: number | null;
    };
  }>,
) {
  return {
    data: {
      id: "mem_test",
      planConnections: connections,
    },
  };
}

const MONTHLY_PRICE = MEMBERSHIPS.membership.prices.monthly.memberstackPriceId;
const ANNUAL_PRICE = MEMBERSHIPS.membership.prices.annual.memberstackPriceId;
const PLAN_ID = MEMBERSHIPS.membership.memberstackPlanId;
const CANCEL_AT = 1787055395;

describe("canPurchaseAnnualWhileCancelingMonthly", () => {
  it("allows canceling monthly with no annual connection", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        active: true,
        payment: { priceId: MONTHLY_PRICE, cancelAtDate: CANCEL_AT },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(true);
  });

  it("rejects active monthly that is not canceling", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: MONTHLY_PRICE, cancelAtDate: null },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(false);
  });

  it("rejects canceling annual", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: ANNUAL_PRICE, cancelAtDate: CANCEL_AT },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(false);
  });

  it("rejects canceling monthly when a separate renewing monthly subscription exists", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: MONTHLY_PRICE, cancelAtDate: CANCEL_AT },
      },
      {
        planId: "pln_course-th160-legacy-lp1o10vtq",
        status: "ACTIVE",
        active: true,
      },
      {
        planId: LEGACY_MEMBERSHIPS.monthlySubscription.memberstackPlanId,
        status: "ACTIVE",
        payment: {
          priceId: RETIRED_MONTHLY_SUBSCRIPTION_PRICE_ID,
          cancelAtDate: null,
        },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(false);
    expect(member.data.planConnections).toHaveLength(3);
  });

  it("rejects canceling monthly when an active annual also exists", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: MONTHLY_PRICE, cancelAtDate: CANCEL_AT },
      },
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: ANNUAL_PRICE, cancelAtDate: null },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(false);
  });

  it("rejects members with no paid plan", () => {
    expect(canPurchaseAnnualWhileCancelingMonthly(memberWithPlans([]))).toBe(false);
  });

  it("rejects canceling paid connection with unknown price id", () => {
    const member = memberWithPlans([
      {
        planId: PLAN_ID,
        status: "ACTIVE",
        payment: { priceId: "prc_unknown", cancelAtDate: CANCEL_AT },
      },
    ]);
    expect(canPurchaseAnnualWhileCancelingMonthly(member)).toBe(false);
  });
});

describe("annualSwitchOverlapWarning", () => {
  it("includes the active-through date label", () => {
    expect(annualSwitchOverlapWarning("August 18, 2026")).toBe(
      "Purchasing annual now will start the annual membership immediately. " +
        "Your monthly membership will remain active until August 18, 2026.",
    );
  });
});
