import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../../glossary/shapingNotationGlossary";
import { formatBodyRowsNotation, formatCastOnNotation } from "../sleevelessBackJapaneseNotation";
import { formatShapingSegment } from "../shapingNotationCompress";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildFourWedgeDecreaseSchedule,
  calculateHatPattern,
} from "./hatMath";
import {
  buildHatJapaneseNotationDiagramSvg,
  HAT_JAPANESE_NOTATION_VIEWBOX,
} from "./hatJapaneseNotationDiagramSvg";
import {
  HAT_JAPANESE_NOTATION_HELP_LABEL,
  HAT_JAPANESE_NOTATION_HELP_VIMEO_ID,
  buildHatJapaneseNotationHelpHtml,
} from "./hatJapaneseNotationHelp";
import {
  HAT_DIAGRAM_TAB_JAPANESE,
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
      toggle(name: string, force?: boolean) {
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
  const jpTab = makeStubEl("button", {
    "data-hat-diagram-tab": HAT_DIAGRAM_TAB_JAPANESE,
    "aria-selected": "false",
    tabindex: "-1",
    role: "tab",
  });
  const stsPanel = makeStubEl("div", {
    "data-hat-diagram-panel": HAT_DIAGRAM_TAB_STS_ROWS,
    role: "tabpanel",
  });
  const jpPanel = makeStubEl("div", {
    "data-hat-diagram-panel": HAT_DIAGRAM_TAB_JAPANESE,
    role: "tabpanel",
    hidden: "",
  });
  root._children.push(stsTab, jpTab, stsPanel, jpPanel);
  return root;
}

describe("hat pattern diagram tabs", () => {
  it("renders both tabs with Stitches & Rows selected by default", () => {
    const html = buildHatPatternDiagramTabsShellHtml();

    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-testid="hat-diagram-tab-sts-rows"');
    expect(html).toContain('data-testid="hat-diagram-tab-japanese"');
    expect(html).toContain('aria-controls="hat-diagram-panel-sts-rows"');
    expect(html).toContain('aria-controls="hat-diagram-panel-japanese"');
    expect(html).toMatch(
      /data-hat-diagram-tab="sts-rows"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-hat-diagram-tab="japanese"[^>]*aria-selected="false"/,
    );
    expect(html).toContain('data-hat-diagram-panel="sts-rows"');
    expect(html).toContain('data-hat-diagram-panel="japanese"');
    expect(html).toMatch(
      /data-hat-diagram-panel="japanese"[^>]*\bhidden\b/,
    );
    expect(html).not.toMatch(
      /data-hat-diagram-panel="sts-rows"[^>]*\bhidden\b/,
    );
  });

  it("only shows the selected tab panel on screen", () => {
    const root = buildTabsStubRoot();
    activateHatDiagramTab(root as unknown as ParentNode, HAT_DIAGRAM_TAB_JAPANESE);

    const stsPanel = root.querySelector('[data-hat-diagram-panel="sts-rows"]')!;
    const jpPanel = root.querySelector('[data-hat-diagram-panel="japanese"]')!;
    const stsTab = root.querySelector('[data-hat-diagram-tab="sts-rows"]')!;
    const jpTab = root.querySelector('[data-hat-diagram-tab="japanese"]')!;

    expect(stsPanel.hasAttribute("hidden")).toBe(true);
    expect(jpPanel.hasAttribute("hidden")).toBe(false);
    expect(stsTab.getAttribute("aria-selected")).toBe("false");
    expect(jpTab.getAttribute("aria-selected")).toBe("true");
    expect(jpTab.tabIndex).toBe(0);
    expect(stsTab.tabIndex).toBe(-1);

    activateHatDiagramTab(root as unknown as ParentNode, HAT_DIAGRAM_TAB_STS_ROWS);
    expect(stsPanel.hasAttribute("hidden")).toBe(false);
    expect(jpPanel.hasAttribute("hidden")).toBe(true);
  });

  it("supports keyboard switching between tabs", () => {
    const mount = makeStubEl("div");
    const root = buildTabsStubRoot();
    mount._children.push(root);
    initHatPatternDiagramTabs(mount as unknown as ParentNode);

    const stsTab = root.querySelector('[data-hat-diagram-tab="sts-rows"]')!;
    const jpTab = root.querySelector('[data-hat-diagram-tab="japanese"]')!;

    stsTab.dispatchKey("ArrowRight");
    expect(jpTab.getAttribute("aria-selected")).toBe("true");
    expect(root.querySelector('[data-hat-diagram-panel="japanese"]')!.hasAttribute("hidden")).toBe(
      false,
    );

    jpTab.dispatchKey("ArrowLeft");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");

    stsTab.dispatchKey("End");
    expect(jpTab.getAttribute("aria-selected")).toBe("true");

    jpTab.dispatchKey("Home");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("places the Japanese-notation help only in the Japanese panel", () => {
    const html = buildHatPatternDiagramTabsShellHtml();
    const jpStart = html.indexOf('data-hat-diagram-panel="japanese"');
    const stsStart = html.indexOf('data-hat-diagram-panel="sts-rows"');
    expect(jpStart).toBeGreaterThan(-1);
    expect(stsStart).toBeGreaterThan(-1);

    const jpChunk = html.slice(jpStart);
    const stsChunk = html.slice(stsStart, jpStart);
    expect(jpChunk).toContain(HAT_JAPANESE_NOTATION_HELP_LABEL);
    expect(jpChunk).toContain(`data-vimeo-id="${HAT_JAPANESE_NOTATION_HELP_VIMEO_ID}"`);
    expect(stsChunk).not.toContain("data-hat-japanese-notation-help");
    expect(HAT_JAPANESE_NOTATION_HELP_VIMEO_ID).toBe(SHAPING_NOTATION_CHART_HELP_VIMEO_ID);
    expect(buildHatJapaneseNotationHelpHtml()).toContain("kbm-kin-catalog-video");
  });

  it("print markup includes both labeled diagrams and excludes interactive chrome classes", () => {
    const html = buildHatPatternDiagramTabsShellHtml();
    expect(html).toContain('class="hat-pattern-diagram-tabs__list no-print"');
    expect(html).toContain("hat-pattern-diagram-jp-help no-print");
    expect(html).toContain(
      '<h3 class="hat-pattern-diagram-print-heading">Stitches &amp; Rows</h3>',
    );
    expect(html).toContain(
      '<h3 class="hat-pattern-diagram-print-heading">Japanese Notation</h3>',
    );

    const page = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");
    expect(page).toContain(".hat-pattern-diagram-tabs__panel[hidden]");
    expect(page).toContain("display: block !important");
    expect(page).toContain(".hat-pattern-diagram-print-heading");
    expect(page).toContain(".hat-pattern-diagram-tabs__list");
    expect(page).toContain(".hat-pattern-diagram-jp-help");
  });
});

describe("buildHatJapaneseNotationDiagramSvg", () => {
  it("uses a stable viewBox and preserveAspectRatio distinct from Stitches & Rows", () => {
    const calc = calcFor();
    const jp = buildHatJapaneseNotationDiagramSvg(calc, "inches", formatters);
    const sts = buildHatPatternDiagramSvg(calc, "inches", formatters);

    expect(jp).toContain(
      `viewBox="0 0 ${HAT_JAPANESE_NOTATION_VIEWBOX.width} ${HAT_JAPANESE_NOTATION_VIEWBOX.height}"`,
    );
    expect(jp).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(jp).toContain('width="100%"');
    expect(jp).toContain('height="auto"');
    expect(jp).toContain('data-hat-japanese-diagram="true"');
    expect(jp).not.toContain('data-hat-diagram="true"');
    expect(sts).toContain('data-hat-diagram="true"');
    expect(sts).toContain('viewBox="0 0 430 460"');
    expect(jp).not.toContain('viewBox="0 0 430 460"');
  });

  it("reuses finalized calc stitch/row math and shared notation formatters", () => {
    const calc = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown);
    const svg = buildHatJapaneseNotationDiagramSvg(calc, "inches", formatters);

    expect(svg).toContain(formatCastOnNotation(patternCastOn));
    expect(svg).toContain(formatBodyRowsNotation(calc.brimRows));
    expect(svg).toContain(formatBodyRowsNotation(calc.bodyRows));
    expect(svg).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(svg).toContain(formatLengthWithUnit(calc.targetWidth, "inches"));
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("changes structure for each crown style", () => {
    const gathered = buildHatJapaneseNotationDiagramSvg(
      calcFor({ crown: "gathered" }),
      "inches",
      formatters,
    );
    const wedge = buildHatJapaneseNotationDiagramSvg(
      withFourWedge(calcFor({ crown: "wedge-4-decrease" })),
      "inches",
      formatters,
    );
    const spiral = buildHatJapaneseNotationDiagramSvg(
      calcFor({ crown: "spiral" }),
      "inches",
      formatters,
    );

    expect(gathered).toContain('data-crown="gathered"');
    expect(gathered).toContain("EO xfer");
    expect(gathered).toContain("gather");
    expect(gathered).not.toContain("hat-jp-diagram__crown--four-gore");

    expect(wedge).toContain('data-crown="wedge-4-decrease"');
    expect(wedge).toContain("hat-jp-diagram__crown--four-gore");
    expect(wedge).toContain(">#1<");
    expect(wedge).toContain("ea edge");

    expect(spiral).toContain('data-crown="spiral"');
    expect(spiral).toContain("hat-jp-diagram__crown--swirl");
    expect(spiral).toContain("6 pts");
    expect(spiral).toContain("→ 6 sts");
  });

  it("represents each brim type", () => {
    const single = buildHatJapaneseNotationDiagramSvg(
      calcFor({ brimType: "single" }),
      "inches",
      formatters,
    );
    const folded = buildHatJapaneseNotationDiagramSvg(
      calcFor({ brimType: "folded" }),
      "inches",
      formatters,
    );
    const rolled = buildHatJapaneseNotationDiagramSvg(
      calcFor({ brimType: "rolled" }),
      "inches",
      formatters,
    );

    expect(single).toContain('data-brim="single"');
    expect(single).toContain("Single Layer");
    expect(folded).toContain('data-brim="folded"');
    expect(folded).toContain("Folded Hem");
    expect(folded).toContain("hat-jp-diagram__brim-fold");
    expect(rolled).toContain('data-brim="rolled"');
    expect(rolled).toContain("Rolled Brim");
    expect(rolled).toContain("hat-jp-diagram__brim-roll");
  });

  it("reflects named vs custom sizes and lengths in displayed measurements", () => {
    const adult = buildHatJapaneseNotationDiagramSvg(
      calcFor({ finishedHatCircInches: 22, totalHatLengthInches: 9 }),
      "inches",
      formatters,
    );
    const custom = buildHatJapaneseNotationDiagramSvg(
      calcFor({
        finishedHatCircInches: 18.5,
        totalHatLengthInches: 7.25,
        fit: "custom",
      }),
      "inches",
      formatters,
    );

    expect(adult).toContain(formatLengthWithUnit(22, "inches"));
    expect(adult).toContain(formatLengthWithUnit(9, "inches"));
    expect(custom).toContain(formatLengthWithUnit(18.5, "inches"));
    expect(custom).toContain(formatLengthWithUnit(7.25, "inches"));
    expect(adult).not.toContain(formatLengthWithUnit(18.5, "inches"));
  });

  it("unit switching changes displayed measurements without changing stitch/row notation", () => {
    const calc = calcFor();
    const inches = buildHatJapaneseNotationDiagramSvg(calc, "inches", formatters);
    const cm = buildHatJapaneseNotationDiagramSvg(calc, "cm", formatters);
    const castOn = formatCastOnNotation(
      applyHatCrownCastOnAdjustment(calc.castOnSts, calc.crown),
    );
    const bodyRows = formatBodyRowsNotation(calc.bodyRows);

    expect(inches).toContain(castOn);
    expect(cm).toContain(castOn);
    expect(inches).toContain(bodyRows);
    expect(cm).toContain(bodyRows);
    expect(inches).toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
    expect(cm).toContain(
      formatLengthWithUnit(convertLength(calc.hatHeight, "inches", "cm"), "cm"),
    );
    expect(cm).not.toContain(formatLengthWithUnit(calc.hatHeight, "inches"));
  });

  it("four-gore notation matches the shared decrease schedule", () => {
    const calc = withFourWedge(calcFor({ crown: "wedge-4-decrease" }));
    const setup = calc.fourWedgeCrownSetup!;
    const schedule = buildFourWedgeDecreaseSchedule(
      setup.wedgeStitchCount,
      calc.crownRowCount,
    );
    const svg = buildHatJapaneseNotationDiagramSvg(calc, "inches", formatters);
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
    const svg = buildHatJapaneseNotationDiagramSvg(calc, "inches", formatters);
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
});

describe("hat pattern page diagram wiring", () => {
  it("mounts tabs and both generators from the finished pattern script", () => {
    const pageScript = readFileSync(join(srcRoot, "scripts/hat-pattern-page.ts"), "utf8");
    const page = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");

    expect(pageScript).toContain("buildHatPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("initHatPatternDiagramTabs");
    expect(pageScript).toContain("buildHatPatternDiagramSvg");
    expect(pageScript).toContain("buildHatJapaneseNotationDiagramSvg");
    expect(pageScript).toContain("data-hat-diagram-tabs-mount");
    expect(page).toContain("data-hat-diagram-tabs-mount");
    expect(page).not.toContain("data-hat-diagram-host");
  });
});
