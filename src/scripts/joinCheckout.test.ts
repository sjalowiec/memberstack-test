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
  applyJoinCheckoutButtonStates,
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

function stubDom(options?: {
  updateTriggers?: Partial<Record<string, { click: ReturnType<typeof vi.fn> }>>;
  buttons?: Array<{ planKey: string; disabled?: boolean }>;
}) {
  const status = {
    hidden: true,
    textContent: "",
    classList: {
      remove: vi.fn(),
      add: vi.fn(),
    },
  };

  const updateTriggers = new Map<string, { click: ReturnType<typeof vi.fn> }>();
  for (const [key, trigger] of Object.entries(options?.updateTriggers ?? {})) {
    if (trigger) updateTriggers.set(key, trigger);
  }

  const buttons = (options?.buttons ?? []).map((b) => {
    const attrs = new Map<string, string>([["data-join-checkout", b.planKey]]);
    return {
      disabled: Boolean(b.disabled),
      textContent: "",
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        attrs.set(name, value);
      },
      addEventListener: vi.fn(),
    };
  });

  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "join-checkout-status" ? status : null),
    querySelectorAll: (sel: string) => {
      if (sel === "[data-join-checkout]") return buttons;
      return [];
    },
    querySelector: (sel: string) => {
      const match = /^\[data-join-price-update="([^"]+)"\]$/.exec(sel);
      if (match) {
        return updateTriggers.get(match[1]) ?? null;
      }
      return null;
    },
    addEventListener: vi.fn(),
  });
  return { status, buttons, updateTriggers };
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

describe("startJoinCheckout (purchase / update / current)", () => {
  beforeEach(() => {
    stubSessionStorage();
    stubDom();
    __resetJoinCheckoutForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. free member buying Basic uses normal checkout", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/basic" },
    });
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload("mem_free", [])),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("basicMonthly");

    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: MEMBERSHIP_PRICE_IDS.basicMonthly,
        successUrl: "https://example.com/signup/thank-you",
        autoRedirect: false,
      }),
    );
  });

  it("2. free member buying Premium uses normal checkout", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/premium" },
    });
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload("mem_free2", [])),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("premiumAnnual");

    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: MEMBERSHIP_PRICE_IDS.premiumAnnual }),
    );
  });

  it("3. active Basic choosing Basic is current — no checkout, portal, or status flash", async () => {
    const { status } = stubDom();
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();
    installMemberstack({
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
    expect(launchStripeCustomerPortal).not.toHaveBeenCalled();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("4. active Basic choosing Premium clicks hidden data-ms-price:update trigger", async () => {
    const updateClick = vi.fn();
    stubDom({
      updateTriggers: {
        premiumMonthly: { click: updateClick },
      },
    });
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_basic_up", [
          { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("premiumMonthly");

    expect(updateClick).toHaveBeenCalledTimes(1);
    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(launchStripeCustomerPortal).not.toHaveBeenCalled();
  });

  it("5. active Premium choosing Premium is current — no checkout or portal", async () => {
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();
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
    expect(launchStripeCustomerPortal).not.toHaveBeenCalled();
  });

  it("6. no active-member plan switch can call add/purchase checkout", async () => {
    const updateClick = vi.fn();
    stubDom({
      updateTriggers: {
        premiumMonthly: { click: updateClick },
        basicMonthly: { click: updateClick },
      },
    });
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();

    const basicMember = memberPayload("mem_b", [
      { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
    ]);
    const premiumMember = memberPayload("mem_p", [
      { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" },
    ]);

    installMemberstack({
      getCurrentMember: vi
        .fn()
        .mockResolvedValueOnce(basicMember)
        .mockResolvedValueOnce(basicMember)
        .mockResolvedValueOnce(premiumMember)
        .mockResolvedValueOnce(premiumMember),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("basicMonthly"); // current
    await startJoinCheckout("premiumMonthly"); // update
    await startJoinCheckout("premiumAnnual"); // current
    await startJoinCheckout("basicMonthly"); // update

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(updateClick).toHaveBeenCalledTimes(2);
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

  it("allows a canceled member to restart via purchase", async () => {
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

  it("active Premium choosing Basic uses update trigger, not purchase", async () => {
    const updateClick = vi.fn();
    stubDom({
      updateTriggers: {
        basicAnnual: { click: updateClick },
      },
    });
    const purchasePlansWithCheckout = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_prem_switch", [
          { planId: MEMBERSHIPS.premium.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("basicAnnual");

    expect(updateClick).toHaveBeenCalledTimes(1);
    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
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

  it("applyJoinCheckoutButtonStates sets Current Plan / Upgrade labels", () => {
    const { buttons } = stubDom({
      buttons: [
        { planKey: "basicMonthly" },
        { planKey: "premiumMonthly" },
      ],
    });

    applyJoinCheckoutButtonStates(
      memberPayload("mem_labels", [
        { planId: MEMBERSHIPS.basic.memberstackPlanId, status: "ACTIVE" },
      ]),
    );

    expect(buttons[0].textContent).toBe("Current Plan");
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].textContent).toBe("Upgrade to Premium");
    expect(buttons[1].disabled).toBe(false);
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
