/**
 * Inactive Optional Bust Dart prompt reuses patternTipDismiss (Hide × + Restore hidden tips).
 * Active dart instructions must never participate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPTIONAL_BUST_DART_TIP_ID,
  renderBustDartCustomizationPrintHtml,
  renderBustDartCustomizationScreenHtml,
  type BustDartCustomizationDisplayRow,
} from "./bustDartFrontSlotHtml";
import { BUST_DART_STYLE_KEY } from "./bustDartPatternCustomization";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  DISMISSABLE_TIP_SELECTOR,
  TIP_WITH_ID_SELECTOR,
  dismissedTipsStorageKey,
  dismissTipId,
  isTipHiddenForPrint,
  loadDismissedTipIds,
  refreshPatternTipDismiss,
  resetDismissedTips,
} from "./patternTipDismiss";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { stubLocalStorage } from "./test/stubLocalStorage";

const KEY = "sleeveless-show-tips";

const inactiveRow: BustDartCustomizationDisplayRow = {
  kind: "bustDartCustomization",
  active: false,
  cupSize: null,
  dartStartGarmentRc: 133,
  armholeOpeningGarmentRc: 140,
  placementOffsetRows: 7,
  rowsFromHemToDartStart: 111,
  rowsFromDartToArmhole: 7,
  instructionParagraphs: [],
  errors: [],
};

const activeRow: BustDartCustomizationDisplayRow = {
  ...inactiveRow,
  active: true,
  cupSize: "C",
  instructionParagraphs: ["Add bust darts (cup C).", "Place 4 needles in HP."],
};

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

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  classList: FakeClassList;
  type = "";
  textContent = "";
  tagName: string;
  parentElement: FakeElement | null = null;
  private _className = "";

  constructor(opts: { classes?: string[]; tagName?: string } = {}) {
    this.classList = new FakeClassList(opts.classes ?? []);
    this.tagName = opts.tagName ?? "DIV";
    if (opts.classes?.length) this._className = opts.classes.join(" ");
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
        !this.classList.contains("pattern-tips-control-box") &&
        !this.hasAttribute("data-pattern-print-personalization-tip")
      );
    }
    if (selector === TIP_WITH_ID_SELECTOR) {
      return this.classList.contains("pattern-tip") && this.getAttribute("data-tip-id") !== null;
    }
    if (selector === ".pattern-tip[data-tip-dismissed]") {
      return this.classList.contains("pattern-tip") && this.hasAttribute("data-tip-dismissed");
    }
    return false;
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs;
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

  private collectMatches(selector: string, found: FakeElement[]): void {
    if (this.matches(selector)) found.push(this);
    for (const child of this.children) child.collectMatches(selector, found);
  }

  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    for (const child of this.children) child.collectMatches(selector, found);
    return found;
  }
}

function womenPattern(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      frontStyle: "closed",
      garmentStyle: "pullover",
      ...extraStyle,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
      gaugeRawUnit: "in",
    },
  };
}

describe("optional bust dart hideable tip (patternTipDismiss)", () => {
  let prevHTMLElement: unknown;
  let prevDocument: unknown;

  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    prevHTMLElement = (globalThis as { HTMLElement?: unknown }).HTMLElement;
    prevDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { HTMLElement: unknown }).HTMLElement = FakeElement;
    (globalThis as { document: unknown }).document = {
      createElement: (tag: string) => new FakeElement({ tagName: tag.toUpperCase() }),
    };
  });

  afterEach(() => {
    localStorage.clear();
    (globalThis as { HTMLElement?: unknown }).HTMLElement = prevHTMLElement;
    (globalThis as { document?: unknown }).document = prevDocument;
    vi.restoreAllMocks();
  });

  it("inactive prompt is dismissable; Hide persists via dismissed tips storage", () => {
    const html = renderBustDartCustomizationScreenHtml(inactiveRow);
    expect(html).toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(html).toContain("Add Bust Dart");

    const tip = new FakeElement({
      classes: [
        "pattern-tip",
        "bust-dart-front-slot",
        "pattern-print-personalization-never-print",
        "no-print",
      ],
    });
    tip.setAttribute("data-tip-id", OPTIONAL_BUST_DART_TIP_ID);
    tip.setAttribute("data-bust-dart-active", "false");

    const scope = new FakeElement();
    scope.appendChild(tip);

    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(tip.children.some((c) => c.className === "pattern-tip-dismiss")).toBe(true);
    expect(tip.children.find((c) => c.className === "pattern-tip-dismiss")?.getAttribute("aria-label")).toBe(
      "Hide this tip",
    );

    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(tip.getAttribute("data-tip-dismissed")).toBe("true");
    expect([...loadDismissedTipIds(KEY)]).toEqual([OPTIONAL_BUST_DART_TIP_ID]);
    expect(JSON.parse(localStorage.getItem(dismissedTipsStorageKey(KEY))!)).toEqual([
      OPTIONAL_BUST_DART_TIP_ID,
    ]);
  });

  it("Restore hidden tips (resetDismissedTips) clears hide and re-shows the inactive prompt", () => {
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const tip = new FakeElement({
      classes: ["pattern-tip", "bust-dart-front-slot", "pattern-print-personalization-never-print"],
    });
    tip.setAttribute("data-tip-id", OPTIONAL_BUST_DART_TIP_ID);
    tip.setAttribute("data-tip-dismissed", "true");
    const scope = new FakeElement();
    scope.appendChild(tip);

    resetDismissedTips(KEY);
    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(tip.hasAttribute("data-tip-dismissed")).toBe(false);
    expect(loadDismissedTipIds(KEY).size).toBe(0);
  });

  it("hiding the inactive prompt does not change style.bustDart", () => {
    const style = { [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null as string | null } };
    const before = structuredClone(style);
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    expect(style).toEqual(before);
    expect(style[BUST_DART_STYLE_KEY]).toEqual({ enabled: false, cupSize: null });
  });

  it("active dart instructions cannot be hidden via tip dismiss", () => {
    const html = renderBustDartCustomizationScreenHtml(activeRow);
    expect(html).not.toMatch(/data-tip-id=/);
    expect(html).toMatch(/Update Bust Dart/);
    expect(html).toMatch(/Remove Bust Dart/);
    expect(html).not.toMatch(/pattern-tip-dismiss|data-tip-dismissed/);

    const active = new FakeElement({ classes: ["bust-dart-front-slot"] });
    active.setAttribute("data-bust-dart-active", "true");
    const scope = new FakeElement();
    scope.appendChild(active);
    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(active.children.some((c) => c.className === "pattern-tip-dismiss")).toBe(false);
    expect(active.hasAttribute("data-tip-dismissed")).toBe(false);
  });

  it("inactive prompt does not print; active dart instructions do", () => {
    expect(renderBustDartCustomizationPrintHtml(inactiveRow)).toBe("");
    const printActive = renderBustDartCustomizationPrintHtml(activeRow);
    expect(printActive).toMatch(/Bust Dart \(Cup C\)/);
    expect(printActive).toMatch(/Add bust darts/);

    const tip = new FakeElement({
      classes: ["pattern-tip", "pattern-print-personalization-never-print"],
    });
    tip.setAttribute("data-tip-id", OPTIONAL_BUST_DART_TIP_ID);
    expect(isTipHiddenForPrint(tip as unknown as HTMLElement, true)).toBe(true);
  });

  it("Sleeveless and Drop Shoulder emit the same hideable inactive tip id", () => {
    const sleeveless = generateSleevelessBackPattern(womenPattern());
    const drop = generateDropShoulderPattern({
      ...womenPattern({
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
      }),
    });

    const sleevelessSlot = sleeveless.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    const dropSlot = drop.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(sleevelessSlot?.kind === "bustDartCustomization" && !sleevelessSlot.active).toBe(true);
    expect(dropSlot?.kind === "bustDartCustomization" && !dropSlot.active).toBe(true);

    const sleevelessHtml = renderBustDartCustomizationScreenHtml(
      sleevelessSlot as BustDartCustomizationDisplayRow,
    );
    const dropHtml = renderBustDartCustomizationScreenHtml(dropSlot as BustDartCustomizationDisplayRow);
    expect(sleevelessHtml).toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(dropHtml).toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(sleevelessHtml).toContain("Add Bust Dart");
    expect(dropHtml).toContain("Add Bust Dart");
  });

  it("saved dismissed tip id persists across refresh like other hidden tips", () => {
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const tip = new FakeElement({
      classes: ["pattern-tip", "bust-dart-front-slot", "pattern-print-personalization-never-print"],
    });
    tip.setAttribute("data-tip-id", OPTIONAL_BUST_DART_TIP_ID);
    const scope = new FakeElement();
    scope.appendChild(tip);

    // Simulate reopened pattern: new DOM, same localStorage dismissed list
    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(tip.getAttribute("data-tip-dismissed")).toBe("true");

    // Removing an active dart regenerates inactive HTML; prior hide preference still applies
    const regenerated = new FakeElement({
      classes: ["pattern-tip", "bust-dart-front-slot", "pattern-print-personalization-never-print"],
    });
    regenerated.setAttribute("data-tip-id", OPTIONAL_BUST_DART_TIP_ID);
    regenerated.setAttribute("data-bust-dart-active", "false");
    const scope2 = new FakeElement();
    scope2.appendChild(regenerated);
    refreshPatternTipDismiss(scope2 as unknown as Element, KEY);
    expect(regenerated.getAttribute("data-tip-dismissed")).toBe("true");
  });

  it("active dart HTML retains Update and Remove after hide preference exists", () => {
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const html = renderBustDartCustomizationScreenHtml(activeRow);
    expect(html).toMatch(/Update Bust Dart/);
    expect(html).toMatch(/Remove Bust Dart/);
    expect(html).not.toContain(OPTIONAL_BUST_DART_TIP_ID);
  });
});
