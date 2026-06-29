import { describe, expect, it } from "vitest";
import { QUICK_HELP_SESSION } from "../config/quickHelpSession";
import { hasQuickHelpSessionAccess } from "./quickHelpSessionAccess";

describe("hasQuickHelpSessionAccess", () => {
  it("returns true when the Quick Help plan is active", () => {
    expect(
      hasQuickHelpSessionAccess({
        data: {
          planConnections: [{ planId: QUICK_HELP_SESSION.memberstackPlanId, status: "ACTIVE" }],
        },
      }),
    ).toBe(true);
  });

  it("returns true when the Quick Help price is active", () => {
    expect(
      hasQuickHelpSessionAccess({
        data: {
          planConnections: [{ priceId: QUICK_HELP_SESSION.memberstackPriceId, status: "ACTIVE" }],
        },
      }),
    ).toBe(true);
  });

  it("returns false for unrelated plans", () => {
    expect(
      hasQuickHelpSessionAccess({
        data: {
          planConnections: [{ planId: "pln_other-plan", status: "ACTIVE" }],
        },
      }),
    ).toBe(false);
  });
});
