import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";
import {
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID,
  buildPatternDiagramShapingNotationHelpHtml,
} from "./patternDiagramShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
} from "./patternDiagramTabs";
import {
  SIDEWAYS_DIAGRAM_PANEL_TITLE,
  SIDEWAYS_DIAGRAM_TAB_SHAPING,
  SIDEWAYS_DIAGRAM_TAB_STS_ROWS,
  activateSidewaysDiagramTab,
  buildSidewaysCardiganPatternDiagramTabsShellHtml,
  initSidewaysCardiganPatternDiagramTabs,
} from "./sidewaysCardiganPatternDiagramTabs";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Minimal ParentNode stub — suite runs without jsdom. */
type StubEl = {
  tagName: string;
  id: string;
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
    id: attrs.id ?? "",
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
      if (name === "id") el.id = value;
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
  if (sel === "[data-sideways-diagram-tabs]") return el.hasAttribute("data-sideways-diagram-tabs");
  if (sel === "[data-sideways-diagram-tab]") return el.hasAttribute("data-sideways-diagram-tab");
  if (sel === "[data-sideways-diagram-panel]") return el.hasAttribute("data-sideways-diagram-panel");
  const tabMatch = sel.match(/^\[data-sideways-diagram-tab="([^"]+)"\]$/);
  if (tabMatch) return el.getAttribute("data-sideways-diagram-tab") === tabMatch[1];
  const panelMatch = sel.match(/^\[data-sideways-diagram-panel="([^"]+)"\]$/);
  if (panelMatch) return el.getAttribute("data-sideways-diagram-panel") === panelMatch[1];
  return false;
}

function buildTabsStubRoot(): StubEl {
  const root = makeStubEl("div", { "data-sideways-diagram-tabs": "" });
  const stsTab = makeStubEl("button", {
    "data-sideways-diagram-tab": SIDEWAYS_DIAGRAM_TAB_STS_ROWS,
    "aria-selected": "true",
    tabindex: "0",
    role: "tab",
  });
  const shapingTab = makeStubEl("button", {
    "data-sideways-diagram-tab": SIDEWAYS_DIAGRAM_TAB_SHAPING,
    "aria-selected": "false",
    tabindex: "-1",
    role: "tab",
  });
  const stsPanel = makeStubEl("div", {
    "data-sideways-diagram-panel": SIDEWAYS_DIAGRAM_TAB_STS_ROWS,
    role: "tabpanel",
  });
  const shapingPanel = makeStubEl("div", {
    "data-sideways-diagram-panel": SIDEWAYS_DIAGRAM_TAB_SHAPING,
    role: "tabpanel",
    hidden: "",
  });
  root._children.push(stsTab, shapingTab, stsPanel, shapingPanel);
  return root;
}

describe("Sideways diagram tabs", () => {
  it("reuses the shared Stitches & Rows / Shaping Notation tab shell", () => {
    expect(SIDEWAYS_DIAGRAM_TAB_STS_ROWS).toBe(PATTERN_DIAGRAM_TAB_STS_ROWS);
    expect(SIDEWAYS_DIAGRAM_TAB_SHAPING).toBe(PATTERN_DIAGRAM_TAB_SHAPING);
    const html = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    expect(html).toContain("pattern-diagram-tabs");
    expect(html).toContain("Stitches &amp; Rows");
    expect(html).toContain("Shaping Notation");
    expect(html).not.toContain("Japanese Notation");
    expect(html).toContain('data-sideways-diagram-tab="sts-rows"');
    expect(html).toContain('data-sideways-diagram-tab="shaping-notation"');
    expect(html).toContain("data-sideways-diagram-sts-rows-host");
    expect(html).toContain("data-sideways-diagram-shaping-host");
    expect(html).toContain('class="sideways-pattern-diagram-print-heading">Stitches &amp; Rows</h3>');
    expect(html).toContain('class="sideways-pattern-diagram-print-heading">Shaping Notation</h3>');
    expect(html).toMatch(/data-sideways-diagram-panel="shaping-notation"[^>]*\shidden/);
    expect(html).not.toMatch(/data-sideways-diagram-panel="sts-rows"[^>]*\shidden/);
  });

  it("shows only the selected tab panel", () => {
    const root = buildTabsStubRoot();
    activateSidewaysDiagramTab(root as unknown as ParentNode, SIDEWAYS_DIAGRAM_TAB_SHAPING);

    const stsPanel = root.querySelector('[data-sideways-diagram-panel="sts-rows"]')!;
    const shapingPanel = root.querySelector('[data-sideways-diagram-panel="shaping-notation"]')!;
    expect(stsPanel.hasAttribute("hidden")).toBe(true);
    expect(shapingPanel.hasAttribute("hidden")).toBe(false);

    activateSidewaysDiagramTab(root as unknown as ParentNode, SIDEWAYS_DIAGRAM_TAB_STS_ROWS);
    expect(stsPanel.hasAttribute("hidden")).toBe(false);
    expect(shapingPanel.hasAttribute("hidden")).toBe(true);
  });

  it("supports keyboard switching between tabs", () => {
    const mount = makeStubEl("div");
    const root = buildTabsStubRoot();
    mount._children.push(root);
    initSidewaysCardiganPatternDiagramTabs(mount as unknown as ParentNode);

    const stsTab = root.querySelector('[data-sideways-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector('[data-sideways-diagram-tab="shaping-notation"]')!;

    stsTab.dispatchKey("ArrowRight");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    shapingTab.dispatchKey("ArrowLeft");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("puts the shared diagram Print button on both body diagram panels", () => {
    const html = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    const shapingStart = html.indexOf('data-sideways-diagram-panel="shaping-notation"');
    const stsStart = html.indexOf('data-sideways-diagram-panel="sts-rows"');
    const shapingChunk = html.slice(shapingStart);
    const stsChunk = html.slice(stsStart, shapingStart);
    expect(shapingChunk).toContain("data-sideways-diagram-print");
    expect(shapingChunk).toContain("sleeveless-diagram-modal__print");
    expect(shapingChunk).toContain("Print shaping notation diagram");
    expect(stsChunk).toContain("data-sideways-diagram-print");
    expect(stsChunk).toContain("sleeveless-diagram-modal__print");
    expect(stsChunk).toContain("Print stitches and rows diagram");
    expect(html.split("data-sideways-diagram-print").length - 1).toBe(2);
  });

  it("wraps both diagram hosts in the shared sweater enlarge card", () => {
    const html = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    expect(html.split("data-sleeveless-diagram-enlarge").length - 1).toBe(2);
    expect(html).toContain("sleeveless-piece-split__diagram-card");
    expect(html).toContain("Open larger diagram: Sideways V-Neck stitches and rows");
    expect(html).toContain("Open larger diagram: Sideways V-Neck shaping notation");
  });

  it("places the shared shaping-notation help only in the Shaping Notation panel", () => {
    const html = buildSidewaysCardiganPatternDiagramTabsShellHtml();
    const shapingStart = html.indexOf('data-sideways-diagram-panel="shaping-notation"');
    const stsStart = html.indexOf('data-sideways-diagram-panel="sts-rows"');
    const shapingChunk = html.slice(shapingStart);
    const stsChunk = html.slice(stsStart, shapingStart);
    expect(shapingChunk).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL);
    expect(shapingChunk).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS);
    expect(shapingChunk).toContain(`data-vimeo-id="${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID}"`);
    expect(stsChunk).not.toContain("data-pattern-diagram-shaping-help");
    expect(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID).toBe(
      SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
    );
    expect(html).toContain(buildPatternDiagramShapingNotationHelpHtml());
  });

  it("Pattern page print CSS un-hides both diagram panels and hides the help control", () => {
    const page = readFileSync(
      join(srcRoot, "pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    expect(page).toContain("pattern-diagram-tabs.css");
    expect(page).toContain("data-sideways-diagram-tabs-mount");
    expect(page).toContain(SIDEWAYS_DIAGRAM_PANEL_TITLE);
    expect(page).toContain(".sideways-pattern-diagram-tabs__panel[hidden]");
    expect(page).toContain(".sideways-pattern-diagram-print-heading");
    expect(page).toContain(".pattern-diagram-shaping-help");
    expect(page).toContain("display: block !important");
    expect(page).not.toContain("vimeo");
  });

  it("pattern page script fills both tab hosts from the workspace calc", () => {
    const pageScript = readFileSync(
      join(srcRoot, "scripts/sideways-cardigan-pattern-page.ts"),
      "utf8",
    );
    expect(pageScript).toContain("buildSidewaysCardiganPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("initSidewaysCardiganPatternDiagramTabs");
    expect(pageScript).toContain("buildSidewaysCardiganPatternDiagramSvg");
    expect(pageScript).toContain("triggerPatternPrint");
    expect(pageScript).toContain("printShapingNotationDiagramDocument");
    expect(pageScript).toContain("isPrintablePatternDiagramSvg");
    expect(pageScript).toContain('aria-label", "Print pattern"');
    const page = readFileSync(
      join(srcRoot, "pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    expect(page).toContain("data-sideways-pattern-actions");
    expect(page).toContain("data-pattern-print-skip-modal");
    expect(pageScript).toContain("buildSidewaysCardiganShapingNotationDiagramSvg");
    expect(pageScript).toContain("buildSidewaysCardiganPatternDiagramModel");
    expect(pageScript).toContain("bindSleevelessDiagramZoom(diagramHost)");
    expect(pageScript).toContain("ensureSleevelessDiagramModal");
    expect(pageScript).toContain("data-sideways-diagram-sts-rows-host");
    expect(pageScript).toContain("data-sideways-diagram-shaping-host");
    expect(pageScript).toContain("SLEEVELESS_DIAGRAM_INLINE_CLASS");
    expect(pageScript).toContain("vNeckIncreaseSequence");
    expect(pageScript).toContain("vNeckDecreaseSequence");
    expect(pageScript).toContain("increaseSequence");
    expect(pageScript).toContain("decreaseSequence");
  });
});
