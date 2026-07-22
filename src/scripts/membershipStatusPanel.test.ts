import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/membership/membershipStatusClient", () => ({
  fetchMembershipStatus: vi.fn(),
  isMembershipStatusMemberLoggedIn: vi.fn(),
  MembershipStatusAuthError: class MembershipStatusAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "MembershipStatusAuthError";
    }
  },
}));

import {
  fetchMembershipStatus,
  isMembershipStatusMemberLoggedIn,
} from "../lib/membership/membershipStatusClient";
import {
  __resetMembershipStatusCtaForTests,
  getMembershipStatusCtaMode,
  shouldBlockPurchaseForStatusMode,
} from "../lib/membership/membershipStatusCta";
import { loadAndRenderMembershipStatusPanel } from "./membershipStatusPanel";

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
  querySelector: (selector: string) => StubEl | null;
};

function el(matchers: string[], initial?: Partial<StubEl>): StubEl {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const node: StubEl = {
    hidden: initial?.hidden ?? false,
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
    querySelector: () => null,
  };
  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode & { nodes: StubEl[] } {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  const facts = nodes.find((n) => n.matches("[data-membership-status-facts]"));
  if (facts) {
    facts.querySelector = (selector: string) =>
      list(selector).find((n) => !n.hidden) ?? null;
  }
  return {
    nodes,
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode & { nodes: StubEl[] };
}

function mountPanel() {
  return makeRoot([
    el(["[data-membership-status-panel]"], { hidden: true }),
    el(["[data-membership-status-loading]"], { hidden: true }),
    el(["[data-membership-status-body]"], { hidden: true }),
    el(["[data-membership-status-heading]"]),
    el(["[data-membership-status-message]"]),
    el(["[data-membership-status-facts]"]),
    el(['[data-membership-status-fact="status"]']),
    el(['[data-membership-status-value="status"]']),
    el(['[data-membership-status-fact="plan"]'], { hidden: true }),
    el(['[data-membership-status-value="plan"]']),
    el(['[data-membership-status-fact="through"]'], { hidden: true }),
    el(['[data-membership-status-value="through"]']),
    el(['[data-membership-status-fact="previous"]'], { hidden: true }),
    el(['[data-membership-status-value="previous"]']),
    el(["[data-membership-status-manage]"], { hidden: true }),
    Object.assign(el(["[data-membership-status-contact]"], { hidden: true }), {
      textContent: "Contact us about my membership",
    }),
    el(["[data-membership-status-retry]"], { hidden: true }),
    el(["[data-join-checkout]"]),
    el(["[data-membership-sales-cta]"]),
  ]);
}

let root: ReturnType<typeof mountPanel>;

beforeEach(() => {
  __resetMembershipStatusCtaForTests();
  root = mountPanel();
});

afterEach(() => {
  vi.clearAllMocks();
  __resetMembershipStatusCtaForTests();
});

describe("membership status panel page behavior", () => {
  it("keeps the panel hidden when logged out (sales page unchanged)", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(false);
    await loadAndRenderMembershipStatusPanel(root);
    const panel = root.querySelector("[data-membership-status-panel]") as unknown as StubEl;
    expect(panel.hidden).toBe(true);
    expect(fetchMembershipStatus).not.toHaveBeenCalled();
    const checkout = root.querySelector("[data-join-checkout]") as unknown as StubEl;
    expect(checkout.disabled).toBe(false);
    expect(getMembershipStatusCtaMode()).toBe("hidden");
  });

  it("suppresses purchase buttons during loading (no flash)", async () => {
    let resolveLoggedIn: (value: boolean) => void = () => {};
    vi.mocked(isMembershipStatusMemberLoggedIn).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoggedIn = resolve;
        }),
    );

    const pending = loadAndRenderMembershipStatusPanel(root);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect(
      (root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled,
    ).toBe(true);

    resolveLoggedIn(false);
    await pending;
    expect(getMembershipStatusCtaMode()).toBe("hidden");
  });

  it("shows active message and manage action; suppresses purchase", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "active",
      currentPlanName: "Knit it Now Membership",
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "not_found",
      accountType: "paid_membership",
      recommendedAction: "manage",
      customerFacingMessage:
        "Your Knit it Now Membership is active. You do not need to subscribe again.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your membership is active");
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
  });

  it("canceling-but-active suppresses purchase and shows manage", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "canceling",
      currentPlanName: "Knit it Now Membership",
      previousPlanName: null,
      activeThroughDate: "August 18, 2026",
      legacyExpirationDate: null,
      legacyLinkState: "not_found",
      accountType: "paid_membership",
      recommendedAction: "manage",
      customerFacingMessage:
        "Your Knit it Now Membership remains active through August 18, 2026. You do not need to subscribe again before then.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your membership is active through August 18, 2026");
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
  });

  it("future legacy paid-through uses reassuring wording, contact action, no purchase", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "no_plan",
      currentPlanName: null,
      previousPlanName: "Premium",
      activeThroughDate: null,
      legacyExpirationDate: "July 30, 2026",
      legacyLinkState: "linked",
      accountType: "non_paid_account",
      recommendedAction: "contact_support",
      customerFacingMessage:
        "Good news! It looks like your Premium annual membership still has paid time remaining through July 30, 2026. Before you purchase another membership, please contact us so we can make sure you do not lose any of that time.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    const heading = (root.querySelector("[data-membership-status-heading]") as unknown as StubEl)
      .textContent;
    const message = (root.querySelector("[data-membership-status-message]") as unknown as StubEl)
      .textContent;
    expect(heading).toBe("Your membership needs a quick update");
    expect(message).toMatch(/Good news!/);
    expect(message).toMatch(/paid time remaining through July 30, 2026/);
    expect(message).not.toMatch(/previous|active membership on|site access/i);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    const contact = root.querySelector("[data-membership-status-contact]") as unknown as StubEl;
    expect(contact.hidden).toBe(false);
    expect(contact.textContent).toBe("Contact us about my membership");
  });

  it("past legacy annual history uses ended on wording", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "no_plan",
      currentPlanName: null,
      previousPlanName: "Premium",
      activeThroughDate: null,
      legacyExpirationDate: "June 30, 2026",
      legacyLinkState: "linked",
      accountType: "non_paid_account",
      recommendedAction: "purchase",
      customerFacingMessage:
        "You have a Knit it Now account, but we do not currently see an active membership. Your previous Premium annual membership ended on June 30, 2026.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    const message = (root.querySelector("[data-membership-status-message]") as unknown as StubEl)
      .textContent;
    expect(message).toMatch(/ended on June 30, 2026/);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(false);
  });

  it("non-paid account can see membership options when no overlap", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "no_plan",
      currentPlanName: null,
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "not_found",
      accountType: "non_paid_account",
      recommendedAction: "purchase",
      customerFacingMessage:
        "You have a Knit it Now account, but it does not currently include an active Knit it Now membership.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your Knit it Now membership status");
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(false);
    expect(getMembershipStatusCtaMode()).toBe("purchase");
  });

  it("ambiguous state suppresses purchase and shows contact", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "no_plan",
      currentPlanName: null,
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "ambiguous",
      accountType: "non_paid_account",
      recommendedAction: "contact_support",
      customerFacingMessage:
        "We found your account, but we could not safely match all of your previous membership information. Please contact us before purchasing another membership.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(false);
  });

  it("lookup-unavailable suppresses purchase and offers retry + contact", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: false,
      currentStatus: "unknown",
      currentPlanName: null,
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: null,
      legacyLinkState: "lookup_unavailable",
      accountType: "unknown",
      recommendedAction: "wait",
      customerFacingMessage:
        "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(getMembershipStatusCtaMode()).not.toBe("purchase");
  });

  it("does not show blank previous fact when plan name is missing", async () => {
    vi.mocked(isMembershipStatusMemberLoggedIn).mockResolvedValue(true);
    vi.mocked(fetchMembershipStatus).mockResolvedValue({
      ok: true,
      identified: true,
      currentStatus: "no_plan",
      currentPlanName: null,
      previousPlanName: null,
      activeThroughDate: null,
      legacyExpirationDate: "June 30, 2026",
      legacyLinkState: "linked",
      accountType: "non_paid_account",
      recommendedAction: "purchase",
      customerFacingMessage:
        "You have a Knit it Now account, but we do not currently see an active membership. Your previous annual membership ended on June 30, 2026.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    const previousFact = root.querySelector(
      '[data-membership-status-fact="previous"]',
    ) as unknown as StubEl;
    const previousValue = root.querySelector(
      '[data-membership-status-value="previous"]',
    ) as unknown as StubEl;
    expect(previousFact.hidden).toBe(false);
    expect(previousValue.textContent).toBe("Ended June 30, 2026");
    expect(previousValue.textContent).not.toMatch(/^\s*$/);
  });
});
