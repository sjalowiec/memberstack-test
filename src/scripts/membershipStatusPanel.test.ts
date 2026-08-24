import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIPS, MEMBERSHIP_PRICE_IDS } from "../config/memberships";
import {
  formatMemberstackUnixDate,
  resolveAccountMembershipPanelView,
} from "../lib/membership/accountMembershipPanel";
import { accountParityFacts } from "../lib/membership/membershipStatusPageView";
import {
  clearMembershipStatusModalAutoOpened,
  membershipStatusModalSessionKey,
} from "../lib/membership/membershipStatusSession";

vi.mock("../lib/membership/membershipStatusClient", () => ({
  fetchMembershipStatus: vi.fn(),
  isMembershipStatusMemberLoggedIn: vi.fn(),
  MembershipStatusAuthError: class MembershipStatusAuthError extends Error {
    constructor(message: string) {
      super(message);
    }
    name = "MembershipStatusAuthError";
  },
}));

import { fetchMembershipStatus } from "../lib/membership/membershipStatusClient";
import {
  __resetMembershipStatusCtaForTests,
  getMembershipStatusCtaMode,
  shouldBlockPurchaseForStatusMode,
} from "../lib/membership/membershipStatusCta";
import {
  __resetMembershipStatusPanelForTests,
  closeMembershipStatusModal,
  initMembershipStatusPanel,
  loadAndRenderMembershipStatusPanel,
  openMembershipStatusModal,
} from "./membershipStatusPanel";

type StubEl = {
  hidden: boolean;
  disabled: boolean;
  open?: boolean;
  textContent: string;
  offsetWidth: number;
  attrs: Map<string, string>;
  listeners: Map<string, Set<(event: unknown) => void>>;
  classList: { add: (name: string) => void; remove: (name: string) => void };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  matches: (selector: string) => boolean;
  querySelector: (selector: string) => StubEl | null;
  querySelectorAll: (selector: string) => StubEl[];
  addEventListener: (type: string, fn: (event: unknown) => void) => void;
  focus: (opts?: { preventScroll?: boolean }) => void;
  showModal?: () => void;
  close?: () => void;
  contains?: (node: StubEl) => boolean;
};

function el(matchers: string[], initial?: Partial<StubEl>): StubEl {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const node: StubEl = {
    hidden: initial?.hidden ?? false,
    disabled: false,
    open: initial?.open ?? false,
    textContent: initial?.textContent ?? "",
    offsetWidth: 1,
    attrs,
    listeners,
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
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    focus: vi.fn(),
    contains: () => true,
  };

  if (matchers.includes("[data-membership-status-modal]")) {
    node.showModal = () => {
      node.open = true;
    };
    node.close = () => {
      node.open = false;
      listeners.get("close")?.forEach((fn) => fn({}));
    };
  }

  return node;
}

function makeRoot(nodes: StubEl[]): ParentNode & { nodes: StubEl[] } {
  const list = (selector: string) => nodes.filter((node) => node.matches(selector));
  for (const node of nodes) {
    node.querySelector = (selector: string) => {
      if (node.matches("[data-membership-status-modal]")) {
        return list(selector)[0] ?? null;
      }
      if (node.matches("[data-membership-status-modal-facts]") || node.matches("[data-membership-status-facts]")) {
        return list(selector).find((n) => !n.hidden) ?? null;
      }
      return list(selector)[0] ?? null;
    };
    node.querySelectorAll = (selector: string) => list(selector);
  }
  return {
    nodes,
    querySelector: (selector: string) => list(selector)[0] ?? null,
    querySelectorAll: (selector: string) => list(selector) as unknown as NodeListOf<Element>,
  } as unknown as ParentNode & { nodes: StubEl[] };
}

function mountPanel() {
  const dialog = el(["[data-membership-status-modal]"]);
  const closeBtn = el(["[data-membership-status-modal-close]"]);
  const whatsIncludedOpen = el(["[data-membership-whats-included-open]"]);
  whatsIncludedOpen.setAttribute("data-membership-whats-included-mode", "anchor");
  const whatsIncludedModal = el(["[data-membership-whats-included-modal]"]);
  whatsIncludedModal.showModal = () => {
    whatsIncludedModal.open = true;
  };
  whatsIncludedModal.close = () => {
    whatsIncludedModal.open = false;
  };
  return makeRoot([
    el(["[data-membership-status-open]"], { hidden: true }),
    el(["[data-membership-status-panel]"], { hidden: true }),
    el(["[data-membership-status-loading]"], { hidden: true }),
    el(["[data-membership-status-body]"], { hidden: true }),
    el(["[data-membership-status-heading]"]),
    el(["[data-membership-status-message]"]),
    el(["[data-membership-status-facts]"]),
    el(['[data-membership-status-fact="plan"]'], { hidden: true }),
    el(['[data-membership-status-value="plan"]']),
    el(['[data-membership-status-fact="status"]'], { hidden: true }),
    el(['[data-membership-status-value="status"]']),
    el(['[data-membership-status-fact="billing"]'], { hidden: true }),
    el(['[data-membership-status-value="billing"]']),
    el(['[data-membership-status-fact="renews"]'], { hidden: true }),
    el(['[data-membership-status-value="renews"]']),
    el(['[data-membership-status-fact="through"]'], { hidden: true }),
    el(['[data-membership-status-value="through"]']),
    el(['[data-membership-status-fact="previous"]'], { hidden: true }),
    el(['[data-membership-status-value="previous"]']),
    el(["[data-membership-status-manage]"], { hidden: true }),
    Object.assign(el(["[data-membership-status-renew]"], { hidden: true }), {
      textContent: "Renew My Membership",
    }),
    Object.assign(el(["[data-membership-status-contact]"], { hidden: true }), {
      textContent: "Contact us",
    }),
    el(["[data-membership-status-retry]"], { hidden: true }),
    dialog,
    closeBtn,
    el(["[data-membership-status-modal-heading]"]),
    el(["[data-membership-status-modal-message]"]),
    el(["[data-membership-status-modal-facts]"]),
    el(['[data-membership-status-modal-fact="plan"]'], { hidden: true }),
    el(['[data-membership-status-modal-value="plan"]']),
    el(['[data-membership-status-modal-fact="status"]'], { hidden: true }),
    el(['[data-membership-status-modal-value="status"]']),
    el(['[data-membership-status-modal-fact="billing"]'], { hidden: true }),
    el(['[data-membership-status-modal-value="billing"]']),
    el(['[data-membership-status-modal-fact="renews"]'], { hidden: true }),
    el(['[data-membership-status-modal-value="renews"]']),
    el(['[data-membership-status-modal-fact="through"]'], { hidden: true }),
    el(['[data-membership-status-modal-value="through"]']),
    el(["[data-membership-status-modal-manage]"]),
    el(["[data-membership-thank-you]"], { hidden: true }),
    el(["[data-membership-sales-content]"], { hidden: false }),
    whatsIncludedOpen,
    whatsIncludedModal,
    (() => {
      const monthly = el(["[data-join-checkout]"]);
      monthly.setAttribute("data-join-checkout", "monthly");
      return monthly;
    })(),
    (() => {
      const annual = el(["[data-join-checkout]"]);
      annual.setAttribute("data-join-checkout", "annual");
      return annual;
    })(),
    el(["[data-membership-sales-cta]"]),
    Object.assign(el(["#membership-hero-heading"]), {
      textContent: "Knit it Now Membership",
    }),
  ]);
}

const NEXT_BILLING = Math.floor(Date.UTC(2026, 7, 22, 12, 0, 0) / 1000);

function paidPayload(options?: {
  id?: string;
  cancelAtDate?: number | null;
  firstName?: string;
}) {
  const cancelAtDate = options?.cancelAtDate ?? null;
  return {
    data: {
      id: options?.id ?? "mem_sb_active",
      customFields: options?.firstName
        ? { "first-name": options.firstName }
        : { "first-name": "Sue" },
      planConnections: [
        {
          planId: MEMBERSHIPS.membership.memberstackPlanId,
          status: "ACTIVE",
          active: true,
          payment: {
            priceId: MEMBERSHIP_PRICE_IDS.monthly,
            nextBillingDate: cancelAtDate ?? NEXT_BILLING,
            cancelAtDate,
          },
        },
      ],
    },
  };
}

function memorySessionStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

function installMemberstack(payload: unknown | null, session = memorySessionStorage()) {
  vi.stubGlobal("window", {
    ...globalThis,
    sessionStorage: session,
    addEventListener: vi.fn(),
    $memberstackDom: {
      onReady: Promise.resolve(),
      getAppAndMember: vi.fn(async () => payload),
      getCurrentMember: vi.fn(async () => payload),
    },
  });
  vi.stubGlobal("sessionStorage", session);
  vi.stubGlobal("document", {
    ...globalThis.document,
    activeElement: null,
    contains: () => true,
  });
  return session;
}

let root: ReturnType<typeof mountPanel>;

beforeEach(() => {
  __resetMembershipStatusCtaForTests();
  __resetMembershipStatusPanelForTests();
  root = mountPanel();
});

afterEach(() => {
  vi.mocked(fetchMembershipStatus).mockReset();
  vi.unstubAllGlobals();
  __resetMembershipStatusCtaForTests();
  __resetMembershipStatusPanelForTests();
});

describe("membership status panel page behavior", () => {
  it("logged-out visitor sees the normal sales page with no status UI", async () => {
    installMemberstack({ data: null });
    await loadAndRenderMembershipStatusPanel(root);
    const panel = root.querySelector("[data-membership-status-panel]") as unknown as StubEl;
    expect(panel.hidden).toBe(true);
    expect(fetchMembershipStatus).not.toHaveBeenCalled();
    expect(getMembershipStatusCtaMode()).toBe("hidden");
    expect(shouldBlockPurchaseForStatusMode()).toBe(false);
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect((root.querySelector("[data-membership-thank-you]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (
        root.querySelector("[data-membership-whats-included-open]") as unknown as StubEl
      ).getAttribute("data-membership-whats-included-mode"),
    ).toBe("anchor");
    expect(
      (root.querySelector("#membership-hero-heading") as unknown as StubEl).textContent,
    ).toBe("Knit it Now Membership");
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).textContent,
    ).toBe("Choose a membership");
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).getAttribute("href"),
    ).toBe("#pricing");
    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    for (const btn of root.querySelectorAll("[data-join-checkout]") as unknown as StubEl[]) {
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute("data-membership-status-blocked")).toBeNull();
    }
  });

  it("logged-out visitor does not see loading, warning, or account-status copy", async () => {
    installMemberstack({ data: null });
    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector("[data-membership-status-loading]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect((root.querySelector("[data-membership-status-body]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).not.toMatch(/membership status|could not confirm/i);
    expect(
      (root.querySelector("[data-membership-status-message]") as unknown as StubEl).textContent,
    ).not.toMatch(/Knit it Now account|could not confirm/i);
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).textContent,
    ).not.toBe("Checking membership...");
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).textContent,
    ).not.toBe("Contact us");
  });

  it("Memberstack unavailable for anonymous visitors keeps the sales page (not cannot-confirm)", async () => {
    installMemberstack(null);
    await loadAndRenderMembershipStatusPanel(root);
    expect(fetchMembershipStatus).not.toHaveBeenCalled();
    expect((root.querySelector("[data-membership-status-panel]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(getMembershipStatusCtaMode()).toBe("hidden");
    expect(shouldBlockPurchaseForStatusMode()).toBe(false);
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).not.toBe("We could not confirm your membership");
  });

  it("active member auto-opens modal once per session and hides inline panel", async () => {
    const session = installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);

    expect(fetchMembershipStatus).not.toHaveBeenCalled();
    expect((root.querySelector("[data-membership-status-panel]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-thank-you]") as unknown as StubEl).hidden).toBe(
      false,
    );
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (
        root.querySelector("[data-membership-whats-included-open]") as unknown as StubEl
      ).getAttribute("data-membership-whats-included-mode"),
    ).toBe("modal");
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      true,
    );
    expect(
      session.getItem(membershipStatusModalSessionKey("mem_sb_active")),
    ).toBe("1");
    expect(
      (root.querySelector("#membership-hero-heading") as unknown as StubEl).textContent,
    ).toBe("Welcome back, Sue!");
    expect(
      (root.querySelector("[data-membership-status-modal-heading]") as unknown as StubEl)
        .textContent,
    ).toBe("Your membership is active");
    expect(
      (root.querySelector('[data-membership-status-modal-value="plan"]') as unknown as StubEl)
        .textContent,
    ).toBe("Knit it Now Membership");
    expect(
      (root.querySelector('[data-membership-status-modal-value="status"]') as unknown as StubEl)
        .textContent,
    ).toBe("Active");
    expect(
      (root.querySelector('[data-membership-status-modal-value="billing"]') as unknown as StubEl)
        .textContent,
    ).toBe("Monthly");
    expect(
      (root.querySelector('[data-membership-status-modal-value="renews"]') as unknown as StubEl)
        .textContent,
    ).toBe(formatMemberstackUnixDate(NEXT_BILLING));
    expect(
      (root.querySelector('[data-membership-status-modal-fact="through"]') as unknown as StubEl)
        .hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).textContent,
    ).toBe("Manage Membership");
    expect(getMembershipStatusCtaMode()).toBe("manage");
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
  });

  it("second page load in same session does not auto-open", async () => {
    const session = installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      true,
    );

    closeMembershipStatusModal(root);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );

    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect(session.getItem(membershipStatusModalSessionKey("mem_sb_active"))).toBe("1");
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      false,
    );
  });

  it("manual Membership status trigger reopens modal", async () => {
    installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);
    closeMembershipStatusModal(root);

    const trigger = root.querySelector("[data-membership-status-open]") as unknown as StubEl;
    openMembershipStatusModal(root, { returnFocus: trigger as unknown as HTMLElement });
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      true,
    );
  });

  it("canceling member auto-opens modal once with active-through facts", async () => {
    const cancelAt = Math.floor(Date.UTC(2026, 7, 18) / 1000);
    const session = installMemberstack(
      paidPayload({ id: "mem_sb_canceling", cancelAtDate: cancelAt }),
    );
    await loadAndRenderMembershipStatusPanel(root);

    expect((root.querySelector("[data-membership-status-panel]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect((root.querySelector("[data-membership-thank-you]") as unknown as StubEl).hidden).toBe(
      false,
    );
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (
        root.querySelector("[data-membership-whats-included-open]") as unknown as StubEl
      ).getAttribute("data-membership-whats-included-mode"),
    ).toBe("modal");
    expect(
      (root.querySelector("#membership-hero-heading") as unknown as StubEl).textContent,
    ).toBe("Welcome back, Sue!");
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-status-modal-heading]") as unknown as StubEl)
        .textContent,
    ).toMatch(/^Your membership is active through /);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="renews"]') as unknown as StubEl)
        .hidden,
    ).toBe(true);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="through"]') as unknown as StubEl)
        .hidden,
    ).toBe(false);
    expect(
      session.getItem(membershipStatusModalSessionKey("mem_sb_canceling")),
    ).toBe("1");

    closeMembershipStatusModal(root);
    await loadAndRenderMembershipStatusPanel(root);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
  });

  it("modal displays the same plan/status/billing/date as Account", async () => {
    const payload = paidPayload();
    installMemberstack(payload);
    await loadAndRenderMembershipStatusPanel(root);
    const account = resolveAccountMembershipPanelView(payload);
    const parity = accountParityFacts(account, payload);

    expect(
      (root.querySelector('[data-membership-status-modal-value="plan"]') as unknown as StubEl)
        .textContent,
    ).toBe(parity.plan);
    expect(
      (root.querySelector('[data-membership-status-modal-value="status"]') as unknown as StubEl)
        .textContent,
    ).toBe(parity.status);
    expect(
      (root.querySelector('[data-membership-status-modal-value="billing"]') as unknown as StubEl)
        .textContent,
    ).toBe(parity.billing);
    expect(
      (root.querySelector('[data-membership-status-modal-value="renews"]') as unknown as StubEl)
        .textContent,
    ).toBe(parity.renewsOrThrough);
  });

  it("Manage Membership is the only action for active/canceling", async () => {
    installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector("[data-membership-status-modal-manage]") as unknown as StubEl),
    ).toBeTruthy();
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(false);
  });

  it("future legacy remains inline and offers Renew My Membership to /join", async () => {
    installMemberstack({ data: { id: "mem_free", planConnections: [] } });
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
      recommendedAction: "renew_now",
      customerFacingMessage:
        "Your Premium annual membership is paid through July 30, 2026.\n\nYou can renew now. Your new membership and billing period will begin today.",
    });

    await loadAndRenderMembershipStatusPanel(root);
    expect(fetchMembershipStatus).toHaveBeenCalledTimes(1);
    expect((root.querySelector("[data-membership-status-panel]") as unknown as StubEl).hidden).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-thank-you]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("You still have membership time remaining");
    expect(
      (root.querySelector("[data-membership-status-message]") as unknown as StubEl).textContent,
    ).toMatch(/billing period will begin today/);
    expect(getMembershipStatusCtaMode()).toBe("renew_now");
    expect(
      (root.querySelector("[data-membership-status-renew]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-renew]") as unknown as StubEl).textContent,
    ).toBe("Renew My Membership");
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).textContent,
    ).toBe("Renew My Membership");
    expect(
      (root.querySelector("[data-membership-sales-cta]") as unknown as StubEl).getAttribute("href"),
    ).toBe("/join");
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
  });

  it("ambiguous legacy remains contact-support and blocks purchase", async () => {
    installMemberstack({ data: { id: "mem_ambig", planConnections: [] } });
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
    expect(getMembershipStatusCtaMode()).toBe("contact_support");
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(false);
  });

  it("authenticated lookup failure remains inline and does not auto-open", async () => {
    installMemberstack({ data: { id: "mem_free", planConnections: [] } });
    vi.mocked(fetchMembershipStatus).mockRejectedValue(new Error("network down"));
    await loadAndRenderMembershipStatusPanel(root);
    expect(fetchMembershipStatus).toHaveBeenCalledTimes(1);
    expect((root.querySelector("[data-membership-status-panel]") as unknown as StubEl).hidden).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("We could not confirm your membership");
    expect(getMembershipStatusCtaMode()).toBe("wait");
    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(false);
  });

  it("free account does not auto-open and shows compact inline message", async () => {
    installMemberstack({ data: { id: "mem_free", planConnections: [] } });
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
    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect((root.querySelector("[data-membership-thank-you]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-sales-content]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("#membership-hero-heading") as unknown as StubEl).textContent,
    ).toBe("Knit it Now Membership");
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your Knit it Now membership status");
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-message]") as unknown as StubEl).textContent,
    ).toBe(
      "You have a Knit it Now account, but it does not currently include an active Knit it Now membership.",
    );
    expect(getMembershipStatusCtaMode()).toBe("purchase");
    expect(shouldBlockPurchaseForStatusMode()).toBe(false);
  });

  it("brand-new logged-in account with no paid plan is purchase mode", async () => {
    installMemberstack({ data: { id: "mem_sb_annual_test", planConnections: [] } });
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

    expect(fetchMembershipStatus).toHaveBeenCalledTimes(1);
    expect(getMembershipStatusCtaMode()).toBe("purchase");
    expect(shouldBlockPurchaseForStatusMode()).toBe(false);

    const salesCta = root.querySelector("[data-membership-sales-cta]") as unknown as StubEl;
    expect(salesCta.textContent).toBe("Choose a membership");
    expect(salesCta.getAttribute("href")).toBe("#pricing");

    expect((root.querySelector("[data-membership-status-modal]") as unknown as StubEl).open).toBe(
      false,
    );
    expect((root.querySelector("[data-membership-status-open]") as unknown as StubEl).hidden).toBe(
      true,
    );
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("Your Knit it Now membership status");
    expect(
      (root.querySelector("[data-membership-status-message]") as unknown as StubEl).textContent,
    ).toMatch(/does not currently include an active Knit it Now membership/);

    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(true);

    for (const key of ["plan", "status", "billing", "renews", "through", "previous"]) {
      expect(
        (root.querySelector(`[data-membership-status-fact="${key}"]`) as unknown as StubEl)
          .hidden,
      ).toBe(true);
      expect(
        (root.querySelector(`[data-membership-status-value="${key}"]`) as unknown as StubEl)
          .textContent,
      ).toBe("");
    }

    const checkoutButtons = root.querySelectorAll(
      "[data-join-checkout]",
    ) as unknown as StubEl[];
    expect(checkoutButtons).toHaveLength(2);
    for (const btn of checkoutButtons) {
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute("data-membership-status-blocked")).toBeNull();
    }
  });

  it("no paid plan does not use cannot-confirm when server returns purchase", async () => {
    installMemberstack({ data: { id: "mem_free", planConnections: [] } });
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
    ).not.toBe("We could not confirm your membership");
    expect(getMembershipStatusCtaMode()).toBe("purchase");
  });

  it("genuine server wait still shows cannot-confirm for free client", async () => {
    installMemberstack({ data: { id: "mem_free", planConnections: [] } });
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
    expect(
      (root.querySelector("[data-membership-status-heading]") as unknown as StubEl).textContent,
    ).toBe("We could not confirm your membership");
    expect(getMembershipStatusCtaMode()).toBe("wait");
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect(
      (root.querySelector("[data-membership-status-contact]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-retry]") as unknown as StubEl).hidden,
    ).toBe(false);
    expect(
      (root.querySelector("[data-membership-status-manage]") as unknown as StubEl).hidden,
    ).toBe(true);
  });

  it("active modal shows only Plan, Status, Billing, Renews", async () => {
    installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="plan"]') as unknown as StubEl)
        .hidden,
    ).toBe(false);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="status"]') as unknown as StubEl)
        .hidden,
    ).toBe(false);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="billing"]') as unknown as StubEl)
        .hidden,
    ).toBe(false);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="renews"]') as unknown as StubEl)
        .hidden,
    ).toBe(false);
    expect(
      (root.querySelector('[data-membership-status-modal-fact="through"]') as unknown as StubEl)
        .hidden,
    ).toBe(true);
    expect(
      (root.querySelector('[data-membership-status-modal-value="through"]') as unknown as StubEl)
        .textContent,
    ).toBe("");
  });

  it("focus moves into modal on open and Escape closes with focus return", async () => {
    installMemberstack(paidPayload());
    clearMembershipStatusModalAutoOpened("mem_sb_active");
    // Force a clean session for this focus case.
    const session = memorySessionStorage();
    vi.stubGlobal("sessionStorage", session);
    (window as unknown as { sessionStorage: typeof session }).sessionStorage = session;

    root = mountPanel();
    const trigger = root.querySelector("[data-membership-status-open]") as unknown as StubEl;
    const dialog = root.querySelector("[data-membership-status-modal]") as unknown as StubEl;
    const closeBtn = root.querySelector(
      "[data-membership-status-modal-close]",
    ) as unknown as StubEl;

    initMembershipStatusPanel(root);
    await vi.waitFor(() => {
      expect(dialog.open).toBe(true);
    });
    expect(closeBtn.focus).toHaveBeenCalled();

    closeMembershipStatusModal(root);
    expect(dialog.open).toBe(false);

    openMembershipStatusModal(root, { returnFocus: trigger as unknown as HTMLElement });
    expect(dialog.open).toBe(true);

    const cancelHandlers = dialog.listeners.get("cancel");
    expect(cancelHandlers?.size).toBeGreaterThan(0);
    cancelHandlers?.forEach((fn) =>
      fn({
        preventDefault: vi.fn(),
      }),
    );
    expect(dialog.open).toBe(false);
    expect(trigger.focus).toHaveBeenCalled();
  });

  it("checkout guards still block purchase for manage and contact modes", async () => {
    installMemberstack(paidPayload());
    await loadAndRenderMembershipStatusPanel(root);
    expect(shouldBlockPurchaseForStatusMode()).toBe(true);
    expect((root.querySelector("[data-join-checkout]") as unknown as StubEl).disabled).toBe(true);
  });
});
