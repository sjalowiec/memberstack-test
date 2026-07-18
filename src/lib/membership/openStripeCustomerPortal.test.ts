import { afterEach, describe, expect, it, vi } from "vitest";
import {
  launchStripeCustomerPortalSession,
  openStripeCustomerPortal,
  stripeCustomerPortalReturnUrl,
  STRIPE_PORTAL_RETURN_PATH,
} from "./openStripeCustomerPortal";

describe("stripeCustomerPortalReturnUrl", () => {
  it("points at /account#membership on the given origin", () => {
    expect(stripeCustomerPortalReturnUrl("https://example.com")).toBe(
      `https://example.com${STRIPE_PORTAL_RETURN_PATH}`,
    );
  });
});

describe("launchStripeCustomerPortalSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls launchStripeCustomerPortal with the account membership return URL", async () => {
    const launchStripeCustomerPortal = vi.fn().mockResolvedValue({
      data: { url: "https://billing.stripe.com/session/test" },
    });
    const ms = { launchStripeCustomerPortal } as unknown as Window["$memberstackDom"];

    const result = await launchStripeCustomerPortalSession({
      ms,
      returnUrl: "https://example.com/account#membership",
    });

    expect(launchStripeCustomerPortal).toHaveBeenCalledWith({
      returnUrl: "https://example.com/account#membership",
    });
    expect(result).toEqual({
      ok: true,
      url: "https://billing.stripe.com/session/test",
    });
  });

  it("returns unavailable when the Memberstack method is missing", async () => {
    const result = await launchStripeCustomerPortalSession({
      ms: {} as Window["$memberstackDom"],
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("returns no-url when the portal response has no URL", async () => {
    const ms = {
      launchStripeCustomerPortal: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as Window["$memberstackDom"];

    const result = await launchStripeCustomerPortalSession({ ms });
    expect(result).toEqual({ ok: false, reason: "no-url" });
  });

  it("returns error when launch throws", async () => {
    const error = new Error("portal down");
    const ms = {
      launchStripeCustomerPortal: vi.fn().mockRejectedValue(error),
    } as unknown as Window["$memberstackDom"];

    const result = await launchStripeCustomerPortalSession({ ms });
    expect(result).toEqual({ ok: false, reason: "error", error });
  });
});

describe("openStripeCustomerPortal", () => {
  it("navigates to the returned portal URL", async () => {
    const assign = vi.fn();
    const ms = {
      launchStripeCustomerPortal: vi.fn().mockResolvedValue({
        data: { url: "https://billing.stripe.com/p/open" },
      }),
    } as unknown as Window["$memberstackDom"];

    await expect(openStripeCustomerPortal({ ms, assign })).resolves.toBe(true);
    expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p/open");
  });

  it("does not navigate on failure", async () => {
    const assign = vi.fn();
    const ms = {
      launchStripeCustomerPortal: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as Window["$memberstackDom"];

    await expect(openStripeCustomerPortal({ ms, assign })).resolves.toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
