import { describe, expect, it } from "vitest";
import {
  applyMembershipPageContentMode,
  MEMBERSHIP_THANK_YOU_FAVORITES_HREF,
  MEMBERSHIP_THANK_YOU_PATTERNS_HREF,
  membershipThankYouShouldAnimate,
} from "./membershipThankYou";

type StubEl = {
  hidden: boolean;
  attrs: Map<string, string>;
  offsetWidth: number;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  matches: (selector: string) => boolean;
};

function el(matchers: string[], initial?: { hidden?: boolean; open?: boolean }): StubEl & {
  open?: boolean;
  showModal?: () => void;
  close?: () => void;
} {
  const attrs = new Map<string, string>();
  const node: StubEl & {
    open?: boolean;
    showModal?: () => void;
    close?: () => void;
  } = {
    hidden: initial?.hidden ?? false,
    attrs,
    offsetWidth: 1,
    open: initial?.open ?? false,
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    removeAttribute: (name) => {
      attrs.delete(name);
    },
    matches: (selector) => matchers.includes(selector),
  };
  if (matchers.includes("[data-membership-whats-included-modal]")) {
    node.showModal = () => {
      node.open = true;
    };
    node.close = () => {
      node.open = false;
    };
  }
  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  return {
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode;
}

describe("membershipThankYou", () => {
  it("uses existing account routes for My Favorites and My Patterns", () => {
    expect(MEMBERSHIP_THANK_YOU_FAVORITES_HREF).toBe("/account#my-favorites");
    expect(MEMBERSHIP_THANK_YOU_PATTERNS_HREF).toBe("/account#my-patterns");
  });

  it("shows thank-you and hides sales for thank_you mode with one-shot enter", () => {
    const thankYou = el(["[data-membership-thank-you]"], { hidden: true });
    const sales = el(["[data-membership-sales-content]"], { hidden: false });
    const whatsIncludedOpen = el(["[data-membership-whats-included-open]"]);
    whatsIncludedOpen.setAttribute("data-membership-whats-included-mode", "anchor");
    const root = makeRoot([thankYou, sales, whatsIncludedOpen]);

    applyMembershipPageContentMode("thank_you", root, {
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    });

    expect(thankYou.hidden).toBe(false);
    expect(sales.hidden).toBe(true);
    expect(thankYou.getAttribute("data-membership-thank-you-enter")).toBe("1");
    expect(whatsIncludedOpen.getAttribute("data-membership-whats-included-mode")).toBe("modal");
  });

  it("prefers-reduced-motion shows static thank-you without enter attribute", () => {
    const thankYou = el(["[data-membership-thank-you]"], { hidden: true });
    const sales = el(["[data-membership-sales-content]"], { hidden: false });
    const root = makeRoot([thankYou, sales]);

    expect(
      membershipThankYouShouldAnimate(() => ({ matches: true }) as MediaQueryList),
    ).toBe(false);

    applyMembershipPageContentMode("thank_you", root, {
      matchMedia: () => ({ matches: true }) as MediaQueryList,
    });

    expect(thankYou.hidden).toBe(false);
    expect(sales.hidden).toBe(true);
    expect(thankYou.getAttribute("data-membership-thank-you-enter")).toBeNull();
  });

  it("restores sales content and hides thank-you in sales mode", () => {
    const thankYou = el(["[data-membership-thank-you]"], { hidden: false });
    thankYou.setAttribute("data-membership-thank-you-enter", "1");
    const sales = el(["[data-membership-sales-content]"], { hidden: true });
    const whatsIncludedOpen = el(["[data-membership-whats-included-open]"]);
    whatsIncludedOpen.setAttribute("data-membership-whats-included-mode", "modal");
    const whatsIncludedModal = el(["[data-membership-whats-included-modal]"], { open: true });
    const root = makeRoot([thankYou, sales, whatsIncludedOpen, whatsIncludedModal]);

    applyMembershipPageContentMode("sales", root);

    expect(thankYou.hidden).toBe(true);
    expect(sales.hidden).toBe(false);
    expect(thankYou.getAttribute("data-membership-thank-you-enter")).toBeNull();
    expect(whatsIncludedOpen.getAttribute("data-membership-whats-included-mode")).toBe("anchor");
    expect(whatsIncludedModal.open).toBe(false);
  });

  it("does not block interaction  links stay in the DOM while animating", () => {
    const thankYou = el(["[data-membership-thank-you]"], { hidden: true });
    const sales = el(["[data-membership-sales-content]"]);
    const root = makeRoot([thankYou, sales]);
    applyMembershipPageContentMode("thank_you", root, {
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    });
    // Entrance is CSS-only; no pointer-events lock or delayed reveal flag.
    expect(thankYou.hidden).toBe(false);
    expect(thankYou.getAttribute("data-membership-thank-you-locked")).toBeNull();
  });
});
