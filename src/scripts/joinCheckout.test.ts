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
  applyMembershipSalesCtaState,
  resumePendingMembershipCheckout,
  startJoinCheckout,
} from "./joinCheckout";
import { MEMBERSHIP_SALES_CTA } from "../lib/membership/membershipSalesCta";

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
  buttons?: Array<{ planKey: string; disabled?: boolean }>;
  salesCta?: boolean;
}) {
  const status = {
    hidden: true,
    textContent: "",
    classList: {
      remove: vi.fn(),
      add: vi.fn(),
    },
    replaceChildren: vi.fn(function replaceChildren(this: { textContent: string }, ...nodes: unknown[]) {
      if (nodes.length === 0) {
        this.textContent = "";
        return;
      }
      this.textContent = nodes
        .map((node) => {
          if (typeof node === "string") return node;
          if (node && typeof node === "object" && "textContent" in node) {
            return String((node as { textContent?: string }).textContent ?? "");
          }
          return "";
        })
        .join("");
    }),
    append: vi.fn(),
  };

  const activeConfirmation = {
    hidden: true,
  };

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

  const salesCtas =
    options?.salesCta === false
      ? []
      : [
          (() => {
            const attrs = new Map<string, string>([
              ["href", MEMBERSHIP_SALES_CTA.choosePlan.href],
              ["data-membership-sales-cta-kind", MEMBERSHIP_SALES_CTA.choosePlan.kind],
            ]);
            return {
              textContent: MEMBERSHIP_SALES_CTA.choosePlan.label,
              getAttribute: (name: string) => attrs.get(name) ?? null,
              setAttribute: (name: string, value: string) => {
                attrs.set(name, value);
              },
            };
          })(),
        ];

  vi.stubGlobal("document", {
    getElementById: (id: string) => (id === "join-checkout-status" ? status : null),
    querySelectorAll: (sel: string) => {
      if (sel === "[data-join-checkout]") return buttons;
      if (sel === "[data-membership-active-confirmation]") return [activeConfirmation];
      if (sel === "[data-membership-sales-cta]") return salesCtas;
      return [];
    },
    querySelector: () => null,
    addEventListener: vi.fn(),
    createElement: (tag: string) => {
      const children: unknown[] = [];
      return {
        tagName: tag.toUpperCase(),
        type: "",
        className: "",
        textContent: "",
        children,
        append: (...nodes: unknown[]) => {
          children.push(...nodes);
        },
        addEventListener: vi.fn(),
      };
    },
  });
  return { status, buttons, activeConfirmation, salesCtas };
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

describe("startJoinCheckout (purchase / current)", () => {
  beforeEach(() => {
    stubSessionStorage();
    stubDom();
    __resetJoinCheckoutForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. free member buying monthly uses normal checkout", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/monthly" },
    });
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload("mem_free", [])),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");

    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: MEMBERSHIP_PRICE_IDS.monthly,
        successUrl: "https://example.com/signup/thank-you",
        autoRedirect: false,
      }),
    );
  });

  it("2. free member buying annual uses normal checkout", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/annual" },
    });
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload("mem_free2", [])),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("annual");

    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: MEMBERSHIP_PRICE_IDS.annual }),
    );
  });

  it("3. active member choosing monthly is current  no checkout, portal, or status flash", async () => {
    const { status } = stubDom();
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_member", [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(launchStripeCustomerPortal).not.toHaveBeenCalled();
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
  });

  it("4. active member choosing annual is current  no checkout or portal", async () => {
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_member2", [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ]),
      ),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("annual");

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
    expect(launchStripeCustomerPortal).not.toHaveBeenCalled();
  });

  it("5. active paid member never calls purchase checkout for either interval", async () => {
    const purchasePlansWithCheckout = vi.fn();
    const launchStripeCustomerPortal = vi.fn();

    const paidMember = memberPayload("mem_paid", [
      { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
    ]);

    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(paidMember),
      openModal: vi.fn(),
      purchasePlansWithCheckout,
      launchStripeCustomerPortal,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");
    await startJoinCheckout("annual");

    expect(purchasePlansWithCheckout).not.toHaveBeenCalled();
  });

  it("logged-out monthly click opens SIGNUP (not LOGIN-only) and stores pending checkout", async () => {
    const openModal = vi.fn().mockImplementation(async () => {
      const raw = sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY);
      expect(raw).toBeTruthy();
      const pending = JSON.parse(String(raw));
      expect(pending.planKey).toBe("monthly");
      expect(pending.priceId).toBe(MEMBERSHIP_PRICE_IDS.monthly);
      return { type: "SIGNUP" };
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

    await startJoinCheckout("monthly");

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(openModal).not.toHaveBeenCalledWith("LOGIN");
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: MEMBERSHIP_PRICE_IDS.monthly,
        successUrl: "https://example.com/signup/thank-you",
        autoRedirect: false,
      }),
    );
    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeNull();
  });

  it("logged-out annual click accepts LOGIN when visitor switches in the auth modal", async () => {
    const openModal = vi.fn().mockResolvedValue({ type: "LOGIN" });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      .mockResolvedValueOnce(memberPayload("mem_returning"));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/annual-login" },
    });

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("annual");

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(purchasePlansWithCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: MEMBERSHIP_PRICE_IDS.annual }),
    );
  });

  it("CLOSED after successful auth (hideModal race) still resumes checkout  no paused banner", async () => {
    const { status } = stubDom();
    const openModal = vi.fn().mockResolvedValue({ type: "CLOSED" });
    const getCurrentMember = vi
      .fn()
      .mockResolvedValueOnce(memberPayload(null))
      // openMembershipAuthModal re-checks member after CLOSED
      .mockResolvedValueOnce(memberPayload("mem_closed_race"))
      // startJoinCheckout re-reads member after authenticated outcome
      .mockResolvedValueOnce(memberPayload("mem_closed_race"));
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/closed-race" },
    });

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
    expect(status.hidden).toBe(false);
    expect(String(status.textContent)).not.toMatch(/Checkout paused/i);
    expect(String(status.textContent)).not.toMatch(/Sign Up in the menu/i);
  });

  it("modal dismiss (CLOSED, still logged out) clears status and keeps pending  no paused banner", async () => {
    const { status } = stubDom();
    const openModal = vi.fn().mockResolvedValue({ type: "CLOSED" });
    const getCurrentMember = vi.fn().mockResolvedValue(memberPayload(null));

    installMemberstack({
      getCurrentMember,
      openModal,
      purchasePlansWithCheckout: vi.fn(),
      hideModal: vi.fn(),
    });

    await startJoinCheckout("annual");

    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeTruthy();
    expect(status.hidden).toBe(true);
    expect(String(status.textContent)).not.toMatch(/Checkout paused/i);
    expect(String(status.textContent)).not.toMatch(/Sign Up in the menu/i);
  });

  it("when SIGNUP modal fails to open, shows inline Sign Up / Log In fallback only", async () => {
    const { status } = stubDom();
    const openModal = vi.fn().mockRejectedValue(new Error("Modal failed to load."));
    const created: Array<{ textContent?: string }> = [];
    const doc = document as Document & {
      createElement: (tag: string) => HTMLElement;
    };
    const originalCreate = doc.createElement.bind(doc);
    vi.spyOn(doc, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag) as HTMLElement & { textContent: string };
      created.push(el);
      return el;
    });

    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(memberPayload(null)),
      openModal,
      purchasePlansWithCheckout: vi.fn(),
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");

    expect(openModal).toHaveBeenCalledWith("SIGNUP");
    expect(status.hidden).toBe(false);
    expect(status.append).toHaveBeenCalled();
    const labels = created.map((el) => el.textContent).filter(Boolean);
    expect(labels).toContain("Could not open the signup window. Continue here:");
    expect(labels).toContain("Sign Up");
    expect(labels).toContain("Log In");
    expect(labels.some((t) => /Sign Up in the menu/i.test(String(t)))).toBe(false);
    expect(labels.some((t) => /Checkout paused/i.test(String(t)))).toBe(false);
    expect(sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY)).toBeTruthy();
  });

  it("allows a canceled member to restart via purchase", async () => {
    const purchasePlansWithCheckout = vi.fn().mockResolvedValue({
      data: { url: "https://checkout.stripe.test/restart" },
    });
    const openModal = vi.fn();
    installMemberstack({
      getCurrentMember: vi.fn().mockResolvedValue(
        memberPayload("mem_canceled", [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "CANCELED" },
        ]),
      ),
      openModal,
      purchasePlansWithCheckout,
      hideModal: vi.fn(),
    });

    await startJoinCheckout("monthly");

    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
    expect(openModal).not.toHaveBeenCalled();
  });

  it("pending checkout survives login elsewhere and resumePendingMembershipCheckout continues", async () => {
    savePendingMembershipCheckout(
      buildPendingMembershipCheckout(
        "monthly",
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
        priceId: MEMBERSHIP_PRICE_IDS.monthly,
        successUrl: "https://example.com/signup/thank-you",
      }),
    );
  });

  it("double-click does not open two checkout sessions", async () => {
    let resolveAuth: (value: { type: string }) => void = () => undefined;
    const openModal = vi.fn(
      () =>
        new Promise<{ type: string }>((resolve) => {
          resolveAuth = resolve;
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

    const first = startJoinCheckout("monthly");
    const second = startJoinCheckout("monthly");

    await vi.waitFor(() => {
      expect(openModal).toHaveBeenCalledTimes(1);
    });

    resolveAuth({ type: "SIGNUP" });
    await Promise.all([first, second]);

    expect(purchasePlansWithCheckout).toHaveBeenCalledTimes(1);
  });

  it("main sales CTA: logged-out visitor stays on Become a Member ? #pricing", () => {
    const { salesCtas } = stubDom({ salesCta: true });

    applyMembershipSalesCtaState(memberPayload(null));

    expect(salesCtas[0].textContent).toBe("Become a Member");
    expect(salesCtas[0].getAttribute("href")).toBe("#pricing");
    expect(salesCtas[0].getAttribute("data-membership-sales-cta-kind")).toBe("choose-plan");
  });

  it("main sales CTA: logged-in free user stays on Become a Member ? #pricing", () => {
    const { salesCtas } = stubDom({ salesCta: true });

    applyMembershipSalesCtaState(memberPayload("mem_free_sales", []));

    expect(salesCtas[0].textContent).toBe("Become a Member");
    expect(salesCtas[0].getAttribute("href")).toBe("#pricing");
    expect(salesCtas[0].getAttribute("data-membership-sales-cta-kind")).toBe("choose-plan");
  });

  it("main sales CTA: active paid member ? Manage Membership ? account", () => {
    const { salesCtas } = stubDom({ salesCta: true });

    applyMembershipSalesCtaState(
      memberPayload("mem_paid_sales", [
        { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
      ]),
    );

    expect(salesCtas[0].textContent).toBe("Manage Membership");
    expect(salesCtas[0].getAttribute("href")).toBe("/account#membership");
    expect(salesCtas[0].getAttribute("data-membership-sales-cta-kind")).toBe("manage");
  });

  it("applyJoinCheckoutButtonStates also syncs the main sales CTA", () => {
    const { salesCtas } = stubDom({
      buttons: [{ planKey: "monthly" }],
      salesCta: true,
    });

    applyJoinCheckoutButtonStates(
      memberPayload("mem_sync_sales", [
        { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
      ]),
    );

    expect(salesCtas[0].textContent).toBe("Manage Membership");
    expect(salesCtas[0].getAttribute("href")).toBe("/account#membership");
  });

  it("applyJoinCheckoutButtonStates sets Become a Member / Current Plan labels", () => {
    const { buttons, activeConfirmation } = stubDom({
      buttons: [{ planKey: "monthly" }, { planKey: "annual" }],
    });

    applyJoinCheckoutButtonStates(
      memberPayload("mem_labels", [
        { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
      ]),
    );

    expect(buttons[0].textContent).toBe("Current Plan");
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].textContent).toBe("Current Plan");
    expect(buttons[1].disabled).toBe(true);
    expect(activeConfirmation.hidden).toBe(false);
  });

  it("applyJoinCheckoutButtonStates shows Become a Member for free members", () => {
    const { buttons, activeConfirmation } = stubDom({
      buttons: [{ planKey: "monthly" }, { planKey: "annual" }],
    });

    applyJoinCheckoutButtonStates(memberPayload("mem_free_labels", []));

    expect(buttons[0].textContent).toBe("Become a Member");
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].textContent).toBe("Become a Member");
    expect(buttons[1].disabled).toBe(false);
    expect(activeConfirmation.hidden).toBe(true);
  });

  it("applyJoinCheckoutButtonStates hides active confirmation for canceled members", () => {
    const { buttons, activeConfirmation } = stubDom({
      buttons: [{ planKey: "monthly" }],
    });

    applyJoinCheckoutButtonStates(
      memberPayload("mem_canceled_labels", [
        { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "CANCELED" },
      ]),
    );

    expect(buttons[0].textContent).toBe("Become a Member");
    expect(buttons[0].disabled).toBe(false);
    expect(activeConfirmation.hidden).toBe(true);
  });

  it("applyJoinCheckoutButtonStates hides active confirmation when logged out", () => {
    const { activeConfirmation } = stubDom({
      buttons: [{ planKey: "monthly" }],
    });

    applyJoinCheckoutButtonStates(memberPayload(null));

    expect(activeConfirmation.hidden).toBe(true);
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
