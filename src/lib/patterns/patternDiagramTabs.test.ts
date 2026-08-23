import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PATTERN_DIAGRAM_PANEL_ATTR,
  PATTERN_DIAGRAM_SHARED_PANEL_ATTR,
  PATTERN_DIAGRAM_SHARED_PANEL_ID,
  PATTERN_DIAGRAM_TAB_ATTR,
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
  PATTERN_DIAGRAM_TABS_CLASS,
  PATTERN_DIAGRAM_TABS_LIST_CLASS,
  PATTERN_DIAGRAM_TABS_PANEL_CLASS,
  PATTERN_DIAGRAM_TABS_ROOT_ATTR,
  PATTERN_DIAGRAM_TABS_TAB_CLASS,
  activatePatternDiagramTab,
  buildPatternDiagramTabsShellHtml,
  initPatternDiagramTabs,
} from "./patternDiagramTabs";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sharedCss = readFileSync(
  join(srcRoot, "styles/patterns/pattern-diagram-tabs.css"),
  "utf8",
);

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
  if (sel === `[${PATTERN_DIAGRAM_TABS_ROOT_ATTR}]`) {
    return el.hasAttribute(PATTERN_DIAGRAM_TABS_ROOT_ATTR);
  }
  if (sel === `[${PATTERN_DIAGRAM_TAB_ATTR}]`) {
    return el.hasAttribute(PATTERN_DIAGRAM_TAB_ATTR);
  }
  if (sel === `[${PATTERN_DIAGRAM_PANEL_ATTR}]`) {
    return el.hasAttribute(PATTERN_DIAGRAM_PANEL_ATTR);
  }
  const tabMatch = sel.match(/^\[data-pattern-diagram-tab="([^"]+)"\]$/);
  if (tabMatch) return el.getAttribute(PATTERN_DIAGRAM_TAB_ATTR) === tabMatch[1];
  const panelMatch = sel.match(/^\[data-pattern-diagram-panel="([^"]+)"\]$/);
  if (panelMatch) return el.getAttribute(PATTERN_DIAGRAM_PANEL_ATTR) === panelMatch[1];
  return false;
}

function buildTabsStubRoot(kind: "panels" | "shared" = "panels"): StubEl {
  const rootAttrs: Record<string, string> = { [PATTERN_DIAGRAM_TABS_ROOT_ATTR]: "" };
  if (kind === "shared") rootAttrs[PATTERN_DIAGRAM_SHARED_PANEL_ATTR] = "true";
  const root = makeStubEl("div", rootAttrs);
  const stsTab = makeStubEl("button", {
    [PATTERN_DIAGRAM_TAB_ATTR]: PATTERN_DIAGRAM_TAB_STS_ROWS,
    "aria-selected": "true",
    tabindex: "0",
    role: "tab",
    id: "demo-tab-sts-rows",
  });
  const shapingTab = makeStubEl("button", {
    [PATTERN_DIAGRAM_TAB_ATTR]: PATTERN_DIAGRAM_TAB_SHAPING,
    "aria-selected": "false",
    tabindex: "-1",
    role: "tab",
    id: "demo-tab-shaping-notation",
  });
  if (kind === "shared") {
    const panel = makeStubEl("div", {
      [PATTERN_DIAGRAM_PANEL_ATTR]: PATTERN_DIAGRAM_SHARED_PANEL_ID,
      role: "tabpanel",
      "aria-labelledby": "demo-tab-sts-rows",
      id: "demo-panel-shared",
    });
    root._children.push(stsTab, shapingTab, panel);
    return root;
  }
  const stsPanel = makeStubEl("div", {
    [PATTERN_DIAGRAM_PANEL_ATTR]: PATTERN_DIAGRAM_TAB_STS_ROWS,
    role: "tabpanel",
  });
  const shapingPanel = makeStubEl("div", {
    [PATTERN_DIAGRAM_PANEL_ATTR]: PATTERN_DIAGRAM_TAB_SHAPING,
    role: "tabpanel",
    hidden: "",
  });
  root._children.push(stsTab, shapingTab, stsPanel, shapingPanel);
  return root;
}

describe("shared pattern diagram tabs", () => {
  it("renders both tabs with Stitches & Rows selected by default", () => {
    const html = buildPatternDiagramTabsShellHtml({
      idPrefix: "demo-diagram",
      tablistLabel: "Pattern diagram view",
      tabs: [
        { id: PATTERN_DIAGRAM_TAB_STS_ROWS, panelHtml: "<p>sts</p>" },
        { id: PATTERN_DIAGRAM_TAB_SHAPING, panelHtml: "<p>shaping</p>" },
      ],
    });

    expect(html).toContain(`class="${PATTERN_DIAGRAM_TABS_CLASS}"`);
    expect(html).toContain(`role="tablist"`);
    expect(html).toContain(`aria-label="Pattern diagram view"`);
    expect(html).toContain("Stitches &amp; Rows");
    expect(html).toContain("Shaping Notation");
    expect(html).toContain(`role="tab"`);
    expect(html).toContain(`role="tabpanel"`);
    expect(html).toContain(`aria-controls="demo-diagram-panel-sts-rows"`);
    expect(html).toContain(`aria-controls="demo-diagram-panel-shaping-notation"`);
    expect(html).toContain(`aria-labelledby="demo-diagram-tab-sts-rows"`);
    expect(html).toContain(`aria-labelledby="demo-diagram-tab-shaping-notation"`);
    expect(html).toMatch(
      /data-pattern-diagram-tab="sts-rows"[^>]*aria-selected="true"/,
    );
    expect(html).toMatch(
      /data-pattern-diagram-tab="shaping-notation"[^>]*aria-selected="false"/,
    );
    expect(html).toMatch(
      /data-pattern-diagram-panel="shaping-notation"[^>]*\bhidden\b/,
    );
    expect(html).not.toMatch(/data-pattern-diagram-panel="sts-rows"[^>]*\bhidden\b/);
    expect(html).toContain("<p>sts</p>");
    expect(html).toContain("<p>shaping</p>");
  });

  it("associates each tab with its panel and keeps family content opaque", () => {
    const html = buildPatternDiagramTabsShellHtml({
      idPrefix: "family",
      tablistLabel: "Diagram view",
      extraRootClass: "family-root",
      extraTabAttrs: undefined,
      tabs: [
        {
          id: PATTERN_DIAGRAM_TAB_STS_ROWS,
          extraTabAttrs: `data-family-mode-btn="sts-rows"`,
          panelHtml: `<div data-family-sts-host></div>`,
        },
        {
          id: PATTERN_DIAGRAM_TAB_SHAPING,
          extraTabAttrs: `data-family-mode-btn="shaping-notation"`,
          panelHtml: `<div data-family-shaping-host></div>`,
        },
      ],
    });

    expect(html).toContain("family-root");
    expect(html).toContain('data-family-mode-btn="sts-rows"');
    expect(html).toContain('data-family-mode-btn="shaping-notation"');
    expect(html).toContain("data-family-sts-host");
    expect(html).toContain("data-family-shaping-host");
    expect(html).not.toContain("hat-");
    expect(html).not.toContain("sleeveless");
    expect(html).not.toContain("drop-shoulder");
  });

  it("only shows the selected tab panel on screen", () => {
    const root = buildTabsStubRoot();
    activatePatternDiagramTab(root as unknown as ParentNode, PATTERN_DIAGRAM_TAB_SHAPING);

    const stsPanel = root.querySelector('[data-pattern-diagram-panel="sts-rows"]')!;
    const shapingPanel = root.querySelector('[data-pattern-diagram-panel="shaping-notation"]')!;
    const stsTab = root.querySelector('[data-pattern-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector('[data-pattern-diagram-tab="shaping-notation"]')!;

    expect(stsPanel.hasAttribute("hidden")).toBe(true);
    expect(shapingPanel.hasAttribute("hidden")).toBe(false);
    expect(stsTab.getAttribute("aria-selected")).toBe("false");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    expect(shapingTab.tabIndex).toBe(0);
    expect(stsTab.tabIndex).toBe(-1);

    activatePatternDiagramTab(root as unknown as ParentNode, PATTERN_DIAGRAM_TAB_STS_ROWS);
    expect(stsPanel.hasAttribute("hidden")).toBe(false);
    expect(shapingPanel.hasAttribute("hidden")).toBe(true);
  });

  it("keeps a shared panel visible and updates aria-labelledby when switching", () => {
    const html = buildPatternDiagramTabsShellHtml({
      idPrefix: "shared-demo",
      tablistLabel: "Diagram view",
      sharedPanel: true,
      sharedPanelHtml: `<div data-family-diagram-host></div>`,
      tabs: [
        { id: PATTERN_DIAGRAM_TAB_STS_ROWS },
        { id: PATTERN_DIAGRAM_TAB_SHAPING },
      ],
    });

    expect(html).toContain(`${PATTERN_DIAGRAM_SHARED_PANEL_ATTR}="true"`);
    expect(html).toContain('data-pattern-diagram-panel="shared"');
    expect(html).toContain('aria-controls="shared-demo-panel-shared"');
    expect(html).toContain('aria-labelledby="shared-demo-tab-sts-rows"');
    expect(html).toContain("data-family-diagram-host");
    expect(html).not.toMatch(/data-pattern-diagram-panel="shared"[^>]*\bhidden\b/);

    const root = buildTabsStubRoot("shared");
    activatePatternDiagramTab(root as unknown as ParentNode, PATTERN_DIAGRAM_TAB_SHAPING);
    const panel = root.querySelector('[data-pattern-diagram-panel="shared"]')!;
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(panel.getAttribute("aria-labelledby")).toBe("demo-tab-shaping-notation");
    expect(
      root.querySelector('[data-pattern-diagram-tab="shaping-notation"]')!.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("supports keyboard switching between tabs", () => {
    const mount = makeStubEl("div");
    const root = buildTabsStubRoot();
    mount._children.push(root);
    initPatternDiagramTabs(mount as unknown as ParentNode);

    const stsTab = root.querySelector('[data-pattern-diagram-tab="sts-rows"]')!;
    const shapingTab = root.querySelector('[data-pattern-diagram-tab="shaping-notation"]')!;

    stsTab.dispatchKey("ArrowRight");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");
    expect(
      root.querySelector('[data-pattern-diagram-panel="shaping-notation"]')!.hasAttribute("hidden"),
    ).toBe(false);

    shapingTab.dispatchKey("ArrowLeft");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");

    stsTab.dispatchKey("End");
    expect(shapingTab.getAttribute("aria-selected")).toBe("true");

    shapingTab.dispatchKey("Home");
    expect(stsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps two side-by-side tabs on mobile without wrapping or scrolling", () => {
    expect(sharedCss).toContain(`.${PATTERN_DIAGRAM_TABS_LIST_CLASS}`);
    expect(sharedCss).toContain(`.${PATTERN_DIAGRAM_TABS_TAB_CLASS}`);
    expect(sharedCss).toContain(`.${PATTERN_DIAGRAM_TABS_PANEL_CLASS}`);
    expect(sharedCss).toContain("flex-wrap: nowrap");
    expect(sharedCss).toContain("flex: 1 1 50%");
    expect(sharedCss).toContain("width: 50%");
    expect(sharedCss).toContain("max-width: 50%");
    expect(sharedCss).toContain("white-space: normal");
    expect(sharedCss).toContain("min-height: 44px");
    expect(sharedCss).toContain("font-size: 1rem");
    expect(sharedCss).toContain("var(--kbm-green, #52682d)");
    expect(sharedCss).toContain("overflow-x: hidden");
    expect(sharedCss).not.toContain("flex-wrap: wrap");
    expect(sharedCss).not.toContain("flex-direction: column");
    expect(sharedCss).not.toMatch(/select\s*\{/);
    expect(sharedCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*flex-wrap:\s*nowrap[\s\S]*flex-direction:\s*row/,
    );
    expect(sharedCss).toMatch(
      /\.pattern-diagram-tabs__tab:focus-visible[\s\S]*outline:\s*2px solid/,
    );
  });
});

describe("finished-pattern families use the shared diagram tabs", () => {
  it("Hat, Sleeveless, and Drop Shoulder import the shared tab container CSS", () => {
    const hatPage = readFileSync(join(srcRoot, "pages/patterns/hat/pattern.astro"), "utf8");
    const sleevelessPage = readFileSync(
      join(srcRoot, "pages/patterns/sleeveless/pattern/index.astro"),
      "utf8",
    );
    const dropShoulderPage = readFileSync(
      join(srcRoot, "pages/patterns/drop-shoulder/pattern/index.astro"),
      "utf8",
    );
    expect(hatPage).toContain("pattern-diagram-tabs.css");
    expect(sleevelessPage).toContain("pattern-diagram-tabs.css");
    expect(dropShoulderPage).toContain("pattern-diagram-tabs.css");
    expect(hatPage).toContain("Hat Dimensions");
    expect(hatPage).toContain("data-hat-diagram-tabs-mount");
  });

  it("Sleeveless and Drop Shoulder build accessible tabs and keep diagram swapping in the family script", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("buildPatternDiagramTabsShellHtml");
    expect(script).toContain("initPatternDiagramTabs");
    expect(script).toContain("buildSleevelessPatternDiagramTabsShellHtml");
    expect(script).toContain("initSleevelessPatternDiagramTabs");
    expect(script).toContain("sharedPanel: true");
    expect(script).toContain("data-sleeveless-back-diagram-mode-btn");
    expect(script).toContain("data-sleeveless-front-diagram-mode-btn");
    expect(script).toContain("hydrateSleevelessBackDiagram");
    expect(script).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(script).toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
    expect(script).toContain("resolveDropShoulderBackDiagramSvg");
    expect(script).not.toContain('role="group" aria-label="${modeToggleGroupLabel}"');
  });

  it("does not change Hat diagram generators or pattern math entry points", () => {
    const pageScript = readFileSync(join(srcRoot, "scripts/hat-pattern-page.ts"), "utf8");
    expect(pageScript).toContain("buildHatPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("initHatPatternDiagramTabs");
    expect(pageScript).toContain("buildHatPatternDiagramSvg");
    expect(pageScript).toContain("buildHatShapingNotationDiagramSvg");
    expect(pageScript).not.toContain("buildHatJapaneseNotationDiagramSvg");
  });
});
