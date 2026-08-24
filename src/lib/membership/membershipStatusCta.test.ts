import { afterEach, describe, expect, it } from "vitest";
import {
  __resetMembershipStatusCtaForTests,
  applyMembershipStatusCtaMode,
  membershipStatusModeAllowsPurchase,
  membershipStatusModeOwnsHeroCta,
  shouldBlockPurchaseForStatusMode,
} from "./membershipStatusCta";
import {
  memberHasActivePaidMembership,
  resolveMembershipCheckoutDecision,
} from "./membershipCheckoutDecision";
import { MEMBERSHIPS } from "../../config/memberships";

type StubEl = {
  hidden: boolean;
  disabled: boolean;
  textContent: string;
  attrs: Map<string, string>;
  classList: { add: (name: string) => void; remove: (name: string) => void };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  matches: (selector: string) => boolean;
};

function el(matchers: string[]): StubEl {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const node: StubEl = {
    hidden: false,
    disabled: false,
    textContent: "",
    attrs,
    classList: {
      add: (name) => {
        classes.add(name);
      },
      remove: (name) => {
        classes.delete(name);
      },
    },
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    removeAttribute: (name) => {
      attrs.delete(name);
    },
    matches: (selector) => matchers.includes(selector),
  };
  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  return {
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode;
}

afterEach(() => {
  __resetMembershipStatusCtaForTests();
});

describe("membershipStatusCta overlay", () => {
  it("allows purchase only for purchase mode or logged-out hidden mode", () => {
    expect(membershipStatusModeAllowsPurchase("purchase")).toBe(true);
    expect(membershipStatusModeAllowsPurchase("hidden")).toBe(true);
    expect(membershipStatusModeAllowsPurchase("manage")).toBe(false);
    expect(membershipStatusModeAllowsPurchase("contact_support")).toBe(false);
    expect(membershipStatusModeAllowsPurchase("renew_now")).toBe(false);
    expect(membershipStatusModeAllowsPurchase("wait")).toBe(false);
    expect(membershipStatusModeAllowsPurchase("loading")).toBe(false);
  });

  it("disables checkout buttons for manage / contact_support / wait", () => {
    const checkout = el(["[data-join-checkout]"]);
    const manage = el(["[data-membership-status-manage]"]);
    manage.hidden = true;
    const contact = el(["[data-membership-status-contact]"]);
    contact.hidden = true;
    const renew = el(["[data-membership-status-renew]"]);
    renew.hidden = true;
    const retry = el(["[data-membership-status-retry]"]);
    retry.hidden = true;
    const salesCta = el(["[data-membership-sales-cta]"]);
    const root = makeRoot([checkout, manage, contact, renew, retry, salesCta]);

    applyMembershipStatusCtaMode("manage", root);
    expect(checkout.disabled).toBe(true);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect(manage.hidden).toBe(false);

    applyMembershipStatusCtaMode("contact_support", root);
    expect(checkout.disabled).toBe(true);
    expect(contact.hidden).toBe(false);
    expect(salesCta.textContent).toBe("Contact us");

    applyMembershipStatusCtaMode("wait", root);
    expect(checkout.disabled).toBe(true);
    expect(retry.hidden).toBe(false);
    expect(renew.hidden).toBe(true);
  });

  it("shows Renew My Membership to /join for future legacy paid-through", () => {
    const checkout = el(["[data-join-checkout]"]);
    const manage = el(["[data-membership-status-manage]"]);
    manage.hidden = true;
    const contact = el(["[data-membership-status-contact]"]);
    contact.hidden = true;
    const renew = el(["[data-membership-status-renew]"]);
    renew.hidden = true;
    const retry = el(["[data-membership-status-retry]"]);
    retry.hidden = true;
    const salesCta = el(["[data-membership-sales-cta]"]);
    const root = makeRoot([checkout, manage, contact, renew, retry, salesCta]);

    applyMembershipStatusCtaMode("renew_now", root);
    expect(checkout.disabled).toBe(true);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect(renew.hidden).toBe(false);
    expect(contact.hidden).toBe(true);
    expect(manage.hidden).toBe(true);
    expect(salesCta.textContent).toBe("Renew My Membership");
    expect(salesCta.getAttribute("href")).toBe("/join");
    expect(salesCta.getAttribute("data-membership-sales-cta-kind")).toBe("renew");
  });

  it("regression: active paid and ambiguous canceling (no monthly price) cannot start checkout", () => {
    const active = {
      data: {
        id: "mem_a",
        planConnections: [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ],
      },
    };
    // Canceling without a known monthly price id stays blocked (ambiguous interval).
    const canceling = {
      data: {
        id: "mem_c",
        planConnections: [
          {
            planId: MEMBERSHIPS.membership.memberstackPlanId,
            status: "ACTIVE",
            payment: { cancelAtDate: Math.floor(Date.now() / 1000) + 86400 },
          },
        ],
      },
    };
    expect(memberHasActivePaidMembership(active)).toBe(true);
    expect(resolveMembershipCheckoutDecision(active, "monthly").action).toBe("current");
    expect(memberHasActivePaidMembership(canceling)).toBe(true);
    expect(resolveMembershipCheckoutDecision(canceling, "annual").action).toBe("current");
  });

  it("no paid membership can view purchase CTAs when status says purchase", () => {
    const checkout = el(["[data-join-checkout]"]);
    checkout.setAttribute("data-join-cta-state", "join");
    const root = makeRoot([checkout]);

    applyMembershipStatusCtaMode("loading", root);
    expect(checkout.disabled).toBe(true);

    applyMembershipStatusCtaMode("purchase", root);
    expect(checkout.disabled).toBe(false);
    expect(shouldBlockPurchaseForStatusMode()).toBe(false);
  });

  it("status overlay owns hero CTA for loading / wait / contact_support / manage", () => {
    expect(membershipStatusModeOwnsHeroCta("loading")).toBe(true);
    expect(membershipStatusModeOwnsHeroCta("wait")).toBe(true);
    expect(membershipStatusModeOwnsHeroCta("contact_support")).toBe(true);
    expect(membershipStatusModeOwnsHeroCta("renew_now")).toBe(true);
    expect(membershipStatusModeOwnsHeroCta("manage")).toBe(true);
    expect(membershipStatusModeOwnsHeroCta("purchase")).toBe(false);
    expect(membershipStatusModeOwnsHeroCta("hidden")).toBe(false);
  });

  it("loading mode sets a checking hero CTA and blocks purchase", () => {
    const checkout = el(["[data-join-checkout]"]);
    const salesCta = el(["[data-membership-sales-cta]"]);
    const manage = el(["[data-membership-status-manage]"]);
    manage.hidden = true;
    const root = makeRoot([checkout, salesCta, manage]);

    applyMembershipStatusCtaMode("loading", root);
    expect(salesCta.textContent).toBe("Checking membership...");
    expect(salesCta.getAttribute("data-membership-sales-cta-kind")).toBe("loading");
    expect(checkout.disabled).toBe(true);
    expect(manage.hidden).toBe(true);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
  });

  it("hidden and purchase modes clear Checking membership hero text", () => {
    const salesCta = el(["[data-membership-sales-cta]"]);
    const root = makeRoot([salesCta]);

    applyMembershipStatusCtaMode("loading", root);
    expect(salesCta.textContent).toBe("Checking membership...");

    applyMembershipStatusCtaMode("hidden", root);
    expect(salesCta.textContent).toBe("Choose a membership");
    expect(salesCta.getAttribute("data-membership-sales-cta-kind")).toBe("choose-plan");
    expect(salesCta.getAttribute("href")).toBe("#pricing");

    applyMembershipStatusCtaMode("loading", root);
    applyMembershipStatusCtaMode("purchase", root);
    expect(salesCta.textContent).toBe("Choose a membership");
    expect(salesCta.getAttribute("data-membership-sales-cta-kind")).toBe("choose-plan");
    expect(salesCta.getAttribute("href")).toBe("#pricing");
  });
});
