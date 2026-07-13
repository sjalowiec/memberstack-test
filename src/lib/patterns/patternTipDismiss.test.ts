import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISMISSABLE_TIP_SELECTOR,
  TIP_WITH_ID_SELECTOR,
  dismissedTipsStorageKey,
  dismissTipId,
  isTipHiddenForPrint,
  loadDismissedTipIds,
  patternTipsControlBoxHtml,
  refreshPatternTipDismiss,
  resetDismissedTips,
  resetPatternTipPrintSyncForTests,
  resolveDismissableTipFromDismissButton,
  syncPatternTipDismissBeforePrint,
  restoreTipId,
  updateTipsResetLinkVisibility,
} from "./patternTipDismiss";
import { stubLocalStorage } from "./test/stubLocalStorage";

// Use a neutral key so dismiss/reset never trigger the sleeveless saved-project sync.
const KEY = "test-show-tips";

/**
 * Node-safe DOM stub (the suite runs without jsdom). Implements only what
 * refreshPatternTipDismiss + updateTipsResetLinkVisibility touch: attribute
 * get/set/remove, classList.contains, querySelector(All), appendChild and a
 * mutable `hidden`. `instanceof HTMLElement` works because the class below is
 * installed as the global HTMLElement.
 */
class FakeClassList {
  private classes: Set<string>;
  constructor(classes: string[]) {
    this.classes = new Set(classes);
  }
  contains(name: string): boolean {
    return this.classes.has(name);
  }
  add(name: string): void {
    this.classes.add(name);
  }
}

function stripLeadingDot(selector: string): string {
  return selector.startsWith(".") ? selector.slice(1) : selector;
}

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  classList: FakeClassList;
  hidden = false;
  type = "";
  textContent = "";
  tagName: string;
  parentElement: FakeElement | null = null;
  private selectorMap: Record<string, FakeElement[]>;
  private _className = "";

  constructor(opts: { classes?: string[]; tagName?: string } = {}) {
    this.classList = new FakeClassList(opts.classes ?? []);
    this.tagName = opts.tagName ?? "DIV";
    this.selectorMap = {};
    if (opts.classes?.length) {
      this._className = opts.classes.join(" ");
    }
  }

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList = new FakeClassList(value.split(/\s+/).filter(Boolean));
  }

  matches(selector: string): boolean {
    if (selector === DISMISSABLE_TIP_SELECTOR) {
      return (
        this.classList.contains("pattern-tip") &&
        this.getAttribute("data-tip-id") !== null &&
        !this.classList.contains("pattern-tip-intro") &&
        !this.classList.contains("pattern-tips-control-box")
      );
    }
    if (selector === TIP_WITH_ID_SELECTOR) {
      return this.classList.contains("pattern-tip") && this.getAttribute("data-tip-id") !== null;
    }
    if (selector === ".pattern-tip[data-tip-dismissed]") {
      return this.classList.contains("pattern-tip") && this.hasAttribute("data-tip-dismissed");
    }
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    return false;
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }

  private collectMatches(selector: string, found: FakeElement[]): void {
    if (this.matches(selector)) found.push(this);
    for (const child of this.children) {
      child.collectMatches(selector, found);
    }
  }

  closest(selector: string): FakeElement | null {
    if (selector === ".pattern-tip" && this.classList.contains("pattern-tip")) {
      return this;
    }
    let node: FakeElement | null = this.parentElement;
    while (node) {
      if (selector === ".pattern-tip" && node.classList.contains("pattern-tip")) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = String(value);
  }
  removeAttribute(name: string): void {
    delete this.attrs[name];
  }
  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  setSelectorResult(selector: string, els: FakeElement[]): void {
    this.selectorMap[selector] = els;
  }
  querySelector(selector: string): FakeElement | null {
    const mapped = this.selectorMap[selector];
    if (mapped && mapped.length) return mapped[0];
    const className = stripLeadingDot(selector);
    for (const child of this.children) {
      if (child.className === className || child.classList.contains(className)) return child;
    }
    return null;
  }
  querySelectorAll(selector: string): FakeElement[] {
    if (selector in this.selectorMap) {
      return this.selectorMap[selector] ?? [];
    }
    const found: FakeElement[] = [];
    for (const child of this.children) {
      child.collectMatches(selector, found);
    }
    return found;
  }

  /** Minimal descendant search for nested-tip regressions. */
  querySelectorDescendant(className: string): FakeElement | null {
    for (const child of this.children) {
      if (child.classList.contains(className)) return child;
      const nested = child.querySelectorDescendant(className);
      if (nested) return nested;
    }
    return null;
  }
}

function buildScope() {
  const tipA = new FakeElement({ classes: ["pattern-tip"] });
  tipA.setAttribute("data-tip-id", "tip-a");
  const tipB = new FakeElement({ classes: ["pattern-tip"] });
  tipB.setAttribute("data-tip-id", "tip-b");
  const restoreBtn = new FakeElement({
    classes: ["pattern-tips-control-btn", "pattern-tips-reset-dismissed"],
    tagName: "BUTTON",
  });
  restoreBtn.hidden = true;

  const scope = new FakeElement({ classes: ["pattern-tips-scope"] });
  scope.appendChild(tipA);
  scope.appendChild(tipB);
  scope.setSelectorResult(DISMISSABLE_TIP_SELECTOR, [tipA, tipB]);
  scope.setSelectorResult(".pattern-tips-reset-dismissed", [restoreBtn]);
  return { scope, tipA, tipB, restoreBtn };
}

describe("patternTipDismiss", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", {
      createElement: (tag: string) => new FakeElement({ tagName: tag.toUpperCase() }),
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    resetPatternTipPrintSyncForTests();
  });

  describe("control box markup", () => {
    it("renders a hidden restore button alongside the show-tips toggle", () => {
      const html = patternTipsControlBoxHtml(true);
      expect(html).toContain('data-testid="link-tips-toggle"');
      expect(html).toContain("pattern-tips-reset-dismissed");
      expect(html).toContain('data-testid="link-tips-restore-dismissed"');
      expect(html).toContain("Restore hidden tips");
      // The restore button must start hidden (revealed only once tips are dismissed).
      expect(html).toMatch(/pattern-tips-reset-dismissed[^>]*hidden/);
    });

    it("renders the restore button regardless of global tips state", () => {
      expect(patternTipsControlBoxHtml(false)).toContain("pattern-tips-reset-dismissed");
      expect(patternTipsControlBoxHtml(true)).toContain("pattern-tips-reset-dismissed");
    });
  });

  describe("dismissing one tip", () => {
    it("persists the dismissed id and applies it to the DOM", () => {
      dismissTipId(KEY, "tip-a");

      expect([...loadDismissedTipIds(KEY)]).toEqual(["tip-a"]);
      expect(localStorage.getItem(dismissedTipsStorageKey(KEY))).toBe(JSON.stringify(["tip-a"]));

      const { scope, tipA, tipB, restoreBtn } = buildScope();
      refreshPatternTipDismiss(scope, KEY);

      expect(tipA.getAttribute("data-tip-dismissed")).toBe("true");
      expect(tipB.getAttribute("data-tip-dismissed")).toBeNull();
      expect(tipA.querySelector(".pattern-tip-dismiss")).not.toBeNull();

      updateTipsResetLinkVisibility(scope, KEY);
      expect(restoreBtn.hidden).toBe(false);
    });

    it("does not inject duplicate dismiss buttons on repeated refresh", () => {
      dismissTipId(KEY, "tip-a");
      const { scope, tipA } = buildScope();
      refreshPatternTipDismiss(scope, KEY);
      refreshPatternTipDismiss(scope, KEY);
      const dismissButtons = tipA.children.filter((c) => c.className === "pattern-tip-dismiss");
      expect(dismissButtons).toHaveLength(1);
    });
  });

  describe("restoring dismissed tips", () => {
    it("clears persisted ids and un-hides every dismissed tip", () => {
      dismissTipId(KEY, "tip-a");
      dismissTipId(KEY, "tip-b");

      const { scope, tipA, tipB, restoreBtn } = buildScope();
      refreshPatternTipDismiss(scope, KEY);
      updateTipsResetLinkVisibility(scope, KEY);
      expect(restoreBtn.hidden).toBe(false);

      resetDismissedTips(KEY);
      expect(loadDismissedTipIds(KEY).size).toBe(0);
      expect(localStorage.getItem(dismissedTipsStorageKey(KEY))).toBeNull();

      refreshPatternTipDismiss(scope, KEY);
      expect(tipA.getAttribute("data-tip-dismissed")).toBeNull();
      expect(tipB.getAttribute("data-tip-dismissed")).toBeNull();

      updateTipsResetLinkVisibility(scope, KEY);
      expect(restoreBtn.hidden).toBe(true);
    });

    it("keeps the restore button hidden when nothing is dismissed", () => {
      const { scope, restoreBtn } = buildScope();
      updateTipsResetLinkVisibility(scope, KEY);
      expect(restoreBtn.hidden).toBe(true);
    });
  });

  describe("global hide/show vs individually dismissed tips", () => {
    it("toggling global tips on/off does not change which tips are dismissed", () => {
      dismissTipId(KEY, "tip-a");

      // Simulate the global toggle writing the visibility flag.
      localStorage.setItem(KEY, "false");
      localStorage.setItem(KEY, "true");

      expect([...loadDismissedTipIds(KEY)]).toEqual(["tip-a"]);
    });

    it("restoring dismissed tips does not force global tips on", () => {
      // Global tips are currently hidden.
      localStorage.setItem(KEY, "false");
      dismissTipId(KEY, "tip-a");

      resetDismissedTips(KEY);

      // Restore cleared the dismissals but left the global flag untouched.
      expect(loadDismissedTipIds(KEY).size).toBe(0);
      expect(localStorage.getItem(KEY)).toBe("false");
    });

    it("a tip dismissed while global tips are hidden stays dismissed when they are shown again", () => {
      localStorage.setItem(KEY, "false");
      dismissTipId(KEY, "tip-a");
      localStorage.setItem(KEY, "true");

      const { scope, tipA, tipB } = buildScope();
      refreshPatternTipDismiss(scope, KEY);

      // data-tip-dismissed is what the CSS uses to keep it hidden even when global tips are on.
      expect(tipA.getAttribute("data-tip-dismissed")).toBe("true");
      expect(tipB.getAttribute("data-tip-dismissed")).toBeNull();
    });
  });

  describe("nested tip wrappers", () => {
    it("uses the direct parent for dismiss, not an outer nested tip", () => {
      const outer = new FakeElement({ classes: ["pattern-tip"] });
      outer.setAttribute("data-tip-id", "drop-shoulder-shoulder-bind-off-video");
      const inner = new FakeElement({ classes: ["pattern-tip"] });
      inner.setAttribute("data-tip-id", "sleeveless-piece-markers-front");
      const dismiss = new FakeElement({ classes: ["pattern-tip-dismiss"], tagName: "BUTTON" });
      inner.appendChild(dismiss);
      outer.appendChild(inner);

      expect(resolveDismissableTipFromDismissButton(dismiss)).toBe(inner);
      expect(resolveDismissableTipFromDismissButton(dismiss)?.getAttribute("data-tip-id")).toBe(
        "sleeveless-piece-markers-front",
      );
    });

    it("does not treat a nested tip dismiss button as belonging to the outer bind off tip", () => {
      const outer = new FakeElement({ classes: ["pattern-tip"] });
      outer.setAttribute("data-tip-id", "drop-shoulder-shoulder-bind-off-video");
      const inner = new FakeElement({ classes: ["pattern-tip"] });
      inner.setAttribute("data-tip-id", "sleeveless-piece-markers-front");
      const dismiss = new FakeElement({ classes: ["pattern-tip-dismiss"], tagName: "BUTTON" });
      inner.appendChild(dismiss);
      outer.appendChild(inner);

      expect(resolveDismissableTipFromDismissButton(dismiss)?.getAttribute("data-tip-id")).not.toBe(
        "drop-shoulder-shoulder-bind-off-video",
      );
    });

    it("injects a dismiss button on the outer tip even when a nested tip already has one", () => {
      const outer = new FakeElement({ classes: ["pattern-tip"] });
      outer.setAttribute("data-tip-id", "drop-shoulder-shoulder-bind-off-video");
      const inner = new FakeElement({ classes: ["pattern-tip"] });
      inner.setAttribute("data-tip-id", "sleeveless-piece-markers-front");
      const innerDismiss = new FakeElement({ classes: ["pattern-tip-dismiss"], tagName: "BUTTON" });
      inner.appendChild(innerDismiss);
      outer.appendChild(inner);

      const scope = new FakeElement({ classes: ["pattern-tips-scope"] });
      scope.appendChild(outer);
      scope.setSelectorResult(DISMISSABLE_TIP_SELECTOR, [outer, inner]);

      refreshPatternTipDismiss(scope, KEY);

      const outerDismissButtons = outer.children.filter((c) => c.className === "pattern-tip-dismiss");
      expect(outerDismissButtons).toHaveLength(1);
    });
  });

  describe("restore-to-print lifecycle", () => {
    const BIND_OFF_TIP_ID = "drop-shoulder-shoulder-bind-off-video";

    function buildDuplicateBindOffTipScope() {
      const tipOnScreen = new FakeElement({ classes: ["pattern-tip", "pattern-quick-tip"] });
      tipOnScreen.setAttribute("data-tip-id", BIND_OFF_TIP_ID);
      const tipPrintRegion = new FakeElement({ classes: ["pattern-tip", "pattern-quick-tip"] });
      tipPrintRegion.setAttribute("data-tip-id", BIND_OFF_TIP_ID);
      const scope = new FakeElement({ classes: ["pattern-tips-scope"] });
      scope.appendChild(tipOnScreen);
      scope.appendChild(tipPrintRegion);
      scope.setSelectorResult(DISMISSABLE_TIP_SELECTOR, [tipOnScreen, tipPrintRegion]);
      return { scope, tipOnScreen, tipPrintRegion };
    }

    it("dismiss tip → print hidden → restore all → print visible (all DOM copies)", () => {
      const { scope, tipOnScreen, tipPrintRegion } = buildDuplicateBindOffTipScope();

      dismissTipId(KEY, BIND_OFF_TIP_ID);
      refreshPatternTipDismiss(scope, KEY);

      expect(loadDismissedTipIds(KEY).has(BIND_OFF_TIP_ID)).toBe(true);
      expect(tipOnScreen.getAttribute("data-tip-dismissed")).toBe("true");
      expect(tipPrintRegion.getAttribute("data-tip-dismissed")).toBe("true");
      expect(isTipHiddenForPrint(tipPrintRegion, true)).toBe(true);

      resetDismissedTips(KEY);
      refreshPatternTipDismiss(scope, KEY);

      expect(loadDismissedTipIds(KEY).size).toBe(0);
      expect(tipOnScreen.getAttribute("data-tip-dismissed")).toBeNull();
      expect(tipPrintRegion.getAttribute("data-tip-dismissed")).toBeNull();
      expect(isTipHiddenForPrint(tipPrintRegion, true)).toBe(false);
    });

    it("clears stale data-tip-dismissed on a duplicate wrapper after restore all", () => {
      const { scope, tipOnScreen, tipPrintRegion } = buildDuplicateBindOffTipScope();

      dismissTipId(KEY, BIND_OFF_TIP_ID);
      refreshPatternTipDismiss(scope, KEY);
      resetDismissedTips(KEY);

      // Simulate a stale dismissed flag left on a secondary DOM copy (print region).
      tipPrintRegion.setAttribute("data-tip-dismissed", "true");
      tipOnScreen.removeAttribute("data-tip-dismissed");

      refreshPatternTipDismiss(scope, KEY);

      expect(tipOnScreen.getAttribute("data-tip-dismissed")).toBeNull();
      expect(tipPrintRegion.getAttribute("data-tip-dismissed")).toBeNull();
      expect(isTipHiddenForPrint(tipPrintRegion, true)).toBe(false);
    });

    it("syncPatternTipDismissBeforePrint re-applies restore from localStorage", () => {
      const { scope, tipPrintRegion } = buildDuplicateBindOffTipScope();

      dismissTipId(KEY, BIND_OFF_TIP_ID);
      refreshPatternTipDismiss(scope, KEY);
      resetDismissedTips(KEY);
      tipPrintRegion.setAttribute("data-tip-dismissed", "true");

      syncPatternTipDismissBeforePrint(scope, KEY);

      expect(tipPrintRegion.getAttribute("data-tip-dismissed")).toBeNull();
      expect(isTipHiddenForPrint(tipPrintRegion, true)).toBe(false);
    });
  });

  describe("reload persistence", () => {
    it("re-applies dismissed tips to freshly rendered DOM after a reload", () => {
      dismissTipId(KEY, "tip-a");

      // A reload re-reads localStorage and re-renders the tips into new DOM nodes.
      const reloaded = buildScope();
      refreshPatternTipDismiss(reloaded.scope, KEY);
      updateTipsResetLinkVisibility(reloaded.scope, KEY);

      expect(reloaded.tipA.getAttribute("data-tip-dismissed")).toBe("true");
      expect(reloaded.restoreBtn.hidden).toBe(false);
    });

    it("a restore performed before reload stays restored afterwards", () => {
      dismissTipId(KEY, "tip-a");
      resetDismissedTips(KEY);

      const reloaded = buildScope();
      refreshPatternTipDismiss(reloaded.scope, KEY);
      updateTipsResetLinkVisibility(reloaded.scope, KEY);

      expect(reloaded.tipA.getAttribute("data-tip-dismissed")).toBeNull();
      expect(reloaded.restoreBtn.hidden).toBe(true);
    });
  });
});
