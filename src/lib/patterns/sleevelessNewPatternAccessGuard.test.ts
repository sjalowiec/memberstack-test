import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canStartNewSleevelessPattern,
  resolveSleevelessNewPatternBlockedCopy,
  showSleevelessNewPatternLockedScreen,
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessNewPatternAccessGuard";
import {
  SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR,
  SLEEVELESS_UPGRADE_STATUS_SELECTOR,
} from "./sleevelessNewPatternUpgradeScreen";
import {
  SLEEVELESS_LIFETIME_OPTION_CTA,
  SLEEVELESS_MEMBERSHIP_OPTION_CTA,
  SLEEVELESS_NEW_PATTERN_UPGRADE_HEADING,
  SLEEVELESS_SAVED_PATTERNS_CTA,
  SLEEVELESS_SAVED_PATTERNS_HEADING,
} from "./sleevelessNewPatternUpgrade";
import type { SleevelessUserAccess } from "./sleevelessPatternSystemAccess";
import { testAccess } from "./patternAccessTestFixtures";

const loggedOut: SleevelessUserAccess = testAccess({
  loggedIn: false,
  hasSystemAccess: false,
  freeClaimed: false,
});
const freeUnclaimed: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  activePlanIds: [],
  freeClaimed: false,
});
const freeClaimed: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
  activePlanIds: [],
  freeClaimed: true,
  freeClaimedPatternId: "pat_1",
});
const member: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_member",
  hasSystemAccess: true,
  freeClaimed: false,
});
const memberAfterClaim: SleevelessUserAccess = testAccess({ ...member, freeClaimed: true });

describe("canStartNewSleevelessPattern", () => {
  it("blocks a free user who already claimed their one-time free pattern", () => {
    expect(canStartNewSleevelessPattern(freeClaimed)).toBe(false);
  });

  it("allows a free user their first (unclaimed) pattern", () => {
    expect(canStartNewSleevelessPattern(freeUnclaimed)).toBe(true);
  });

  it("allows members / system owners (even after claiming)", () => {
    expect(canStartNewSleevelessPattern(member)).toBe(true);
    expect(canStartNewSleevelessPattern(memberAfterClaim)).toBe(true);
  });

  it("blocks logged-out visitors", () => {
    expect(canStartNewSleevelessPattern(loggedOut)).toBe(false);
  });
});

describe("resolveSleevelessNewPatternBlockedCopy", () => {
  it("uses the already-claimed / upgrade copy for a logged-in free user", () => {
    expect(resolveSleevelessNewPatternBlockedCopy(freeClaimed)).toBe(
      SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
    );
    expect(SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY).toMatch(/already created your free/i);
  });

  it("uses the log-in copy for logged-out visitors", () => {
    expect(resolveSleevelessNewPatternBlockedCopy(loggedOut)).toBe(
      SLEEVELESS_SAVE_LOGGED_OUT_COPY,
    );
  });
});

type FakeEl = {
  tagName: string;
  className: string;
  href?: string;
  textContent: string;
  hidden: boolean;
  attrs: Record<string, string>;
  children: FakeEl[];
  firstChild: FakeEl | null;
  parentElement: FakeEl | null;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  appendChild: (child: FakeEl) => FakeEl;
  insertBefore: (child: FakeEl, ref: FakeEl | null) => FakeEl;
  replaceChildren: () => void;
  querySelector: (sel: string) => FakeEl | null;
  querySelectorAll?: (sel: string) => FakeEl[];
  addEventListener?: () => void;
};

function fakeEl(tagName = "div"): FakeEl {
  const el: FakeEl = {
    tagName,
    className: "",
    textContent: "",
    hidden: false,
    attrs: {},
    children: [],
    firstChild: null,
    parentElement: null,
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
      this.firstChild = this.children[0] ?? null;
      return child;
    },
    insertBefore(child) {
      this.children.unshift(child);
      child.parentElement = this;
      this.firstChild = this.children[0] ?? null;
      return child;
    },
    replaceChildren() {
      this.children = [];
      this.firstChild = null;
    },
    querySelector(sel: string) {
      if (sel === SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR) {
        return this.children.find((c) => c.attrs["data-sleeveless-new-pattern-locked"]) ?? null;
      }
      const walk = (node: FakeEl): FakeEl | null => {
        if (sel === SLEEVELESS_UPGRADE_STATUS_SELECTOR && node.attrs["data-sleeveless-upgrade-status"] !== undefined) {
          return node;
        }
        for (const child of node.children) {
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
    querySelectorAll(sel: string) {
      const matches: FakeEl[] = [];
      const walk = (node: FakeEl): void => {
        if (sel === "[data-sleeveless-lifetime-checkout]" && node.attrs["data-sleeveless-lifetime-checkout"] !== undefined) {
          matches.push(node);
        }
        node.children.forEach(walk);
      };
      walk(this);
      return matches;
    },
    addEventListener: () => {},
    disabled: false,
  };
  return el;
}

function buildExpressDomStub() {
  const builder = fakeEl();
  builder.setAttribute("data-express-builder", "");
  const nav = fakeEl();
  const sgNav = fakeEl();
  const editingBar = fakeEl();
  const subtext = fakeEl();
  const panel = fakeEl();
  const editingBannerHost = fakeEl();
  builder.parentElement = panel;

  const map: Record<string, FakeEl> = {
    "[data-express-builder]": builder,
    ".express-builder-nav-row": nav,
    ".sg-builder-nav-row": sgNav,
    "[data-express-editing-bar]": editingBar,
    ".pattern-subtext": subtext,
    "[data-cb-editing-banner-host]": editingBannerHost,
    ".express-panel": panel,
  };

  const root = {
    querySelector: (sel: string) => map[sel] ?? null,
  };

  return { root, builder, nav, sgNav, editingBar, subtext, editingBannerHost, panel };
}

function findDescendant(node: FakeEl, predicate: (el: FakeEl) => boolean): FakeEl | null {
  if (predicate(node)) return node;
  for (const child of node.children) {
    const found = findDescendant(child, predicate);
    if (found) return found;
  }
  return null;
}

describe("showSleevelessNewPatternLockedScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows membership and lifetime options for a claimed free Sleeveless user", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const dom = buildExpressDomStub();

    const notice = showSleevelessNewPatternLockedScreen(
      dom.root as unknown as ParentNode,
      SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
      "sleeveless",
      freeClaimed,
    );

    expect(dom.builder.hidden).toBe(true);
    expect(notice).not.toBeNull();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_NEW_PATTERN_UPGRADE_HEADING)).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_MEMBERSHIP_OPTION_CTA)).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_LIFETIME_OPTION_CTA)).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_SAVED_PATTERNS_HEADING)).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_SAVED_PATTERNS_CTA)).toBeTruthy();
  });

  it("keeps saved-pattern access available on the gate", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const dom = buildExpressDomStub();

    const notice = showSleevelessNewPatternLockedScreen(
      dom.root as unknown as ParentNode,
      SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
      "sleeveless",
      freeClaimed,
    );

    const savedLink = findDescendant(
      notice!,
      (el) => el.textContent === SLEEVELESS_SAVED_PATTERNS_CTA,
    );
    expect(savedLink?.href).toBe("/account#my-patterns");
    expect(savedLink?.className).toContain("saved-patterns-link");
    expect(savedLink?.className).not.toContain("kbm-btn");
  });

  it("shows membership and lifetime options for a claimed free Drop Shoulder user", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const dom = buildExpressDomStub();

    const dropShoulderClaimed = testAccess({
      loggedIn: true,
      hasSystemAccess: false,
      activePlanIds: [],
      freeClaimed: true,
      claimedSystem: "drop-shoulder",
    });

    const notice = showSleevelessNewPatternLockedScreen(
      dom.root as unknown as ParentNode,
      undefined,
      "drop-shoulder",
      dropShoulderClaimed,
    );

    expect(notice).not.toBeNull();
    expect(
      findDescendant(notice!, (el) => el.textContent === "Create another Drop Shoulder Sweater"),
    ).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === "Buy the Drop Shoulder Builder")).toBeTruthy();
    expect(findDescendant(notice!, (el) => el.textContent === SLEEVELESS_SAVED_PATTERNS_HEADING)).toBeTruthy();
  });

  it("is a safe no-op when the Express builder is absent (e.g. workspace page)", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const root = { querySelector: () => null };
    expect(
      showSleevelessNewPatternLockedScreen(root as unknown as ParentNode),
    ).toBeNull();
  });
});
