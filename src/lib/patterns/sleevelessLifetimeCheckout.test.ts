import { describe, expect, it, vi } from "vitest";
import { PATTERN_BUILDER_LIFETIME_PURCHASES } from "../../config/patternBuilderLifetime";
import {
  buildSleevelessLifetimeCheckoutReturnUrls,
  startSleevelessLifetimeCheckout,
} from "./sleevelessLifetimeCheckout";

describe("buildSleevelessLifetimeCheckoutReturnUrls", () => {
  it("preserves the Sleeveless new-pattern intent on success and cancel URLs", () => {
    const loc = {
      href: "https://knititnow.com/patterns/sleeveless-express?foo=1#step",
      origin: "https://knititnow.com",
      pathname: "/patterns/sleeveless-express",
      hash: "#step",
    } as Location;

    const { successUrl, cancelUrl } = buildSleevelessLifetimeCheckoutReturnUrls(loc);
    expect(successUrl).toContain("new=1");
    expect(cancelUrl).toContain("new=1");
    expect(successUrl).toContain("sleevelessLifetime=success");
    expect(cancelUrl).toContain("sleevelessLifetime=canceled");
  });
});

describe("startSleevelessLifetimeCheckout", () => {
  it("starts checkout with the centralized Memberstack price id", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.com/test" },
    });
    const assignLocation = vi.fn();

    const result = await startSleevelessLifetimeCheckout({
      waitForMemberstack: async () =>
        ({
          getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_buyer" } }),
          purchasePlansWithCheckout,
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () =>
        ({
          href: "https://knititnow.com/patterns/sleeveless-express?new=1",
        }) as Location,
      assignLocation,
    });

    expect(result.ok).toBe(true);
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.memberstackPriceId,
        autoRedirect: false,
      }),
    );
    expect(purchasePlansWithCheckout.mock.calls[0]?.[0]?.priceId).not.toBe(
      PATTERN_BUILDER_LIFETIME_PURCHASES.sleeveless.stripeProductId,
    );
    expect(assignLocation).toHaveBeenCalledWith("https://checkout.stripe.com/test");
  });

  it("does not grant access when checkout fails to return a URL", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({ data: {} });

    const result = await startSleevelessLifetimeCheckout({
      waitForMemberstack: async () =>
        ({
          getCurrentMember: vi.fn().mockResolvedValue({ data: { id: "ms_buyer" } }),
          purchasePlansWithCheckout,
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () =>
        ({
          href: "https://knititnow.com/patterns/sleeveless-express?new=1",
        }) as Location,
      assignLocation: vi.fn(),
    });

    expect(result).toMatchObject({ ok: false, reason: "no-url" });
  });

  it("requires a logged-in member before checkout", async () => {
    const result = await startSleevelessLifetimeCheckout({
      waitForMemberstack: async () =>
        ({
          getCurrentMember: vi.fn().mockResolvedValue({ data: null }),
          purchasePlansWithCheckout: vi.fn(),
        }) as unknown as NonNullable<Window["$memberstackDom"]>,
      getLocation: () =>
        ({
          href: "https://knititnow.com/patterns/sleeveless-express?new=1",
        }) as Location,
      assignLocation: vi.fn(),
    });

    expect(result).toMatchObject({ ok: false, reason: "not-logged-in" });
  });
});
