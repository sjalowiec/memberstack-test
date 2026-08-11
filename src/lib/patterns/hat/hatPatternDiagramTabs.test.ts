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
  formatFourGoreShapingNotationSegment,
  formatHatShapingCastOnLabel,
  formatHatShapingRcLabel,
  formatHatShapingStitchCountLabel,
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
    // Injected tab shell is not Astro-scoped — styles must be :global to reach it.
    expect(page).toContain(":global(.hat-pattern-diagram-tabs__tab)");
    expect(page).toContain(":global(.hat-pattern-diagram-tabs__list)");
    expect(page).toContain(":global(.hat-pattern-diagram-shaping-help__btn.kbm-btn)");
    expect(page).toContain("min-height: 44px");
    expect(page).toContain("font-size: 1rem");
    expect(page).toContain("var(--kbm-green, #52682d)");
    expect(page).toContain("flex: 1 1 0");
    expect(page).toMatch(
      /:global\(\.hat-pattern-diagram-tabs__tab:focus-visible\)\s*\{[^}]*outline:\s*2px solid/,
    );
    expect(page).toMatch(
      /@media \(max-width: 767px\)[\s\S]*:global\(\.hat-pattern-diagram-shaping-help__btn\.kbm-btn\)\s*\{[^}]*width:\s*100%/,
    );
    expect(page).not.toContain("Japanese Notation");

    const helpHtml = buildHatShapingNotationHelpHtml();
    expect(helpHtml).toContain("kbm-btn");
    expect(helpHtml).toContain("kbm-btn-outline");
    expect(helpHtml).toContain("kbm-kin-catalog-video");
    expect(helpHtml).toContain("fa-circle-info");
    expect(helpHtml).toContain(`<span>${HAT_SHAPING_NOTATION_HELP_LABEL}</span>`);
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
    expect(wedge).not.toContain("each edge of each gore");
    expect(wedge).not.toContain("Decrease 1 stitch");
    expect(wedge).not.toContain("4×");

    expect(spiral).toContain('data-crown="spiral"');
    expect(spiral).toContain("hat-shaping-diagram__crown--swirl");
    expect(spiral).toContain(`data-swirl-section-count="${spiralPlan.decreasePoints}"`);
    expect(spiral).toContain('data-swirl-decrease-edge="trailing"');
    expect(spiral).toContain(`>${spiralPlan.decreasePoints} sections<`);
    expect(spiral).toContain("decrease at one edge");
    expect(spiral).toContain("hat-shaping-diagram__swirl-instruction-icon");
    expect(spiral).toContain("/icons/patterns/transfer-step.svg");
    expect(spiral.match(/class="hat-shaping-diagram__swirl-instruction-icon"/g)?.length).toBe(1);
    expect(spiral.match(/class="hat-shaping-diagram__swirl-section"/g)?.length).toBe(
      spiralPlan.decreasePoints,
    );
    expect(spiral).toContain('data-swirl-representative="true"');
    expect(spiral).toContain('fill="#eef3e6"');
    expect(spiral).not.toContain(`${spiralPlan.decreasePoints} pts`);
    expect(spiral).not.toMatch(/Q [\d.]+ [\d.]+ [\d.]+ [\d.]+/); // no centered quadratic crown wedges
    // Per-section schedule (representative wedge), not whole-crown totals.
    const perSectionEnd = Math.round(
      spiralPlan.targetStitches / spiralPlan.decreasePoints,
    );
    expect(spiral).toContain(`>${formatHatShapingStitchCountLabel(perSectionEnd)}<`);
    expect(spiral).not.toContain(`→ ${formatHatShapingStitchCountLabel(perSectionEnd)}`);
    expect(spiral).not.toContain(`→ ${spiralPlan.targetStitches} sts`);
    if (spiralPlan.gradual > 0) {
      expect(spiral).toContain(formatShapingSegment(1, 2, spiralPlan.gradual));
      expect(spiral).not.toContain(
        formatShapingSegment(spiralPlan.decreasePoints, 2, spiralPlan.gradual),
      );
    }
    if (spiralPlan.rapid > 0) {
      expect(spiral).toContain(formatShapingSegment(1, 1, spiralPlan.rapid));
      expect(spiral).not.toContain(
        formatShapingSegment(spiralPlan.decreasePoints, 1, spiralPlan.rapid),
      );
    }
    // Four-gore / gathered stay free of swirl construction cues.
    expect(gathered).not.toContain("hat-shaping-diagram__swirl-section");
    expect(gathered).not.toContain("decrease at one edge");
    expect(wedge).not.toContain("hat-shaping-diagram__swirl-section");
    expect(wedge).not.toContain("decrease at one edge");
  });

  it("swirl shaping notation uses one-sided trailing decrease edges", () => {
    const calc = calcFor({ crown: "spiral" });
    const spiralPlan = calc.crownPlan.spiral!;
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    for (let i = 1; i <= spiralPlan.decreasePoints; i += 1) {
      expect(svg).toMatch(
        new RegExp(
          `hat-shaping-diagram__swirl-section"[^>]*data-section-index="${i}"[^>]*data-decrease-edge="trailing"[^>]*data-non-decrease-edge="leading"`,
        ),
      );
    }
    expect(svg).not.toContain("hat-diagram__swirl-decrease-marker");
    expect(svg).toContain('data-swirl-label-placement="above-crown"');
    expect(svg).toContain('data-hat-shaping-swirl-schedule="true"');
  });

  it("swirl shaping notation shows per-section schedule for the representative wedge", () => {
    const calc = calcFor({ crown: "spiral" });
    const spiral = calc.crownPlan.spiral!;
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    expect(spiral.decreasePoints).toBeGreaterThan(0);
    const gradual = spiral.gradual > 0 ? formatShapingSegment(1, 2, spiral.gradual) : "";
    const rapid = spiral.rapid > 0 ? formatShapingSegment(1, 1, spiral.rapid) : "";
    if (gradual) {
      expect(svg).toContain(gradual);
      expect(svg).not.toContain(
        formatShapingSegment(spiral.decreasePoints, 2, spiral.gradual),
      );
    }
    if (rapid) {
      expect(svg).toContain(rapid);
      expect(svg).not.toContain(
        formatShapingSegment(spiral.decreasePoints, 1, spiral.rapid),
      );
    }
    const perSectionEnd = Math.round(spiral.targetStitches / spiral.decreasePoints);
    expect(perSectionEnd).toBe(1);
    const endLabel = formatHatShapingStitchCountLabel(perSectionEnd);
    expect(svg).toContain(`>${endLabel}<`);
    expect(svg).not.toMatch(/→\s*1 st/);
    expect(svg).not.toContain(`→ ${spiral.targetStitches} sts`);
    expect(svg).not.toContain("→ 6 sts");

    const tipY = Number(
      svg.match(
        /data-swirl-representative="true"[^>]*d="M [\d.]+ [\d.]+ L [\d.]+ ([\d.]+)/,
      )?.[1] ??
        svg.match(
          /hat-shaping-diagram__swirl-section"[^>]*data-section-index="2"[^>]*data-decrease-y1="([\d.]+)"/,
        )?.[1],
    );
    const bodyTop = Number(
      svg.match(/hat-shaping-diagram__crown-start"[^>]*y1="([\d.]+)"/)?.[1],
    );
    const bodyLabelY = Number(
      svg.match(/hat-shaping-diagram__body-label"[^>]*y="([\d.]+)"/)?.[1],
    );
    expect(tipY).toBeGreaterThan(0);
    expect(bodyTop).toBeGreaterThan(tipY);
    expect(bodyLabelY).toBeGreaterThan(bodyTop);

    const yFor = (role: string, text: string) => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `data-swirl-schedule-role="${role}"[^>]*y="([\\d.]+)"[^>]*>${escaped}<`,
      );
      const m = svg.match(re);
      expect(m, `missing ${role} label`).toBeTruthy();
      return Number(m![1]);
    };
    expect(svg).toContain('data-swirl-schedule-order="bottom-up"');
    expect(svg).toContain('data-swirl-end-placement="above-tip"');
    expect(svg).toContain('data-swirl-schedule-placement="body"');

    const endY = yFor("end", endLabel);
    // Final count sits above the representative tip, outside the wedge,
    // with clear space below the construction cue.
    const instructionY = Number(
      svg.match(/hat-shaping-diagram__swirl-instruction-text"[^>]*y="([\d.]+)"/)?.[1],
    );
    expect(instructionY).toBeGreaterThan(0);
    expect(endY).toBeGreaterThan(instructionY + 8);
    expect(endY).toBeLessThan(tipY - 6);

    const iconX = Number(
      svg.match(/hat-shaping-diagram__swirl-instruction-icon"[^>]*x="([\d.]+)"/)?.[1],
    );
    const iconW = Number(
      svg.match(
        /hat-shaping-diagram__swirl-instruction-icon"[^>]*width="([\d.]+)"/,
      )?.[1],
    );
    const textX = Number(
      svg.match(/hat-shaping-diagram__swirl-instruction-text"[^>]*x="([\d.]+)"/)?.[1],
    );
    expect(textX - (iconX + iconW)).toBeGreaterThanOrEqual(8);

    if (rapid) {
      const rapidY = yFor("rapid", rapid);
      expect(rapidY).toBeGreaterThan(bodyTop);
      expect(rapidY).toBeLessThan(bodyLabelY);
      if (gradual) {
        const gradualY = yFor("gradual", gradual);
        expect(gradualY).toBeGreaterThan(bodyTop);
        expect(gradualY).toBeLessThan(bodyLabelY);
        // Bottom-up: gradual lowest, rapid above it; both in Body below crown.
        expect(rapidY).toBeLessThan(gradualY);
        expect(endY).toBeLessThan(rapidY);
      }
    } else if (gradual) {
      const gradualY = yFor("gradual", gradual);
      expect(gradualY).toBeGreaterThan(bodyTop);
      expect(gradualY).toBeLessThan(bodyLabelY);
      expect(endY).toBeLessThan(gradualY);
    }

    // No schedule sequences inside the crown band (between tip and base).
    if (rapid) {
      const rapidY = yFor("rapid", rapid);
      expect(rapidY < tipY || rapidY > bodyTop).toBe(true);
      expect(rapidY).toBeGreaterThan(bodyTop);
    }
    if (gradual) {
      const gradualY = yFor("gradual", gradual);
      expect(gradualY).toBeGreaterThan(bodyTop);
    }
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

  it("four-gore notation shows shared schedule and one representative gore stitch pair", () => {
    const calc = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const setup = calc.fourWedgeCrownSetup!;
    const schedule = buildFourWedgeDecreaseSchedule(
      setup.wedgeStitchCount,
      calc.crownRowCount,
    );
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const startLabel = formatHatShapingStitchCountLabel(setup.wedgeStitchCount);
    const endLabel = formatHatShapingStitchCountLabel(schedule.finalWedgeStitchCount);
    const segment = formatFourGoreShapingNotationSegment(schedule);
    const expectedSegment = formatShapingSegment(
      1,
      schedule.rowFrequency,
      schedule.decreaseCount,
    );

    expect(schedule.decreaseCount).toBeGreaterThan(0);
    expect(segment).toBe(expectedSegment);
    expect(svg).toContain(expectedSegment);
    // Shared schedule appears once above the crown.
    expect(svg.match(new RegExp(expectedSegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).toHaveLength(1);
    expect(svg.match(/data-hat-shaping-schedule="true"/g) ?? []).toHaveLength(1);
    expect(svg).not.toContain("Decrease 1 stitch");
    expect(svg).not.toContain("each edge of each gore");

    // Start/end stitch counts once on the same representative gore.
    expect(svg.match(/data-gore-start-sts="true"/g) ?? []).toHaveLength(1);
    expect(svg.match(/data-gore-end-sts="true"/g) ?? []).toHaveLength(1);
    expect(svg.match(new RegExp(`>${startLabel}<`, "g")) ?? []).toHaveLength(1);
    expect(svg.match(new RegExp(`>${endLabel}<`, "g")) ?? []).toHaveLength(1);
    expect(svg).toMatch(
      new RegExp(
        `data-gore="(\\d+)" data-gore-end-sts="true" data-gore-representative="true"[^>]*>${endLabel.replace(/\s/g, "\\s")}<`,
      ),
    );
    const endGore = svg.match(
      /data-gore="(\d+)" data-gore-end-sts="true" data-gore-representative="true"/,
    )?.[1];
    const startGore = svg.match(
      /data-gore="(\d+)" data-gore-start-sts="true" data-gore-representative="true"/,
    )?.[1];
    expect(endGore).toBeTruthy();
    expect(startGore).toBe(endGore);
    expect(endGore).toBe("2");

    // Representative gore #2 is shaded; schedule/start/end share its centerline.
    expect(svg).toContain('class="hat-shaping-diagram__gore-fill"');
    expect(svg).toMatch(
      /hat-shaping-diagram__gore-fill"[^>]*data-gore="2"[^>]*data-gore-representative="true"[^>]*fill="#eef3e6"/,
    );
    expect(svg).toContain(`fill="${"#ffffff"}"`);
    const scheduleX = svg.match(
      /data-hat-shaping-schedule="true" x="([\d.]+)"/,
    )?.[1];
    const endX = svg.match(
      /data-gore-end-sts="true"[^>]*x="([\d.]+)"/,
    )?.[1];
    const startX = svg.match(
      /data-gore-start-sts="true"[^>]*x="([\d.]+)"/,
    )?.[1];
    expect(scheduleX).toBeTruthy();
    expect(endX).toBe(scheduleX);
    expect(startX).toBe(scheduleX);

    // All four gore identifiers remain.
    for (const n of [1, 2, 3, 4]) {
      expect(svg).toMatch(
        new RegExp(`hat-shaping-diagram__gore-number" data-gore="${n}"[^>]*>#${n}<`),
      );
    }
    expect(svg.match(/hat-shaping-diagram__gore-number"/g) ?? []).toHaveLength(4);

    expect(svg).not.toContain(`4× ${setup.wedgeStitchCount}`);
    expect(svg).not.toContain(`${startLabel} / gore`);
    expect(svg).not.toContain(`→ ${schedule.remainingStitchesTotal} sts`);
  });

  it("formats four-gore stitch labels with correct singular and plural", () => {
    expect(formatHatShapingStitchCountLabel(1)).toBe("1 st");
    expect(formatHatShapingStitchCountLabel(2)).toBe("2 sts");
    expect(formatHatShapingStitchCountLabel(21)).toBe("21 sts");

    const oddWedge = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const oddSchedule = buildFourWedgeDecreaseSchedule(
      oddWedge.fourWedgeCrownSetup!.wedgeStitchCount,
      oddWedge.crownRowCount,
    );
    // Default fixture ends at 1 st per gore when wedge count is odd.
    expect(oddSchedule.finalWedgeStitchCount).toBe(1);
    const oddSvg = buildHatShapingNotationDiagramSvg(oddWedge, "inches", formatters);
    expect(oddSvg).toContain(">1 st<");
    expect(oddSvg).not.toContain(">1 sts<");
    expect(oddSvg.match(/>1 st</g) ?? []).toHaveLength(1);

    const evenWedge = withFourWedge(
      calcFor({
        crown: "wedge-4-decrease",
        finishedHatCircInches: 22,
        stitchGaugeDisplay: 4,
        rowGaugeDisplay: 6,
        suggestedCrownDepthInches: 3,
      }),
    );
    const evenSchedule = buildFourWedgeDecreaseSchedule(
      evenWedge.fourWedgeCrownSetup!.wedgeStitchCount,
      evenWedge.crownRowCount,
    );
    const evenSvg = buildHatShapingNotationDiagramSvg(evenWedge, "inches", formatters);
    const evenEnd = formatHatShapingStitchCountLabel(evenSchedule.finalWedgeStitchCount);
    expect(evenSvg).toContain(`>${evenEnd}<`);
    if (evenSchedule.finalWedgeStitchCount === 1) {
      expect(evenSvg).toContain(">1 st<");
    } else {
      expect(evenSvg).toContain(">2 sts<");
      expect(evenSvg).not.toContain(">2 st<");
    }
  });

  it("four-gore per-gore labels follow different calculated stitch counts", () => {
    const small = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const large = withFourWedge(
      calcFor({
        crown: "wedge-4-decrease",
        finishedHatCircInches: 22,
        stitchGaugeDisplay: 4,
        rowGaugeDisplay: 6,
        suggestedCrownDepthInches: 3,
      }),
    );
    const smallSetup = small.fourWedgeCrownSetup!;
    const largeSetup = large.fourWedgeCrownSetup!;
    expect(Math.round(smallSetup.wedgeStitchCount)).not.toBe(
      Math.round(largeSetup.wedgeStitchCount),
    );

    const smallSchedule = buildFourWedgeDecreaseSchedule(
      smallSetup.wedgeStitchCount,
      small.crownRowCount,
    );
    const largeSchedule = buildFourWedgeDecreaseSchedule(
      largeSetup.wedgeStitchCount,
      large.crownRowCount,
    );

    const smallSvg = buildHatShapingNotationDiagramSvg(small, "inches", formatters);
    const largeSvg = buildHatShapingNotationDiagramSvg(large, "inches", formatters);

    const smallStart = formatHatShapingStitchCountLabel(smallSetup.wedgeStitchCount);
    const largeStart = formatHatShapingStitchCountLabel(largeSetup.wedgeStitchCount);
    const smallEnd = formatHatShapingStitchCountLabel(smallSchedule.finalWedgeStitchCount);
    const largeEnd = formatHatShapingStitchCountLabel(largeSchedule.finalWedgeStitchCount);
    const smallSeg = formatFourGoreShapingNotationSegment(smallSchedule);
    const largeSeg = formatFourGoreShapingNotationSegment(largeSchedule);

    expect(smallSeg).toBe(
      formatShapingSegment(1, smallSchedule.rowFrequency, smallSchedule.decreaseCount),
    );
    expect(largeSeg).toBe(
      formatShapingSegment(1, largeSchedule.rowFrequency, largeSchedule.decreaseCount),
    );
    expect(smallSvg).toContain(smallSeg);
    expect(largeSvg).toContain(largeSeg);
    expect(smallSeg).not.toBe(largeSeg);

    expect(smallSvg).toContain(smallStart);
    expect(largeSvg).toContain(largeStart);
    expect(smallSvg).toContain(smallEnd);
    expect(largeSvg).toContain(largeEnd);
    expect(smallSvg).not.toContain(largeStart);
    expect(largeSvg).not.toContain(smallStart);

    expect(smallSvg.match(/data-gore-start-sts="true"/g) ?? []).toHaveLength(1);
    expect(largeSvg.match(/data-gore-start-sts="true"/g) ?? []).toHaveLength(1);
    expect(smallSvg.match(/data-gore-end-sts="true"/g) ?? []).toHaveLength(1);
    expect(largeSvg.match(/data-gore-end-sts="true"/g) ?? []).toHaveLength(1);
    expect(smallSvg.match(/data-hat-shaping-schedule="true"/g) ?? []).toHaveLength(1);
    expect(largeSvg.match(/data-hat-shaping-schedule="true"/g) ?? []).toHaveLength(1);
    expect(smallSvg.match(/hat-shaping-diagram__gore-number"/g) ?? []).toHaveLength(4);
    expect(largeSvg.match(/hat-shaping-diagram__gore-number"/g) ?? []).toHaveLength(4);

    expect(smallSvg).not.toContain("Decrease 1 stitch");
    expect(largeSvg).not.toContain("Decrease 1 stitch");
    expect(smallSvg).not.toContain(`→ ${smallSchedule.remainingStitchesTotal} sts`);
    expect(largeSvg).not.toContain(`→ ${largeSchedule.remainingStitchesTotal} sts`);
  });

  it("spiral notation uses crownPlan.spiral values", () => {
    const calc = calcFor({ crown: "spiral" });
    const spiral = calc.crownPlan.spiral!;
    const svg = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    // Diagram shows per-section tokens; times still come from the shared schedule.
    if (spiral.gradual > 0) {
      expect(svg).toContain(formatShapingSegment(1, 2, spiral.gradual));
    }
    if (spiral.rapid > 0) {
      expect(svg).toContain(formatShapingSegment(1, 1, spiral.rapid));
    }
    expect(svg).toContain(
      `>${formatHatShapingStitchCountLabel(
        Math.round(spiral.targetStitches / spiral.decreasePoints),
      )}<`,
    );
    expect(svg).not.toMatch(/→\s*\d+\s*sts?/);
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
