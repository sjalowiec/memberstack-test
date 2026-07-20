import { describe, expect, it } from "vitest";
import {
  buildSaleCheckoutSummary,
  displayStripePaymentLink,
  formatCheckoutActiveLine,
  formatEditingMachineIdLabel,
  getCheckoutInactiveReason,
  getSaleAdminWarnings,
  validateStripePaymentLink,
} from "./machineAdminFields";

const FULL_STRIPE_LINK =
  "https://buy.stripe.com/test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";

describe("Stripe Payment Link visibility", () => {
  it("keeps the full Stripe link visible (never truncates or replaces with ellipsis)", () => {
    expect(displayStripePaymentLink(FULL_STRIPE_LINK)).toBe(FULL_STRIPE_LINK);
    expect(displayStripePaymentLink(FULL_STRIPE_LINK)).not.toContain("...");
    expect(displayStripePaymentLink(FULL_STRIPE_LINK)).not.toBe("https://buy.stripe.com/...");

    const summary = buildSaleCheckoutSummary({
      machineId: 393,
      brand: "Taitexma",
      model: "TR-850",
      productType: "accessory",
      status: "available",
      availabilityStatus: "available",
      stripePaymentLink: FULL_STRIPE_LINK,
    });

    expect(summary.stripePaymentLink).toBe(FULL_STRIPE_LINK);
    expect(summary.stripePaymentLink.length).toBe(FULL_STRIPE_LINK.length);
  });
});

describe("Stripe Payment Link validation", () => {
  it("rejects a truncated link that contains ...", () => {
    const truncated = "https://buy.stripe.com/...";
    const result = validateStripePaymentLink(truncated);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/\.\.\./);
    expect(result.error.toLowerCase()).toMatch(/truncat/);
  });

  it("rejects links that do not begin with https://buy.stripe.com/", () => {
    const result = validateStripePaymentLink("https://example.com/pay");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("https://buy.stripe.com/");
  });

  it("accepts a full buy.stripe.com link and empty values", () => {
    expect(validateStripePaymentLink(FULL_STRIPE_LINK)).toEqual({
      ok: true,
      link: FULL_STRIPE_LINK,
    });
    expect(validateStripePaymentLink("")).toEqual({ ok: true, link: null });
    expect(validateStripePaymentLink("   ")).toEqual({ ok: true, link: null });
  });
});

describe("inactive checkout reason", () => {
  it("shows why checkout is inactive", () => {
    expect(
      getCheckoutInactiveReason({
        stripePaymentLink: null,
        status: "available",
      })
    ).toBe("Stripe Payment Link is missing");

    expect(
      formatCheckoutActiveLine({
        stripePaymentLink: null,
        status: "available",
      })
    ).toBe("Checkout active: No \u2014 Stripe Payment Link is missing");

    expect(
      getCheckoutInactiveReason({
        stripePaymentLink: FULL_STRIPE_LINK,
        status: "coming-soon",
      })
    ).toBe("status must be Available");

    expect(
      formatCheckoutActiveLine({
        stripePaymentLink: FULL_STRIPE_LINK,
        status: "coming-soon",
      })
    ).toBe("Checkout active: No \u2014 status must be Available");

    expect(
      formatCheckoutActiveLine({
        stripePaymentLink: FULL_STRIPE_LINK,
        status: "available",
      })
    ).toBe("Checkout active: Yes");

    const summary = buildSaleCheckoutSummary({
      machineId: 360,
      brand: "Taitexma",
      model: "TH860",
      productType: "machine",
      status: "sold-out",
      availabilityStatus: "unavailable",
      stripePaymentLink: FULL_STRIPE_LINK,
    });
    expect(summary.checkoutActive).toBe(false);
    expect(summary.inactiveReason).toBe("status must be Available");
    expect(summary.checkoutActiveLine).toBe(
      "Checkout active: No \u2014 status must be Available"
    );
  });
});

describe("editing machineId visibility", () => {
  it("makes the editing machineId visible while editing", () => {
    expect(formatEditingMachineIdLabel(393, "edit")).toBe("Editing machineId: 393");
    expect(formatEditingMachineIdLabel(360, "edit")).toContain("360");
    expect(formatEditingMachineIdLabel(393, "edit")).not.toContain("360");

    const summary = buildSaleCheckoutSummary({
      machineId: 393,
      brand: "Taitexma",
      model: "TR-850",
      productType: "accessory",
      status: "available",
      availabilityStatus: "available",
      stripePaymentLink: null,
    });
    expect(summary.productId).toBe("393");

    expect(formatEditingMachineIdLabel(401, "new")).toBe("Creating machineId: 401");
  });
});

describe("For Sale warnings", () => {
  it("warns when For Sale is checked but the Stripe link is missing", () => {
    const warnings = getSaleAdminWarnings({
      forSale: true,
      productType: "machine",
      featured: false,
      stripePaymentLink: null,
      status: "available",
    });
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => /for sale/i.test(w))).toBe(true);
    expect(warnings.some((w) => /Stripe Payment Link is missing/i.test(w))).toBe(true);
  });

  it("warns when an accessory is featured as a machine", () => {
    const warnings = getSaleAdminWarnings({
      forSale: true,
      productType: "accessory",
      featured: true,
      stripePaymentLink: FULL_STRIPE_LINK,
      status: "available",
    });
    expect(warnings.some((w) => /accessory/i.test(w) && /feature/i.test(w))).toBe(true);
  });

  it("does not warn when For Sale is off or checkout is active", () => {
    expect(
      getSaleAdminWarnings({
        forSale: false,
        productType: "machine",
        featured: false,
        stripePaymentLink: null,
        status: "available",
      })
    ).toEqual([]);

    expect(
      getSaleAdminWarnings({
        forSale: true,
        productType: "machine",
        featured: false,
        stripePaymentLink: FULL_STRIPE_LINK,
        status: "available",
      })
    ).toEqual([]);
  });
});
