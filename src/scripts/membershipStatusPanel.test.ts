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
import { __resetMembershipStatusCtaForTests } from "../lib/membership/membershipStatusCta";
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
  };
  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode & { nodes: StubEl[] } {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
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
    el(["[data-membership-status-contact]"], { hidden: true }),
    el(["[data-membership-status-retry]"], { hidden: true }),
    el(["[data-join-checkout]"]),
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
  });

  it("shows active message for paid members and suppresses purchase", async () => {
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
    const panel = root.querySelector("[data-membership-status-panel]") as unknown as StubEl;
    expect(panel.hidden).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your membership is active");
    expect(
      (root.querySelector("[data-membership-status-message]") as unknown as StubEl).textContent,
    ).toMatch(/do not need to subscribe again/i);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
  });

  it("describes past legacy annual history as previous, not current access", async () => {
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
    expect(message).toMatch(/previous Premium annual membership ended on/i);
    expect(message).not.toMatch(/still have access/i);
    expect(
      (root.querySelector('[data-membership-status-value="previous"]') as unknown as StubEl)
        .textContent,
    ).toMatch(/Premium \(ended June 30, 2026\)/);
  });

  it("future legacy paid-through suppresses purchase CTAs and does not claim access", async () => {
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
        "Our records show that your Premium annual membership was paid through July 30, 2026, but we do not currently see an active membership on your new account. Please contact us before purchasing another membership so we can check your account.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    const message = (root.querySelector("[data-membership-status-message]") as unknown as StubEl)
      .textContent;
    expect(message).toMatch(/paid through July 30, 2026/i);
    expect(message).toMatch(/contact us before purchasing/i);
    expect(message).not.toMatch(/previous/i);
    expect(message).not.toMatch(/you have access|still have access/i);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("We need to check your membership");
    // Do not show a "Previous membership" fact while paid-through is still future.
    expect(
      (root.querySelector('[data-membership-status-fact="previous"]') as unknown as StubEl).hidden,
    ).toBe(true);
  });

  it("suppresses purchase CTAs for ambiguous and unavailable states", async () => {
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
      customerFacingMessage: "Please contact us before purchasing another membership.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);

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
      customerFacingMessage: "We could not confirm your membership status right now.",
    });
    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
  });
});
