import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS, MEMBERSHIP_PRICE_IDS } from "../config/memberships";
import { PENDING_MEMBERSHIP_CHECKOUT_KEY } from "../lib/membership/pendingMembershipCheckout";
import { stubSessionStorage } from "../lib/patterns/test/stubLocalStorage";
import {
  buildPendingMembershipCheckout,
  savePendingMembershipCheckout,
} from "../lib/membership/pendingMembershipCheckout";
import {
  __resetJoinCheckoutForTests,
  resumePendingMembershipCheckout,
  startJoinCheckout,
} from "./joinCheckout";

function memberPayload(
  id: string | null,
  connections: Array<{ planId: string; status: string }> = [],
) {
  if (!id) return { data: null };
  return {
    data: {
      id,
      planConnections: connections,
    },
  };
}

function stubDom() {
  const status = {
    hidden: true,
    textContent: "",
    classList: {
      remove: vi.fn(),
      add: vi.fn(),
    },
  };
  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "join-checkout-status" ? status : null),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: vi.fn(),
  });
  return status;
}

function installMemberstack(ms: Record<string, unknown>) {
  const win = {
    ...globalThis,
    location: {
      href: "https://example.com/membership",
      origin: "https://example.com",
    },
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    $memberstackDom: ms,
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("location", win.location);
  return win;
}

describe("startJoinCheckout (Phase 1 login-first)", () => {
  beforeEach(() => {
    stubSessionStorage();
    stubDom();
    __resetJoinCheckoutForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logged-out Basic monthly click opens LOGIN (not SIGNUP) and stores pending checkout", async () => {
    const openModal = vi.fn().mockImplementation(async () => {
      const raw = sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY);
      expect(raw).toBeTruthy();
      const pending = JSON.parse(String(raw));
      expect(pending.planKey).toBe("basicMonthly");
      expect(pending.priceId).toBe(MEMBERSHIP_PRICE_IDS.basicMonthly);
      return { type: "LOGIN" };
    });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      .mockResolvedValueOnce(memberPayload("mem_1"));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/session" },
    });
    const hideModal = vi.fn();

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal,
    });

    await startJoinCheckout("basicMonthly");

    expect(openModal).toHaveBeenCalledWith("LOGIN");
    expect(openModal).not.toHaveBeenCalledWith("SIGNUP");
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: MEMBERSHIP_PRICE_IDS.basicMonthly,
        successUrl: "https://example.com/signup/thank-you",
        autoRedirect: false,
      }),
    );
    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeNull();
  });

  it("logged-out Premium annual click stores pending Premium annual before login", async () => {
    const openModal = vi.fn().mockImplementation(async () => {
      const pending = JSON.parse(String(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)));
      expect(pending.planKey).toBe("premiumAnnual");
      expect(pending.priceId).toBe(MEMBERSHIP_PRICE_IDS.premiumAnnual);
      expect(pending.returnUrl).toBe("https://example.com/membership");
      return { type: "LOGIN" };
    });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      .mockResolvedValueOnce(memberPayload("mem_2"));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/p" },
    });

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("premiumAnnual");

    expect(openModal).toHaveBeenCalledWith("LOGIN");
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: MEMBERSHIP_PRICE_IDS.premiumAnnual }),
    );
  });

  it("resumes checkout after login for a no-plan member", async () => {
    const openModal = vi.fn().mockResolvedValue({ type: "LOGIN" });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      .mockResolvedValueOnce(memberPayload("mem_nopaln", []));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/resume" },
    });

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("basicAnnual");

    expect(getCurrentMember).toHaveBeenCalledTimes(2);
    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
  });

  it("allows a canceled member to restart", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/restart" },
    });
    const openModal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_canceled", [
          { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "CANCELED" },
        ]),
      ),
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("premiumMonthly");

    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
    expect(openModal).not.toHaveBeenCalled();
  });

  it("blocks active Basic from buying Basic again and opens billing portal", async () => {
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn().mockResolvedValue({
      data: { url: "https://billing.stripe.test/portal" },
    });
    const win = installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_basic", [
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("basicMonthly");

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(launchStripeCustomerPortal).toHaveBeenCalled();
    expect(win.location.href).toBe("https://billing.stripe.test/portal");
  });

  it("blocks active Premium from starting another Premium checkout", async () => {
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn().mockResolvedValue({
      data: { url: "https://billing.stripe.test/portal2" },
    });
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_prem", [
          { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("premiumAnnual");

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(launchStripeCustomerPortal).toHaveBeenCalled();
  });

  it("pending checkout survives login elsewhere and resumePendingMembershipCheckout continues", async () => {
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout(
        "premiumMonthly",
        "https://example.com/membership",
        Date.now(),
      ),
    );
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/from-pending" },
    });
    const openModal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload("mem_resume", [])),
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    const resumed = await resumePendingMembershipCheckout();

    expect(resumed).toBe(true);
    expect(openModal).not.toHaveBeenCalled();
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: MEMBERSHIP_PRICE_IDS.premiumMonthly,
        successUrl: "https://example.com/signup/thank-you",
      }),
    );
  });

  it("double-click does not open two checkout sessions", async () => {
    let resolveLogin: (value: { type: string }) => void = () => undefined;
    const openModal = vi.fn(
      () =>
        new Promise<{ type: string }>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      .mockResolvedValueOnce(memberPayload("mem_dbl"));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/once" },
    });

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    const first = startJoinCheckout("basicMonthly");
    const second = startJoinCheckout("basicMonthly");

    await vi.waitFor(() => {
      expect(openModal).toHaveBeenCalledTimes(1);
    });

    resolveLogin({ type: "LOGIN" });
    await Promise.all([first, second]);

    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
  });
});

describe("store / lifetime checkout isolation", () => {
  it("membership pending storage key is not used by pattern builder lifetime checkout module", async () => {
    const lifetime = await import("../lib/patterns/patternBuilderLifetimeCheckout");
    const source = lifetime.startPatternBuilderLifetimeCheckout.toString();
    expect(source).not.toContain(PENDING_MEMBERSHIP_CHECKOUT_KEY);
    expect(source).not.toContain("pending-membership-checkout");
  });

  it("quick help checkout does not import membership pending helpers", async () => {
    const quickHelp = await import("./quickHelpCheckout");
    expect(Object.keys(quickHelp)).toContain("initQuickHelpCheckout");
    const source = quickHelp.initQuickHelpCheckout.toString();
    expect(source).not.toContain("pending-membership-checkout");
  });
});
