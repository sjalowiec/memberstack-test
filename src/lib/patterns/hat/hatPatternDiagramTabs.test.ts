import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../../glossary/shapingNotationGlossary";
import { formatShapingSegment } from "../shapingNotationCompress";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  calculateHatPattern,
  gatheredCrownRemainingStitches,
} from "./hatMath";
import {
  buildHatShapingNotationDiagramSvg,
  formatHatShapingCastOnLabel,
  formatHatShapingRcLabel,
  HAT_SHAPING_NOTATION_VIEWBOX,
} from "./hatShapingNotationDiagramSvg";
import {
  HAT_SHAPING_NOTATION_HELP_LABEL,
  HAT_SHAPING_NOTATION_HELP_VIMEO_ID,
  buildHatShapingNotationHelpHtml,
} from "./hatShapingNotationHelp";
import {
  HAT_DIAGRAM_TAB_SHAPING,
  HAT_DIAGRAM_TAB_STS_ROWS,
  activateHatDiagramTab,
  buildHatPatternDiagramTabsShellHtml,
  initHatPatternDiagramTabs,
} from "./hatPatternDiagramTabs";
import { buildHatPatternDiagramSvg } from "./hatPatternDiagramSvg";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function calcFor(overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {}) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown: "gathered",
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
    ...overrides,
  });
}

function withFourWedge(calc: ReturnType<typeof calcFor>) {
  calc.fourWedgeCrownSetup = buildFourWedgeCrownSetup({
    castOnSts: calc.castOnSts,
    crown: calc.crown,
    brimRows: calc.brimRows,
    bodyRows: calc.bodyRows,
  });
  return calc;
}

/** Minimal ParentNode stub — suite runs without jsdom. */
type StubEl = {
  tagName: string;
  tabIndex: number;
  classList: { toggle: (name: string, force?: boolean) => void };
  _attrs: Map<string, string>;
  _listeners: Map<string, Array<(e: { key: string; preventDefault: () => void }) => void>>;
  _children: StubEl[];
  focus: (opts?: { preventScroll?: boolean }) => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  querySelector: (sel: string) => StubEl | null;
  querySelectorAll: (sel: string) => StubEl[];
  addEventListener: (
    type: string,
    handler: (e: { key: string; preventDefault: () => void }) => void,
  ) => void;
  dispatchKey: (key: string) => void;
};

function makeStubEl(tag: string, attrs: Record<string, string> = {}): StubEl {
  const _attrs = new Map(Object.entries(attrs));
  const _listeners = new Map<
    string,
    Array<(e: { key: string; preventDefault: () => void }) => void>
  >();
  const _children: StubEl[] = [];
  const classes = new Set<string>();

  const el: StubEl = {
    tagName: tag.toUpperCase(),
    tabIndex: attrs.tabindex != null ? Number(attrs.tabindex) : 0,
    classList: {
      toggle(name, force?: boolean) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
    },
    _attrs,
    _listeners,
    _children,
    focus() {},
    setAttribute(name, value) {
      _attrs.set(name, value);
      if (name === "tabindex") el.tabIndex = Number(value);
    },
    getAttribute(name) {
      return _attrs.get(name) ?? null;
    },
    removeAttribute(name) {
      _attrs.delete(name);
    },
    hasAttribute(name) {
      return _attrs.has(name);
    },
    querySelector(sel) {
      return el.querySelectorAll(sel)[0] ?? null;
    },
    querySelectorAll(sel) {
      const out: StubEl[] = [];
      const walk = (nodes: StubEl[]) => {
        for (const child of nodes) {
          if (matches(child, sel)) out.push(child);
          walk(child._children);
        }
      };
      walk(_children);
      return out;
    },
    addEventListener(type, handler) {
      const list = _listeners.get(type) ?? [];
      list.push(handler);
      _listeners.set(type, list);
    },
    dispatchKey(key) {
      const handlers = _listeners.get("keydown") ?? [];
      for (const handler of handlers) {
        handler({ key, preventDefault() {} });
      }
    },
  };
  return el;
}

function matches(el: StubEl, sel: string): boolean {
  if (sel === "[data-hat-diagram-tabs]") return el.hasAttribute("data-hat-diagram-tabs");
  if (sel === "[data-hat-diagram-tab]") return el.hasAttribute("data-hat-diagram-tab");
  if (sel === "[data-hat-diagram-panel]") return el.hasAttribute("data-hat-diagram-panel");
  const tabMatch = sel.match(/^\[data-hat-diagram-tab="([^"]+)"\]$/);
  if (tabMatch) return el.getAttribute("data-hat-diagram-tab") === tabMatch[1];
  const panelMatch = sel.match(/^\[data-hat-diagram-panel="([^"]+)"\]$/);
  if (panelMatch) return el.getAttribute("data-hat-diagram-panel") === panelMatch[1];
  return false;
}

function buildTabsStubRoot(): StubEl {
  const root = makeStubEl("div", { "data-hat-diagram-tabs": "" });
  const stsTab = makeStubEl("button", {
    "data-hat-diagram-tab": HAT_DIAGRAM_TAB_STS_ROWS,
    "aria-selected": "true",
    tabindex: "0",
    role: "tab",
  });
  const shapingTab = makeStubEl("button", {
    "data-hat-diagram-tab": HAT_DIAGRAM_TAB_SHAPING,
    "aria-selected": "false",
    tabindex: "-1",
    role: "tab",
  });
  const stsPanel = makeStubEl("div", {
    "data-hat-diagram-panel": HAT_DIAGRAM_TAB_STS_ROWS,
    role: "tabpanel",
  });
  const shapingPanel = makeStubEl("div", {
    "data-hat-diagram-panel": HAT_DIAGRAM_TAB_SHAPING,
    role: "tabpanel",
    hidden: "",
  });
  root._children.push(stsTab, shapingTab, stsPanel, shapingPanel);
  return root;
}

describe("hat pattern diagram tabs", () => {
  it("renders both tabs with Stitches & Rows selected by default", () => {
    const html = buildHatPatternDiagramTabsShellHtml();

    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-testid="hat-diagram-tab-sts-rows"');
    expect(html).toContain('data-testid="hat-diagram-tab-shaping-notation"');
    expect(html).toContain("Shaping Notation");
    expect(html).not.toContain("Japanese Notation");
    expect(html).toContain('aria-controls="hat-diagram-panel-sts-rows"');
    expect(html).toContain('aria-controls="hat-diagram-panel-shaping-notation"');
    expect(html).toMatch(
      /data-hat-diagram-tab="sts-rows"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-hat-diagram-tab="shaping-notation"[^>]*aria-selected="false"/,
    );
    expect(html).toContain('data-hat-diagram-panel="sts-rows"');
    expect(html).toContain('data-hat-diagram-panel="shaping-notation"');
    expect(html).toMatch(
      /data-hat-diagram-panel="shaping-notation"[^>]*\bhidden\b/,
    );
    expect(html).not.toMatch(
      /data-hat-diagram-panel="sts-rows"[^>]*\bhidden\b/,
    );
  });

  it("only shows the selected tab panel on screen", () => {
    const root = buildTabsStubRoot();
    activateHatDiagramTab(root as unknown as ParentNode, HAT_DIAGRAM_TAB_SHAPING);

    const stsPanel = root.querySelector('[data-hat-diagram-panel="sts-rows"]')!;
    const shapingPanel = root.querySelector('[data-hat-diagram-panel="shaping-notation"]')!;
    const stsTab = root.querySelector('[data-hat-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector('[data-hat-diagram-tab="shaping-notation"]')!;

    expect(stsPanel.hasAttribute("hidden")).toBe(true);
    expect(shapingPanel.hasAttribute("hidden")).toBe(false);
    expect(stsTab.getAttribute("aria-selected")).toBe("false");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    expect(shapingTab.tabIndex).toBe(0);
    expect(stsTab.tabIndex).toBe(-1);

    activateHatDiagramTab(root as unknown as ParentNode, HAT_DIAGRAM_TAB_STS_ROWS);
    expect(stsPanel.hasAttribute("hidden")).toBe(false);
    expect(shapingPanel.hasAttribute("hidden")).toBe(true);
  });

  it("supports keyboard switching between tabs", () => {
    const mount = makeStubEl("div");
    const root = buildTabsStubRoot();
    mount._children.push(root);
    initHatPatternDiagramTabs(mount as unknown as ParentNode);

    const stsTab = root.querySelector('[data-hat-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector('[data-hat-diagram-tab="shaping-notation"]')!;

    stsTab.dispatchKey("ArrowRight");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    expect(
      root.querySelector('[data-hat-diagram-panel="shaping-notation"]')!.hasAttribute("hidden"),
    ).toBe(false);

    shapingTab.dispatchKey("ArrowLeft");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");

    stsTab.dispatchKey("End");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");

    shapingTab.dispatchKey("Home");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("places the shaping-notation help only in the Shaping Notation panel", () => {
    const html = buildHatPatternDiagramTabsShellHtml();
    const shapingStart = html.indexOf('data-hat-diagram-panel="shaping-notation"');
    const stsStart = html.indexOf('data-hat-diagram-panel="sts-rows"');
    expect(shapingStart).toBeGreaterThan(-1);
    expect(stsStart).toBeGreaterThan(-1);

    const shapingChunk = html.slice(shapingStart);
    const stsChunk = html.slice(stsStart, shapingStart);
    expect(shapingChunk).toContain(HAT_SHAPING_NOTATION_HELP_LABEL);
    expect(shapingChunk).toContain("How to Read Shaping Notation");
    expect(shapingChunk).not.toContain("Japanese Notation");
    expect(shapingChunk).toContain(`data-vimeo-id="${HAT_SHAPING_NOTATION_HELP_VIMEO_ID}"`);
    expect(shapingChunk).toContain("fa-circle-info");
    expect(stsChunk).not.toContain("data-hat-shaping-notation-help");
    expect(HAT_SHAPING_NOTATION_HELP_VIMEO_ID).toBe(SHAPING_NOTATION_CHART_HELP_VIMEO_ID);
    expect(buildHatShapingNotationHelpHtml()).toContain("kbm-kin-catalog-video");
  });

  it("print markup includes both labeled diagrams and excludes interactive chrome classes", () => {
    const html = buildHatPatternDiagramTabsShellHtml();
    expect(html).toContain('class="hat-pattern-diagram-tabs__list no-print"');
    expect(html).toContain("hat-pattern-diagram-shaping-help no-print");
    expect(html).toContain(
      '<h3 class="hat-pattern-diagram-print-heading">Stitches &amp; Rows</h3>',
    );
    expect(html).toContain(
      '<h3 class="hat-pattern-diagram-print-heading">Shaping Notation</h3>',
    );
    expect(html).not.toContain("Japanese Notation");

    const page = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");
    expect(page).toContain(".hat-pattern-diagram-tabs__panel[hidden]");
    expect(page).toContain("display: block !important");
    expect(page).toContain(".hat-pattern-diagram-print-heading");
    expect(page).toContain(".hat-pattern-diagram-tabs__list");
    expect(page).toContain(".hat-pattern-diagram-shaping-help");
    expect(page).toContain("min-height: 44px");
    expect(page).toContain("var(--kbm-green, #52682d)");
    expect(page).not.toContain("Japanese Notation");
  });

  it("preserves accessible tab roles and selection semantics in the shell", () => {
    const html = buildHatPatternDiagramTabsShellHtml();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toMatch(
      /data-hat-diagram-tab="sts-rows"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-hat-diagram-tab="shaping-notation"[^>]*aria-selected="false"/,
    );
    expect(html).toContain('aria-controls="hat-diagram-panel-sts-rows"');
    expect(html).toContain('aria-controls="hat-diagram-panel-shaping-notation"');
  });
});

describe("buildHatShapingNotationDiagramSvg", () => {
  it("uses a stable viewBox and preserveAspectRatio distinct from Stitches & Rows", () => {
    const calc = calcFor();
    const shaping = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const sts = buildHatPatternDiagramSvg(calc, "inches", formatters);

    expect(shaping).toContain(
      `viewBox="0 0 ${HAT_SHAPING_NOTATION_VIEWBOX.width} ${HAT_SHAPING_NOTATION_VIEWBOX.height}"`,
    );
    expect(shaping).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(shaping).toContain('width="100%"');
    expect(shaping).toContain('height="auto"');
    expect(shaping).toContain('data-hat-shaping-diagram="true"');
    expect(shaping).not.toContain('data-hat-diagram="true"');
    expect(sts).toContain('data-hat-diagram="true"');
    expect(sts).toContain('viewBox="0 0 430 460"');
    expect(shaping).not.toContain('viewBox="0 0 430 460"');
  });

  it("shows cast-on and short RC labels from the finalized calc", () => {
    const calc = calcFor();
    const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);

    expect(svg).toContain(formatHatShapingCastOnLabel(patternCastOn));
    expect(svg).toContain(formatHatShapingRcLabel(calc.brimRows));
    expect(svg).toContain(formatHatShapingRcLabel(calc.brimRows + calc.bodyRows));
    expect(formatHatShapingRcLabel(calc.brimRows)).toMatch(/^RC \d+$/);
    expect(svg).not.toContain("Brim ends");
    expect(svg).not.toContain("Begin shaping");
    expect(svg).not.toContain("Body begins");
    expect(svg).toContain('data-hat-shaping-construction-labels="true"');
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("updates construction labels when size or length changes", () => {
    const adult = calcFor({ finishedHatCircInches: 22, totalHatLengthInches: 9 });
    const custom = calcFor({
      finishedHatCircInches: 18.5,
      totalHatLengthInches: 7.25,
      fit: "custom",
    });
    const adultSvg = buildHatShapingNotationDiagramSvg(adult, "inches", formatters);
    const customSvg = buildHatShapingNotationDiagramSvg(custom, "inches", formatters);

    const adultCo = formatHatShapingCastOnLabel(
      applyHatCrownCastOnAdjustment(adult.castOnSts, adult.crown),
    );
    const customCo = formatHatShapingCastOnLabel(
      applyHatCrownCastOnAdjustment(custom.castOnSts, custom.crown),
    );
    expect(adultSvg).toContain(adultCo);
    expect(customSvg).toContain(customCo);
    expect(adultCo).not.toBe(customCo);

    const adultBrimRc = formatHatShapingRcLabel(adult.brimRows);
    const customBrimRc = formatHatShapingRcLabel(custom.brimRows);
    expect(adultSvg).toContain(adultBrimRc);
    expect(customSvg).toContain(customBrimRc);

    const adultCrownRc = formatHatShapingRcLabel(adult.brimRows + adult.bodyRows);
    const customCrownRc = formatHatShapingRcLabel(custom.brimRows + custom.bodyRows);
    expect(adultSvg).toContain(adultCrownRc);
    expect(customSvg).toContain(customCrownRc);
    expect(adultCrownRc).not.toBe(customCrownRc);
  });

  it("spaces gathered crown notation so lines do not collide", () => {
    const calc = calcFor({ crown: "gathered" });
    const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
    const remaining = gatheredCrownRemainingStitches(patternCastOn);
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const crownGroup = svg.match(
      /<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--gathered"[\s\S]*?<\/g>/,
    )?.[0];
    expect(crownGroup).toBeTruthy();
    expect(crownGroup).not.toContain("EO xfer");
    expect(crownGroup).toContain(`${remaining} sts`);
    expect(crownGroup).not.toContain(`${patternCastOn} sts`);
    expect(crownGroup).toContain(`Knit ${calc.crownRowCount} rows`);
    expect(crownGroup).toContain("Gather");
    expect(crownGroup).toContain(">Crown<");
    expect(svg).toContain(formatHatShapingCastOnLabel(patternCastOn));

    const textYs = [...crownGroup!.matchAll(/\by="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(textYs.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < textYs.length; i += 1) {
      expect(textYs[i]! - textYs[i - 1]!).toBeGreaterThanOrEqual(18);
    }
  });

  it("omits measurement arrows, dimension lines, and finished-size callouts", () => {
    const svg = buildHatShapingNotationDiagramSvg(
      withFourWedge(calcFor({ crown: "wedge-4-decrease" })),
      "inches",
      formatters,
    );
    // Arrowheads / dimension ticks used by the Stitches & Rows diagram.
    expect(svg).not.toContain("<polygon");
    expect(svg).not.toContain("Total");
    expect(svg).not.toMatch(/\d+(\.\d+)?\s*(inches|cm)\b/i);
    // Old measurement callouts like "6r / 1.0 inches" — not Ns-Mr-Kx crown notation.
    expect(svg).not.toMatch(/\d+r\s*\/\s*\d/);
    // Finished-size labels use unit words or inch marks after a length — not SVG attrs.
    expect(svg).not.toMatch(/>\s*\d+(\.\d+)?\s*(inches|cm|"|″)\s*</i);
  });

  it("keeps Stitches & Rows as a measurement diagram with lengths", () => {
    const calc = calcFor();
    const sts = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expect(sts).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(sts).toContain(formatLengthWithUnit(calc.targetWidth, "inches"));
    expect(sts).toContain("<polygon");
  });

  it("changes structure for each crown style and keeps crown shaping notation", () => {
    const gatheredCalc = calcFor({ crown: "gathered" });
    const gatheredRemaining = gatheredCrownRemainingStitches(
      applyHatCrownCastOnAdjustment(gatheredCalc.castOnSts, "gathered"),
    );
    const gathered = buildHatShapingNotationDiagramSvg(gatheredCalc, "inches", formatters);
    const wedge = buildHatShapingNotationDiagramSvg(
      withFourWedge(calcFor({ crown: "wedge-4-decrease" })),
      "inches",
      formatters,
    );
    const spiralCalc = calcFor({ crown: "spiral" });
    const spiralPlan = spiralCalc.crownPlan.spiral!;
    const spiral = buildHatShapingNotationDiagramSvg(spiralCalc, "inches", formatters);

    expect(gathered).toContain('data-crown="gathered"');
    expect(gathered).not.toContain("EO xfer");
    expect(gathered).toContain(`${gatheredRemaining} sts`);
    expect(gathered).toContain(`Knit ${gatheredCalc.crownRowCount} rows`);
    expect(gathered).toContain("Gather");
    expect(gathered).not.toContain("hat-shaping-diagram__crown--four-gore");

    expect(wedge).toContain('data-crown="wedge-4-decrease"');
    expect(wedge).toContain("hat-shaping-diagram__crown--four-gore");
    expect(wedge).toContain(">#1<");
    expect(wedge).toContain("ea edge");

    expect(spiral).toContain('data-crown="spiral"');
    expect(spiral).toContain("hat-shaping-diagram__crown--swirl");
    expect(spiral).toContain(`${spiralPlan.decreasePoints} pts`);
    expect(spiral).toContain(`→ ${spiralPlan.targetStitches} sts`);
  });

  it("gathered crown shows post-transfer stitch count for CO 86", () => {
    const calc = calcFor({
      finishedHatCircInches: 86,
      stitchGaugeDisplay: 4,
      crown: "gathered",
    });
    expect(calc.castOnSts).toBe(86);
    const remaining = gatheredCrownRemainingStitches(86);
    expect(remaining).toBe(43);
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const crownGroup = svg.match(
      /<g class="hat-shaping-diagram__crown hat-shaping-diagram__crown--gathered"[\s\S]*?<\/g>/,
    )?.[0];
    expect(crownGroup).toContain("43 sts");
    expect(crownGroup).not.toContain("86 sts");
    expect(crownGroup).not.toContain("EO xfer");
    expect(crownGroup).toContain(`Knit ${calc.crownRowCount} rows`);
    expect(svg).toContain("CO 86 sts");
  });

  it("represents each brim type", () => {
    const single = buildHatShapingNotationDiagramSvg(
      calcFor({ brimType: "single" }),
      "inches",
      formatters,
    );
    const folded = buildHatShapingNotationDiagramSvg(
      calcFor({ brimType: "folded" }),
      "inches",
      formatters,
    );
    const rolled = buildHatShapingNotationDiagramSvg(
      calcFor({ brimType: "rolled" }),
      "inches",
      formatters,
    );

    expect(single).toContain('data-brim="single"');
    expect(single).toContain("Single Layer");
    expect(folded).toContain('data-brim="folded"');
    expect(folded).toContain("Folded Hem");
    expect(folded).toContain("hat-shaping-diagram__brim-fold");
    expect(rolled).toContain('data-brim="rolled"');
    expect(rolled).toContain("Rolled Brim");
    expect(rolled).toContain("hat-shaping-diagram__brim-roll");
  });

  it("four-gore notation matches the shared decrease schedule", () => {
    const calc = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const setup = calc.fourWedgeCrownSetup!;
    const schedule = buildFourWedgeDecreaseSchedule(
      setup.wedgeStitchCount,
      calc.crownRowCount,
    );
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    if (schedule.decreaseCount > 0) {
      expect(svg).toContain(
        formatShapingSegment(1, schedule.rowFrequency, schedule.decreaseCount),
      );
    }
    expect(svg).toContain(`${schedule.remainingStitchesTotal} sts`);
  });

  it("spiral notation uses crownPlan.spiral values", () => {
    const calc = calcFor({ crown: "spiral" });
    const spiral = calc.crownPlan.spiral!;
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    if (spiral.gradual > 0) {
      expect(svg).toContain(
        formatShapingSegment(spiral.decreasePoints, 2, spiral.gradual),
      );
    }
    if (spiral.rapid > 0) {
      expect(svg).toContain(
        formatShapingSegment(spiral.decreasePoints, 1, spiral.rapid),
      );
    }
  });

  it("has no user-facing Japanese Notation wording", () => {
    const svg = buildHatShapingNotationDiagramSvg(
      withFourWedge(calcFor({ crown: "wedge-4-decrease" })),
      "inches",
      formatters,
    );
    expect(svg.toLowerCase()).not.toContain("japanese");
    expect(svg).toContain("shaping notation");
  });
});

describe("hat pattern page diagram wiring", () => {
  it("mounts tabs and both generators from the finished pattern script", () => {
    const pageScript = readFileSync(join(srcRoot, "scripts/hat-pattern-page.ts"), "utf8");
    const page = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");

    expect(pageScript).toContain("buildHatPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("initHatPatternDiagramTabs");
    expect(pageScript).toContain("buildHatPatternDiagramSvg");
    expect(pageScript).toContain("buildHatShapingNotationDiagramSvg");
    expect(pageScript).not.toContain("buildHatJapaneseNotationDiagramSvg");
    expect(pageScript).toContain("data-hat-diagram-tabs-mount");
    expect(pageScript).toContain("data-hat-diagram-shaping-host");
    expect(page).toContain("data-hat-diagram-tabs-mount");
    expect(page).not.toContain("data-hat-diagram-host");
  });
});
