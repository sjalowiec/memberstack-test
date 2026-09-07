/**
 * Optional Bust Dart is pattern customization, not a dismissable Pattern Tip.
 * Show Tips OFF and leftover dismissed-tip ids must not hide Add Bust Dart.
 * Active dart instructions are never tip-dismissable.
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
  dismissTipId,
  patternTipsControlBoxHtml,
  refreshPatternTipDismiss,
} from "./patternTipDismiss";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  BUST_DART_HELP_WATCH_LABEL,
  BUST_DART_INACTIVE_HELP_NOTE,
} from "../tools/dartFormulaHelpVideo";

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
  instructionParagraphs: [
    "Stop the row counter at RC 133, 1â€³ below the armhole opening.",
    "On each side of the Front center, place 4 needles in hold.",
  ],
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

describe("optional bust dart is not a Pattern Tip", () => {
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

  it("inactive Add Bust Dart control is not dismissable and stays visible when Show Tips is off", () => {
    localStorage.setItem(KEY, "false");
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const html = renderBustDartCustomizationScreenHtml(inactiveRow);
    expect(html).toContain("Add Bust Dart");
    expect(html).toContain('data-testid="button-optional-bust-dart"');
    expect(html).not.toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(html).not.toMatch(/class="[^"]*pattern-tip/);
    expect(html).toContain(BUST_DART_INACTIVE_HELP_NOTE);
    expect(html).toContain(BUST_DART_HELP_WATCH_LABEL);
  });

  it("Show Tips control box no longer includes Restore hidden tips", () => {
    const box = patternTipsControlBoxHtml(true);
    expect(box).not.toContain("Restore hidden tips");
    expect(box).not.toContain("link-tips-restore-dismissed");
    expect(box).not.toContain("pattern-tips-reset-dismissed");
  });

  it("turning Show Tips off does not hide or alter active bust-dart instructions", () => {
    const style = { [BUST_DART_STYLE_KEY]: { enabled: true, cupSize: "C" as string | null } };
    const before = structuredClone(style);
    localStorage.setItem(KEY, "true");
    localStorage.setItem(KEY, "false");

    const activeHtml = renderBustDartCustomizationScreenHtml(activeRow);
    expect(activeHtml).toMatch(/Update Bust Dart/);
    expect(activeHtml).toMatch(/Remove Bust Dart/);
    expect(activeHtml).toMatch(/Cup C/);
    expect(activeHtml).toMatch(/Stop the row counter at RC 133/);
    expect(activeHtml).toMatch(/bust-dart-front-slot__steps/);
    expect(activeHtml).not.toMatch(/Work the short-row bust darts/);
    expect(activeHtml).not.toMatch(/data-tip-id=/);
    expect(style).toEqual(before);
  });

  it("hiding leftover optional-bust-dart-front tip storage does not change style.bustDart", () => {
    const style = { [BUST_DART_STYLE_KEY]: { enabled: false, cupSize: null as string | null } };
    const before = structuredClone(style);
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    expect(style).toEqual(before);
    expect(style[BUST_DART_STYLE_KEY]).toEqual({ enabled: false, cupSize: null });
    expect(renderBustDartCustomizationScreenHtml(inactiveRow)).toContain("Add Bust Dart");
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
    expect(printActive).toMatch(/Bust Dart/);
    expect(printActive).toMatch(/Cup C/);
    expect(printActive).toMatch(/Stop the row counter at RC 133/);
    expect(printActive).not.toMatch(/Work the short-row bust darts/);
  });

  it("Sleeveless and Drop Shoulder offer the same Add Bust Dart control", () => {
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
    expect(sleevelessHtml).toContain("Add Bust Dart");
    expect(dropHtml).toContain("Add Bust Dart");
    expect(sleevelessHtml).not.toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(dropHtml).not.toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
  });

  it("leftover dismissed optional-bust-dart-front id does not hide the regenerated Add control", () => {
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const html = renderBustDartCustomizationScreenHtml(inactiveRow);
    expect(html).toContain("Add Bust Dart");
    expect(html).not.toContain("data-tip-id");

    const slot = new FakeElement({
      classes: ["bust-dart-front-slot", "bust-dart-front-slot--optional"],
    });
    slot.setAttribute("data-bust-dart-active", "false");
    const scope = new FakeElement();
    scope.appendChild(slot);
    refreshPatternTipDismiss(scope as unknown as Element, KEY);
    expect(slot.hasAttribute("data-tip-dismissed")).toBe(false);
    expect(slot.children.some((c) => c.className === "pattern-tip-dismiss")).toBe(false);
  });

  it("active dart HTML retains Update and Remove after hide preference exists", () => {
    dismissTipId(KEY, OPTIONAL_BUST_DART_TIP_ID);
    const html = renderBustDartCustomizationScreenHtml(activeRow);
    expect(html).toMatch(/Update Bust Dart/);
    expect(html).toMatch(/Remove Bust Dart/);
    expect(html).not.toContain(OPTIONAL_BUST_DART_TIP_ID);
  });
});
