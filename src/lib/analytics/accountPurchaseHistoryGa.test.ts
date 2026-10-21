import { describe, expect, it } from "vitest";

import {
  ACCOUNT_PURCHASE_HISTORY_RESULT_PARAM,
  ACCOUNT_PURCHASE_HISTORY_VIEW_EVENT,
  ACCOUNT_PURCHASE_TRACKING_CLICK_EVENT,
  reportAccountPurchaseHistoryView,
  reportAccountPurchaseTrackingClick,
  resetAccountPurchaseHistoryGaForTests,
  shouldReportAccountPurchaseHistoryToProductionGa,
  type AccountPurchaseHistoryGaContext,
} from "./accountPurchaseHistoryGa";

function productionContext(): { calls: unknown[][]; context: AccountPurchaseHistoryGaContext } {
  const calls: unknown[][] = [];
  return {
    calls,
    context: {
      now: 1_000,
      hostname: "www.knititnow.com",
      isViteDev: false,
      publicSiteEnv: "production",
      measurementIdConfigured: true,
      gtag: (...args: unknown[]) => {
        calls.push(args);
      },
    },
  };
}

describe("account purchase history analytics", () => {
  it("stays off localhost and the dev site", () => {
    expect(
      shouldReportAccountPurchaseHistoryToProductionGa({
        hostname: "localhost",
        isViteDev: true,
      }),
    ).toBe(false);
    expect(
      shouldReportAccountPurchaseHistoryToProductionGa({
        hostname: "kin-dev.netlify.app",
        isViteDev: false,
      }),
    ).toBe(false);
  });

  it("records a section view without an email, order number, or tracking url", () => {
    resetAccountPurchaseHistoryGaForTests();
    const { calls, context } = productionContext();
    expect(reportAccountPurchaseHistoryView("orders", context)).toBe(true);
    expect(reportAccountPurchaseHistoryView("orders", { ...context, now: 1_100 })).toBe(false);

    expect(calls).toEqual([
      [
        "event",
        ACCOUNT_PURCHASE_HISTORY_VIEW_EVENT,
        {
          [ACCOUNT_PURCHASE_HISTORY_RESULT_PARAM]: "orders",
          transport_type: "beacon",
        },
      ],
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/@|https?:|1Z/i);
  });

  it("records a tracking click without the link target", () => {
    resetAccountPurchaseHistoryGaForTests();
    const { calls, context } = productionContext();
    expect(reportAccountPurchaseTrackingClick(context)).toBe(true);
    expect(calls[0]?.[1]).toBe(ACCOUNT_PURCHASE_TRACKING_CLICK_EVENT);
    expect(JSON.stringify(calls[0]?.[2])).not.toMatch(/@|https?:|tracknum/i);
  });
});
