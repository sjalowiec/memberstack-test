import { afterEach, describe, expect, it } from "vitest";
import {
  __resetMembershipStatusCtaForTests,
  applyMembershipStatusCtaMode,
  membershipStatusModeAllowsPurchase,
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
    expect(membershipStatusModeAllowsPurchase("wait")).toBe(false);
    expect(membershipStatusModeAllowsPurchase("loading")).toBe(false);
  });

  it("disables checkout buttons for manage / contact_support / wait", () => {
    const checkout = el(["[data-join-checkout]"]);
    const manage = el(["[data-membership-status-manage]"]);
    manage.hidden = true;
    const contact = el(["[data-membership-status-contact]"]);
    contact.hidden = true;
    const retry = el(["[data-membership-status-retry]"]);
    retry.hidden = true;
    const salesCta = el(["[data-membership-sales-cta]"]);
    const root = makeRoot([checkout, manage, contact, retry, salesCta]);

    applyMembershipStatusCtaMode("manage", root);
    expect(checkout.disabled).toBe(true);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect(manage.hidden).toBe(false);

    applyMembershipStatusCtaMode("contact_support", root);
    expect(checkout.disabled).toBe(true);
    expect(contact.hidden).toBe(false);
    expect(salesCta.textContent).toBe("Contact us about my membership");

    applyMembershipStatusCtaMode("wait", root);
    expect(checkout.disabled).toBe(true);
    expect(retry.hidden).toBe(false);
  });

  it("regression: active and canceling paid members cannot start checkout", () => {
    const active = {
      data: {
        id: "mem_a",
        planConnections: [
          { planId: MEMBERSHIPS.membership.memberstackPlanId, status: "ACTIVE" },
        ],
      },
    };
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
});
