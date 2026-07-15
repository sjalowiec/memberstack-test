import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canStartNewSleevelessPattern,
  resolveSleevelessNewPatternBlockedCopy,
  showSleevelessNewPatternLockedScreen,
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessNewPatternAccessGuard";
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
  freeClaimed: false,
});
const freeClaimed: SleevelessUserAccess = testAccess({
  loggedIn: true,
  memberId: "ms_free",
  hasSystemAccess: false,
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

// --- Locked-screen DOM (Node-safe stub: the suite runs without jsdom) -------------------------

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
    querySelector() {
      return null;
    },
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
  // Saved-pattern editing wrapper host (Editing saved pattern / Save Changes / Save a Copy / X).
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

describe("showSleevelessNewPatternLockedScreen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides the setup wizard and shows the locked / upgrade message in its place", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const dom = buildExpressDomStub();

    const notice = showSleevelessNewPatternLockedScreen(
      dom.root as unknown as ParentNode,
      SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
    );

    // No setup questions / title / notes are reachable: every new-pattern control is hidden.
    expect(dom.builder.hidden).toBe(true);
    expect(dom.nav.hidden).toBe(true);
    expect(dom.sgNav.hidden).toBe(true);
    expect(dom.editingBar.hidden).toBe(true);
    expect(dom.subtext.hidden).toBe(true);

    // The saved-pattern editing wrapper (Editing saved pattern / Save Changes / Save a Copy / X)
    // must not frame the unlock gate for a claimed free user.
    expect(dom.editingBannerHost.hidden).toBe(true);

    // The locked screen is mounted and visible with the existing upgrade copy.
    expect(notice).not.toBeNull();
    expect(notice!.hidden).toBe(false);
    expect(dom.panel.children[0]).toBe(notice);
    const body = notice!.children.find((c) => c.className.includes("__body"));
    expect(body?.textContent).toBe(SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY);

    // The "Open your saved patterns" control opens the in-page library drawer.
    const actions = notice!.children.find((c) => c.className.includes("__actions"));
    const openSavedBtn = actions?.children.find(
      (c) => c.textContent === "Open your saved patterns",
    );
    expect(openSavedBtn).toBeTruthy();
    expect(openSavedBtn?.tagName).toBe("button");
    expect(openSavedBtn?.getAttribute("data-pattern-workspace-library-trigger")).toBe("");
    expect(openSavedBtn?.getAttribute("aria-controls")).toBe(
      "pattern-workspace-library-drawer-panel",
    );
  });

  it("is a safe no-op when the Express builder is absent (e.g. workspace page)", () => {
    vi.stubGlobal("document", { createElement: (tag: string) => fakeEl(tag) });
    const root = { querySelector: () => null };
    expect(
      showSleevelessNewPatternLockedScreen(root as unknown as ParentNode),
    ).toBeNull();
  });
});
