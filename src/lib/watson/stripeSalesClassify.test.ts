import { describe, it, expect } from "vitest";

import {
  readStripeMembershipConfig,
  stripeMembershipConfigIsEmpty,
} from "../../config/stripeMembership";
import { classifyStripeCharge } from "./stripeSalesClassify";

const config = readStripeMembershipConfig({
  STRIPE_MEMBERSHIP_MONTHLY_PRICE_IDS: "price_monthly_current, price_monthly_legacy",
  STRIPE_MEMBERSHIP_ANNUAL_PRICE_IDS: "price_annual_current",
  STRIPE_MEMBERSHIP_OTHER_PRICE_IDS: "price_membership_misc",
  STRIPE_MEMBERSHIP_PRODUCT_IDS: "prod_kin_membership",
});

describe("Stripe membership classification config", () => {
  it("parses comma/space separated ids and reports empty state", () => {
    expect(config.monthlyPriceIds.has("price_monthly_current")).toBe(true);
    expect(config.monthlyPriceIds.has("price_monthly_legacy")).toBe(true);
    expect(config.annualPriceIds.has("price_annual_current")).toBe(true);
    expect(config.membershipPriceIds.has("price_membership_misc")).toBe(true);
    expect(stripeMembershipConfigIsEmpty(config)).toBe(false);
    expect(stripeMembershipConfigIsEmpty(readStripeMembershipConfig({}))).toBe(true);
  });
});

describe("classifyStripeCharge", () => {
  it("classifies monthly membership by price id", () => {
    expect(
      classifyStripeCharge([{ priceId: "price_monthly_current", productId: "prod_kin_membership" }], config),
    ).toBe("monthly");
  });

  it("classifies legacy monthly price id as monthly", () => {
    expect(
      classifyStripeCharge([{ priceId: "price_monthly_legacy", productId: null }], config),
    ).toBe("monthly");
  });

  it("classifies annual membership by price id", () => {
    expect(
      classifyStripeCharge([{ priceId: "price_annual_current", productId: "prod_kin_membership" }], config),
    ).toBe("annual");
  });

  it("classifies a membership product with an unknown interval price as other", () => {
    expect(
      classifyStripeCharge([{ priceId: "price_unknown", productId: "prod_kin_membership" }], config),
    ).toBe("other");
    expect(
      classifyStripeCharge([{ priceId: "price_membership_misc", productId: null }], config),
    ).toBe("other");
  });

  it("excludes DesignaKnit and other non-membership Stripe products", () => {
    expect(
      classifyStripeCharge([{ priceId: "price_dak_pro", productId: "prod_designaknit" }], config),
    ).toBe("not_membership");
    expect(
      classifyStripeCharge([{ priceId: "price_pattern_builder", productId: "prod_UsvYNvqNgEGdsI" }], config),
    ).toBe("not_membership");
  });

  it("treats charges with no invoice lines as non-membership", () => {
    expect(classifyStripeCharge([], config)).toBe("not_membership");
  });

  it("never classifies by amount alone (no amount is passed in)", () => {
    // A $19.99-looking charge for a non-membership product is still excluded.
    expect(
      classifyStripeCharge([{ priceId: "price_random_1999", productId: "prod_other" }], config),
    ).toBe("not_membership");
  });
});
