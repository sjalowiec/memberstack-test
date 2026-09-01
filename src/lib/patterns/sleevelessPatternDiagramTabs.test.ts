import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";
import {
  SLEEVELESS_DIAGRAM_PANEL_TITLE,
  SLEEVELESS_DIAGRAM_TAB_SHAPING,
  SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
  SLEEVELESS_SHAPING_NOTATION_HELP_LABEL,
  SLEEVELESS_SHAPING_NOTATION_HELP_VIMEO_ID,
  activateSleevelessDiagramTab,
  buildSleevelessPatternDiagramTabsShellHtml,
  buildSleevelessShapingNotationHelpHtml,
  initSleevelessPatternDiagramTabs,
} from "./sleevelessPatternDiagramTabs";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function sampleTabsHtml(piece: "back" | "front" | "sleeve" = "front") {
  return buildSleevelessPatternDiagramTabsShellHtml({
    piece,
    stsRowsSrc: "/images/patterns/sleeveless/diagrams/diagram-front-v.svg",
    stsRowsAlt: "Sleeveless front piece diagram",
    shapingSrc: "/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg",
    shapingAlt: "Sleeveless front piece shaping notation diagram",
  });
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
  if (sel === "[data-sleeveless-diagram-tabs]") {
    return el.hasAttribute("data-sleeveless-diagram-tabs");
  }
  if (sel === "[data-sleeveless-diagram-tab]") {
    return el.hasAttribute("data-sleeveless-diagram-tab");
  }
  if (sel === "[data-sleeveless-diagram-panel]") {
    return el.hasAttribute("data-sleeveless-diagram-panel");
  }
  const tabMatch = sel.match(/^\[data-sleeveless-diagram-tab="([^"]+)"\]$/);
  if (tabMatch) return el.getAttribute("data-sleeveless-diagram-tab") === tabMatch[1];
  const panelMatch = sel.match(/^\[data-sleeveless-diagram-panel="([^"]+)"\]$/);
  if (panelMatch) return el.getAttribute("data-sleeveless-diagram-panel") === panelMatch[1];
  return false;
}

function buildTabsStubRoot(): StubEl {
  const root = makeStubEl("div", { "data-sleeveless-diagram-tabs": "" });
  const stsTab = makeStubEl("button", {
    "data-sleeveless-diagram-tab": SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
    "aria-selected": "true",
    tabindex: "0",
    role: "tab",
  });
  const shapingTab = makeStubEl("button", {
    "data-sleeveless-diagram-tab": SLEEVELESS_DIAGRAM_TAB_SHAPING,
    "aria-selected": "false",
    tabindex: "-1",
    role: "tab",
  });
  const stsPanel = makeStubEl("div", {
    "data-sleeveless-diagram-panel": SLEEVELESS_DIAGRAM_TAB_STS_ROWS,
    role: "tabpanel",
  });
  const shapingPanel = makeStubEl("div", {
    "data-sleeveless-diagram-panel": SLEEVELESS_DIAGRAM_TAB_SHAPING,
    role: "tabpanel",
    hidden: "",
  });
  root._children.push(stsTab, shapingTab, stsPanel, shapingPanel);
  return root;
}

describe("sleeveless pattern diagram tabs", () => {
  it("reuses the shared tab engine with Stitches & Rows selected by default", () => {
    const html = sampleTabsHtml();

    expect(html).toContain('role="tablist"');
    expect(html).toContain("pattern-diagram-tabs");
    expect(html).toContain('data-pattern-diagram-tab="sts-rows"');
    expect(html).toContain('data-pattern-diagram-panel="sts-rows"');
    expect(html).toContain('data-sleeveless-diagram-tab="sts-rows"');
    expect(html).toContain('data-sleeveless-diagram-panel="shaping-notation"');
    expect(html).toContain("Stitches &amp; Rows");
    expect(html).toContain("Shaping Notation");
    expect(html).not.toContain("Japanese Notation");
    expect(html).toMatch(
      /data-sleeveless-diagram-tab="sts-rows"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-sleeveless-diagram-tab="shaping-notation"[^>]*aria-selected="false"/,
    );
    expect(html).toMatch(
      /data-sleeveless-diagram-panel="shaping-notation"[^>]*\bhidden\b/,
    );
    expect(html).not.toMatch(
      /data-sleeveless-diagram-panel="sts-rows"[^>]*\bhidden\b/,
    );
    expect(html).not.toContain("data-sleeveless-back-diagram-mode-btn");
    expect(html).not.toContain("data-sleeveless-front-diagram-mode-btn");
    expect(html).not.toContain("sharedPanel");
  });

  it("mounts both existing SVG hosts up front", () => {
    const html = sampleTabsHtml("front");

    expect(html).toContain("data-sleeveless-diagram-sts-rows-host");
    expect(html).toContain("data-sleeveless-diagram-shaping-host");
    expect(html).toContain('data-sleeveless-front-diagram-mode="sts-rows"');
    expect(html).toContain('data-sleeveless-front-diagram-mode="shaping-notation"');
    expect(html).toContain("diagram-front-v.svg");
    expect(html).toContain("diagram-jp-front-v.svg");
    expect(html).toContain("data-sleeveless-diagram-enlarge");
    expect(html).toContain("sleeveless-piece-split__diagram-card");
    expect(html).toContain("fa-magnifying-glass");
    expect(html).toContain('aria-label="Enlarge diagram"');

    const backHtml = sampleTabsHtml("back");
    expect(backHtml).toContain("data-sleeveless-back-diagram");
    expect(backHtml).toContain('id="sleeveless-back-diagram-tab-sts-rows"');
    expect(backHtml).not.toContain('id="sleeveless-front-diagram-tab-sts-rows"');

    const sleeveHtml = sampleTabsHtml("sleeve");
    expect(sleeveHtml).toContain("data-sleeveless-sleeve-diagram");
    expect(sleeveHtml).toContain('data-sleeveless-sleeve-diagram-mode="sts-rows"');
    expect(sleeveHtml).toContain('data-sleeveless-sleeve-diagram-mode="shaping-notation"');
    expect(sleeveHtml).toContain('id="sleeveless-sleeve-diagram-tab-sts-rows"');
    expect(sleeveHtml).toContain("Sleeve diagram view");
    expect(sleeveHtml).not.toContain("data-sleeveless-front-diagram");
    expect(sleeveHtml).not.toContain("data-sleeveless-back-diagram");
  });

  it("only shows the selected tab panel on screen", () => {
    const root = buildTabsStubRoot();
    activateSleevelessDiagramTab(root as unknown as ParentNode, SLEEVELESS_DIAGRAM_TAB_SHAPING);

    const stsPanel = root.querySelector('[data-sleeveless-diagram-panel="sts-rows"]')!;
    const shapingPanel = root.querySelector(
      '[data-sleeveless-diagram-panel="shaping-notation"]',
    )!;
    expect(stsPanel.hasAttribute("hidden")).toBe(true);
    expect(shapingPanel.hasAttribute("hidden")).toBe(false);

    activateSleevelessDiagramTab(root as unknown as ParentNode, SLEEVELESS_DIAGRAM_TAB_STS_ROWS);
    expect(stsPanel.hasAttribute("hidden")).toBe(false);
    expect(shapingPanel.hasAttribute("hidden")).toBe(true);
  });

  it("supports keyboard switching between tabs", () => {
    const mount = makeStubEl("div");
    const root = buildTabsStubRoot();
    mount._children.push(root);
    initSleevelessPatternDiagramTabs(mount as unknown as ParentNode);

    const stsTab = root.querySelector('[data-sleeveless-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector(
      '[data-sleeveless-diagram-tab="shaping-notation"]',
    )!;

    stsTab.dispatchKey("ArrowRight");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    expect(
      root
        .querySelector('[data-sleeveless-diagram-panel="shaping-notation"]')!
        .hasAttribute("hidden"),
    ).toBe(false);

    shapingTab.dispatchKey("ArrowLeft");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");

    stsTab.dispatchKey("End");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");

    shapingTab.dispatchKey("Home");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("places shaping-notation help only in the Shaping Notation panel", () => {
    const html = sampleTabsHtml();
    const shapingStart = html.indexOf('data-sleeveless-diagram-panel="shaping-notation"');
    const stsStart = html.indexOf('data-sleeveless-diagram-panel="sts-rows"');
    expect(shapingStart).toBeGreaterThan(-1);
    expect(stsStart).toBeGreaterThan(-1);

    const shapingChunk = html.slice(shapingStart);
    const stsChunk = html.slice(stsStart, shapingStart);
    expect(shapingChunk).toContain(SLEEVELESS_SHAPING_NOTATION_HELP_LABEL);
    expect(shapingChunk).toContain(
      `data-sleeveless-video-id="${SLEEVELESS_SHAPING_NOTATION_HELP_VIMEO_ID}"`,
    );
    expect(stsChunk).not.toContain("data-sleeveless-diagram-shaping-help");
    expect(SLEEVELESS_SHAPING_NOTATION_HELP_VIMEO_ID).toBe(
      SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
    );
    expect(buildSleevelessShapingNotationHelpHtml()).toContain("sleeveless-pattern-diagram-shaping-help");
  });

  it("keeps the Sleeveless page on the shared tab CSS and Hat unchanged", () => {
    const page = readFileSync(
      join(srcRoot, "pages/patterns/sleeveless/pattern/index.astro"),
      "utf8",
    );
    const hatPage = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");
    const hatScript = readFileSync(join(srcRoot, "scripts/hat-pattern-page.ts"), "utf8");
    const tabsCss = readFileSync(
      join(srcRoot, "styles/patterns/pattern-diagram-tabs.css"),
      "utf8",
    );

    expect(page).toContain("pattern-diagram-tabs.css");
    expect(hatPage).toContain("data-hat-diagram-tabs-mount");
    expect(hatPage).toContain("Hat Dimensions");
    expect(hatScript).toContain("buildHatPatternDiagramTabsShellHtml");
    expect(hatScript).toContain("initHatPatternDiagramTabs");
    expect(tabsCss).toContain("flex: 1 1 50%");
    expect(tabsCss).not.toContain("flex-wrap: wrap");
    expect(SLEEVELESS_DIAGRAM_PANEL_TITLE).toBe("Garment Dimensions");
  });
});
