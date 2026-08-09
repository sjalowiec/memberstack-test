import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { applyHatCrownCastOnAdjustment, calculateHatPattern } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import {
  HAT_CHOOSE_YOUR_BRIM_TIP_ID,
  HAT_CHOOSE_YOUR_BRIM_TITLE,
  HAT_EWRAP_GLOSSARY_ARIA_LABEL,
  HAT_EWRAP_GLOSSARY_ID,
  HAT_EWRAP_GLOSSARY_VISIBLE_TEXT,
  HAT_HUNG_HEM_GLOSSARY_ARIA_LABEL,
  HAT_HUNG_HEM_GLOSSARY_ID,
  HAT_HUNG_HEM_GLOSSARY_VISIBLE_TEXT,
  HAT_ROLLED_EDGE_EXAMPLE_LABEL,
  HAT_ROLLED_EDGE_IMAGE_ALT,
  HAT_ROLLED_EDGE_IMAGE_MODAL_TITLE,
  HAT_ROLLED_EDGE_IMAGE_SRC,
  buildHatChooseYourBrimHtml,
  buildHatChooseYourBrimTipHtml,
  buildHatEwrapGlossaryHtml,
  buildHatHungHemGlossaryHtml,
  buildHatRolledEdgeExampleHtml,
} from "./hatChooseYourBrim";
import { HAT_GATHERED_TOP_VIDEO_CONTENT_ID } from "./hatGatheredTopVideoTip";
import { HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID } from "./hatMattressStitchVideoTip";
import {
  HAT_PLANNING_RIBBING_TIP_TEXT,
  HAT_PLANNING_RIBBING_TIP_TITLE,
  HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID,
} from "./hatPlanningRibbingVideoTip";
import {
  DISMISSABLE_TIP_SELECTOR,
  dismissTipId,
  isTipHiddenForPrint,
  loadDismissedTipIds,
  refreshPatternTipDismiss,
  restoreAllDismissedPatternTips,
} from "../patternTipDismiss";
import { stubLocalStorage } from "../test/stubLocalStorage";

const STORAGE_KEY = "hat-show-tips";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

function calcFor(
  crown: string,
  overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {},
) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown,
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
    ...overrides,
  });
}

function patternHtml(
  crown: string,
  opts: {
    unit?: "inches" | "cm";
    calcOverrides?: Partial<Parameters<typeof calculateHatPattern>[0]>;
  } = {},
) {
  const unit = opts.unit ?? "inches";
  const calc = calcFor(crown, {
    displayUnit: unit === "cm" ? "cm" : "inches",
    ...(opts.calcOverrides ?? {}),
  });
  return {
    calc,
    html: buildHatPatternHtml({
      calc,
      currentUnit: unit,
      scrapOffPatternTooltip: "Scrap Off",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    }),
  };
}

function countOccurrences(html: string, needle: string): number {
  if (!needle) return 0;
  return html.split(needle).length - 1;
}

function countContentId(html: string, contentId: string | number): number {
  const re = new RegExp(`data-content-id="${contentId}"`, "g");
  return (html.match(re) ?? []).length;
}

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

  constructor(opts: { tagName?: string; classes?: string[]; attrs?: Record<string, string> } = {}) {
    this.tagName = (opts.tagName ?? "div").toUpperCase();
    this._className = (opts.classes ?? []).join(" ");
    this.classList = new FakeClassList(opts.classes ?? []);
    this.attrs = { ...(opts.attrs ?? {}) };
  }

  get className(): string {
    return this._className;
  }
  set className(v: string) {
    this._className = v;
    this.classList = new FakeClassList(v.split(/\s+/).filter(Boolean));
  }

  getAttribute(name: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name]! : null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  hasAttribute(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }
  removeAttribute(name: string): void {
    delete this.attrs[name];
  }
  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
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
    if (selector === ".pattern-tip[data-tip-id]") {
      return this.classList.contains("pattern-tip") && this.getAttribute("data-tip-id") !== null;
    }
    if (selector === ".pattern-tip[data-tip-dismissed]") {
      return this.classList.contains("pattern-tip") && this.hasAttribute("data-tip-dismissed");
    }
    return false;
  }
  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const visit = (el: FakeElement) => {
      if (el.matches(selector)) out.push(el);
      el.children.forEach(visit);
    };
    this.children.forEach(visit);
    return out;
  }
  closest(selector: string): FakeElement | null {
    let cur: FakeElement | null = this;
    while (cur) {
      if (cur.matches(selector) || (selector === ".pattern-tip" && cur.classList.contains("pattern-tip"))) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }
}

const instructionsSource = readFileSync(join(__dirname, "hatInstructions.ts"), "utf8");
const chooseBrimSource = readFileSync(join(__dirname, "hatChooseYourBrim.ts"), "utf8");
const hatPatternPageSource = readFileSync(
  join(__dirname, "../../../scripts/hat-pattern-page.ts"),
  "utf8",
);
const kinImageModalSource = readFileSync(
  join(__dirname, "../../../components/common/KinImageModal.astro"),
  "utf8",
);
const baseLayoutSource = readFileSync(
  join(__dirname, "../../../layouts/BaseLayout.astro"),
  "utf8",
);
const patternTipsCss = readFileSync(
  join(__dirname, "../../../styles/pattern-tips.css"),
  "utf8",
);

describe("hatChooseYourBrim", () => {
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
    vi.unstubAllGlobals();
  });

  it("builds rolled-edge example trigger for KinImageModal", () => {
    const html = buildHatRolledEdgeExampleHtml();
    expect(html).toContain(HAT_ROLLED_EDGE_IMAGE_SRC);
    expect(html).toContain(HAT_ROLLED_EDGE_IMAGE_ALT);
    expect(html).toContain(HAT_ROLLED_EDGE_IMAGE_MODAL_TITLE);
    expect(html).toContain(HAT_ROLLED_EDGE_EXAMPLE_LABEL);
    expect(html).toContain("kbm-kin-image-modal");
    expect(html).toContain('data-testid="hat-rolled-edge-example-open"');
    expect(html).toContain("pattern-tip-media-no-print");
    expect(html).toContain("no-print");
  });

  it("builds hung-hem and e-wrap glossary placeholders (not video controls)", () => {
    const hung = buildHatHungHemGlossaryHtml();
    expect(hung).toContain(`data-glossary-id="${HAT_HUNG_HEM_GLOSSARY_ID}"`);
    expect(hung).toContain(`data-aria-label="${HAT_HUNG_HEM_GLOSSARY_ARIA_LABEL}"`);
    expect(hung).toContain(`data-term="${HAT_HUNG_HEM_GLOSSARY_VISIBLE_TEXT}"`);
    expect(hung).not.toContain("kbm-kin-catalog-video");

    const ewrap = buildHatEwrapGlossaryHtml();
    expect(ewrap).toContain(`data-glossary-id="${HAT_EWRAP_GLOSSARY_ID}"`);
    expect(ewrap).toContain(`data-aria-label="${HAT_EWRAP_GLOSSARY_ARIA_LABEL}"`);
    expect(ewrap).toContain(`data-term="${HAT_EWRAP_GLOSSARY_VISIBLE_TEXT}"`);
    expect(ewrap).not.toContain("kbm-kin-catalog-video");
  });

  it("builds a neutral never-print pattern tip with planning ribbing inside", () => {
    const html = buildHatChooseYourBrimTipHtml({
      displayBrimDepth: "2",
      unit: "inches",
      brimRows: 4,
    });
    expect(html).toContain('class="pattern-tip pattern-tip--neutral hat-choose-your-brim-tip pattern-print-personalization-never-print no-print"');
    expect(html).toContain(`data-tip-id="${HAT_CHOOSE_YOUR_BRIM_TIP_ID}"`);
    expect(html).toContain(HAT_CHOOSE_YOUR_BRIM_TITLE);
    expect(html).toContain(HAT_PLANNING_RIBBING_TIP_TITLE);
    expect(html).toContain(HAT_PLANNING_RIBBING_TIP_TEXT);
    expect(html).toContain(`data-content-id="${HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID}"`);
    expect(html).toContain('data-testid="hat-planning-ribbing-video-watch"');
    expect(html).toContain("kbm-kin-catalog-video glossary-tooltip-trigger");
    expect(html).not.toContain(`data-tip-id="hat-planning-ribbing-brim"`);
    expect(html).toContain("pattern-tip--neutral");
    expect(html).toContain("pattern-print-personalization-never-print");
    expect(patternTipsCss).toContain(".pattern-tip.pattern-tip--neutral");
    expect(patternTipsCss).toMatch(
      /\.pattern-tip\.pattern-tip--neutral\s*\{[^}]*background:\s*#fff/s,
    );
  });

  it("is always hidden for print whether dismissed or visible on screen", () => {
    const tip = new FakeElement({
      classes: [
        "pattern-tip",
        "pattern-tip--neutral",
        "hat-choose-your-brim-tip",
        "pattern-print-personalization-never-print",
        "no-print",
      ],
      attrs: { "data-tip-id": HAT_CHOOSE_YOUR_BRIM_TIP_ID },
    }) as unknown as HTMLElement;
    expect(isTipHiddenForPrint(tip, true)).toBe(true);
    tip.setAttribute("data-tip-dismissed", "true");
    expect(isTipHiddenForPrint(tip, true)).toBe(true);
    tip.removeAttribute("data-tip-dismissed");
    expect(isTipHiddenForPrint(tip, false)).toBe(true);
  });

  it("participates in dismiss and Show Tips OFF→ON restore", () => {
    const scope = new FakeElement({ classes: ["pattern-tips-scope"] });
    const tip = new FakeElement({
      classes: [
        "pattern-tip",
        "pattern-tip--neutral",
        "hat-choose-your-brim-tip",
        "pattern-print-personalization-never-print",
      ],
      attrs: { "data-tip": "", "data-tip-id": HAT_CHOOSE_YOUR_BRIM_TIP_ID },
    });
    scope.appendChild(tip);

    refreshPatternTipDismiss(scope as unknown as Element, STORAGE_KEY);
    expect(tip.children.some((c) => c.className === "pattern-tip-dismiss")).toBe(true);

    dismissTipId(STORAGE_KEY, HAT_CHOOSE_YOUR_BRIM_TIP_ID);
    refreshPatternTipDismiss(scope as unknown as Element, STORAGE_KEY);
    expect(tip.getAttribute("data-tip-dismissed")).toBe("true");
    expect(loadDismissedTipIds(STORAGE_KEY).has(HAT_CHOOSE_YOUR_BRIM_TIP_ID)).toBe(true);

    restoreAllDismissedPatternTips(scope as unknown as Element, STORAGE_KEY);
    expect(tip.hasAttribute("data-tip-dismissed")).toBe(false);
    expect(loadDismissedTipIds(STORAGE_KEY).has(HAT_CHOOSE_YOUR_BRIM_TIP_ID)).toBe(false);
  });

  it.each([
    ["gathered", "gathered"],
    ["swirl", "spiral"],
    ["four-gore", "wedge-4-decrease"],
  ] as const)(
    "appears exactly once before cast-on for %s hats as a single tip",
    (_label, crown) => {
      const { calc, html } = patternHtml(crown);
      const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, crown);

      expect(countOccurrences(html, `data-tip-id="${HAT_CHOOSE_YOUR_BRIM_TIP_ID}"`)).toBe(1);
      expect(html).toContain("pattern-tip--neutral");
      expect(html).toContain("pattern-print-personalization-never-print");
      expect(html).toContain(HAT_CHOOSE_YOUR_BRIM_TITLE);
      expect(html).toContain("Ribbing or mock ribbing");
      expect(html).toContain("<strong>Hung hem:</strong>");
      expect(html).toContain("Rolled edge");
      expect(countOccurrences(html, `data-glossary-id="${HAT_HUNG_HEM_GLOSSARY_ID}"`)).toBe(1);
      expect(countOccurrences(html, `data-glossary-id="${HAT_EWRAP_GLOSSARY_ID}"`)).toBe(1);
      expect(countContentId(html, HAT_PLANNING_RIBBING_VIDEO_CONTENT_ID)).toBe(1);
      expect(html).toContain(HAT_ROLLED_EDGE_IMAGE_SRC);
      expect(html).toContain('data-testid="hat-rolled-edge-example-open"');
      expect(html).toContain("kbm-kin-image-modal");
      expect(html).not.toContain('data-section-id="choose-brim"');

      const tipIdx = html.indexOf(`data-tip-id="${HAT_CHOOSE_YOUR_BRIM_TIP_ID}"`);
      const castOnIdx = html.indexOf('data-section-id="cast-on"');
      expect(tipIdx).toBeGreaterThan(-1);
      expect(castOnIdx).toBeGreaterThan(tipIdx);
      expect(html).toContain(`Cast on <strong>${patternCastOn} stitches</strong>.`);
      expect(html).toContain(`Work ${calc.brimRows} rows in your chosen brim finish.`);
      expect(html).toContain("Want a deeper brim?");
    },
  );

  it("keeps inch and metric patterns row-based for rolled edge", () => {
    const inches = patternHtml("gathered", { unit: "inches" });
    const cm = patternHtml("gathered", {
      unit: "cm",
      calcOverrides: {
        displayUnit: "cm",
        stitchGaugeDisplay: 20,
        rowGaugeDisplay: 28,
        finishedHatCircInches: 52 / 2.54,
        totalHatLengthInches: 22 / 2.54,
        brimDepthInches: 5 / 2.54,
      },
    });
    expect(inches.html).toContain(
      `knit the calculated ${inches.calc.brimRows} brim rows in stockinette`,
    );
    expect(cm.html).toContain(
      `knit the calculated ${cm.calc.brimRows} brim rows in stockinette`,
    );
  });

  it("does not change body rows, crown-start RC, or cast-on math", () => {
    const { calc, html } = patternHtml("gathered");
    const crownStart = calc.brimRows + calc.bodyRows;
    expect(html).toContain(`Begin crown shaping at RC ${crownStart}.`);
    expect(html).toContain(`Work ${calc.bodyRows} rows in pattern after the brim.`);
    expect(html).toContain(
      `Finished Hat Length: ${formatLength(calc.hatHeight, "inches")} inches`,
    );
    expect(countContentId(html, HAT_MATTRESS_STITCH_VIDEO_CONTENT_ID)).toBe(1);
    expect(countContentId(html, HAT_GATHERED_TOP_VIDEO_CONTENT_ID)).toBe(1);
  });

  it("wires shared tip helper once before cast-on", () => {
    expect(instructionsSource).toContain("buildHatChooseYourBrimTipHtml");
    expect(instructionsSource).toMatch(
      /chooseYourBrimTipHtml = buildHatChooseYourBrimTipHtml/,
    );
    expect(instructionsSource).toMatch(
      /\$\{chooseYourBrimTipHtml\}\s*\n\s*\$\{wrapHatPatternSection\(\s*"cast-on"/,
    );
    expect(instructionsSource).not.toContain("buildHatPlanningRibbingBrimTipHtml");
    expect(chooseBrimSource).toContain("HAT_CHOOSE_YOUR_BRIM_TIP_ID = \"hat-choose-your-brim\"");
    expect(chooseBrimSource).toContain("pattern-tip--neutral");
    expect(hatPatternPageSource).toContain("hydrateGlossaryTooltipPlaceholders");
    expect(kinImageModalSource).toContain('id="kbmKinImageModal"');
    expect(baseLayoutSource).toContain("KinImageModal");
    // body-only helper still available for unit checks
    expect(buildHatChooseYourBrimHtml({ displayBrimDepth: "2", unit: "inches", brimRows: 4 })).toContain(
      "Ribbing or mock ribbing",
    );
  });
});
