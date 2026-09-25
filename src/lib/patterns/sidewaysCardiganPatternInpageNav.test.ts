import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  renderSidewaysCardiganBodySequenceHtml,
} from "./sidewaysCardiganBodyInstructions";
import { renderSidewaysCardiganBodyDisplayHtml } from "./sidewaysCardiganPatternOutput";
import {
  renderSidewaysCardiganBandSectionHtml,
  renderSidewaysFinishingSectionHtml,
  sidewaysFoldedHemTurningNeedle,
} from "./sidewaysCardiganFinishing";
import {
  buildSidewaysCardiganPatternDiagramTabsShellHtml,
  buildSidewaysCardiganSleeveDiagramTabsShellHtml,
} from "./sidewaysCardiganPatternDiagramTabs";
import { SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS } from "./sidewaysCardiganPatternInpageNav";
import {
  buildSidewaysCardiganSleeveInstructions,
  renderSidewaysCardiganSleeveSequenceHtml,
  renderSidewaysSleeveNotConnectedHtml,
} from "./sidewaysCardiganSleeveInstructions";
import type { SidewaysCardiganSleeveCalcInput } from "./sidewaysCardiganSleeveCalc";
import {
  PATTERN_INPAGE_NAV_ATTR,
  PATTERN_INPAGE_NAV_PILL_CLASS,
  syncPatternInpageNav,
  updatePatternInpageNavActivePill,
} from "./patternInpageNav";

const BODY_INPUT: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

const SLEEVE_INPUT: SidewaysCardiganSleeveCalcInput = {
  direction: "cuff-up",
  finishedUpperArmInches: 14,
  finishedWristInches: 7,
  sleeveLengthInches: 17,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  cuffDepthInches: 2,
  armholeDepthInches: 7,
};

/** Headings the body and sleeve render that are not pattern-level jumps. */
const UNLINKED_VISIBLE_HEADINGS = [
  "BEFORE YOU BEGIN",
  "CAST ON",
  "FIRST FRONT SHOULDER",
  "FIRST BACK SHOULDER",
  "SECOND BACK SHOULDER",
  "SECOND FRONT SHOULDER",
  "BIND OFF",
  "CUFF",
  "SLEEVE BODY",
  "SLEEVE SHAPING CHART",
] as const;

function cardiganBodyHtml(): string {
  const result = buildSidewaysCardiganBodyInstructions(BODY_INPUT, "cardigan");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return (
    renderSidewaysCardiganBodyDisplayHtml(result.instructions, BODY_INPUT.stitchesPerInch) +
    renderSidewaysCardiganBandSectionHtml({
      calc: result.instructions.calc,
      stitchesPerInch: BODY_INPUT.stitchesPerInch,
      rowsPerInch: BODY_INPUT.rowsPerInch,
    }) +
    renderSidewaysFinishingSectionHtml({
      garmentStyle: "cardigan",
      turningNeedle: sidewaysFoldedHemTurningNeedle(BODY_INPUT.stitchesPerInch),
    })
  );
}

function pulloverBodyHtml(): string {
  const result = buildSidewaysCardiganBodyInstructions(BODY_INPUT, "pullover");
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return renderSidewaysCardiganBodySequenceHtml(result.instructions);
}

function sleeveHtml(direction: SidewaysCardiganSleeveCalcInput["direction"] = "cuff-up"): string {
  const result = buildSidewaysCardiganSleeveInstructions({ ...SLEEVE_INPUT, direction });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return renderSidewaysCardiganSleeveSequenceHtml(result.instructions);
}

function sectionIds(html: string): string[] {
  return [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]!);
}

function headingForSection(html: string, id: string): string {
  const match = html.match(new RegExp(`<section id="${id}"[\\s\\S]*?<h2>([^<]*)</h2>`));
  expect(match, `heading for #${id}`).toBeTruthy();
  return match![1]!;
}

class DomElement {
  tagName: string;
  id = "";
  hidden = false;
  textContent = "";
  href = "";
  offsetHeight = 40;
  top = 0;
  children: DomElement[] = [];
  classes = new Set<string>();
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  private classNameValue = "";

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get className(): string {
    return this.classNameValue;
  }

  set className(value: string) {
    this.classNameValue = value;
    this.classes = new Set(value.split(/\s+/).filter(Boolean));
  }

  classList = {
    toggle: (name: string, force?: boolean) => {
      const on = force ?? !this.classes.has(name);
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      this.classNameValue = [...this.classes].join(" ");
    },
  };

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === "id") this.id = value;
  }

  getAttribute(name: string): string | null {
    if (name === "data-nav-section-id") return this.dataset.navSectionId ?? null;
    if (name === "id") return this.id || null;
    return this.attrs.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
    if (name === "aria-current") this.attrs.delete(name);
  }

  appendChild(child: DomElement): DomElement {
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: DomElement[]): void {
    this.children = nodes;
  }

  getBoundingClientRect(): { top: number } {
    return { top: this.top };
  }

  querySelector(selector: string): DomElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): DomElement[] {
    const matches: DomElement[] = [];
    const visit = (node: DomElement) => {
      if (node.matches(selector)) matches.push(node);
      for (const child of node.children) visit(child);
    };
    for (const child of this.children) visit(child);
    return matches;
  }

  matches(selector: string): boolean {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (/^\[[^\]]+\]$/.test(selector) && !selector.includes("=")) {
      return this.attrs.has(selector.slice(1, -1));
    }
    const dataSection = selector.match(/^\[data-section-id="([^"]+)"\]$/);
    if (dataSection) return this.getAttribute("data-section-id") === dataSection[1];
    const pill = selector.match(/^a\.([^\[]+)\[data-nav-section-id\]$/);
    if (pill) {
      return (
        this.tagName === "A" &&
        this.classes.has(pill[1]!) &&
        Boolean(this.dataset.navSectionId)
      );
    }
    return false;
  }
}

class DomAnchor extends DomElement {}

type NavAnchor = DomElement;

function installDom(sectionTops: Record<string, number>): {
  nav: DomElement;
  scope: DomElement;
} {
  const scope = new DomElement("div");
  scope.id = "pattern-content";
  const nav = new DomElement("nav");
  nav.hidden = true;
  nav.setAttribute(PATTERN_INPAGE_NAV_ATTR, "");
  nav.className = "sleeveless-pattern-inpage-nav no-print";
  scope.appendChild(nav);
  for (const [id, top] of Object.entries(sectionTops)) {
    const section = new DomElement("section");
    section.id = id;
    section.top = top;
    section.setAttribute("id", id);
    section.setAttribute("data-section-id", id);
    scope.appendChild(section);
  }
  const documentRoot = new DomElement("document");
  documentRoot.appendChild(scope);
  const documentElement = new DomElement("html");
  globalThis.HTMLElement = DomElement as unknown as typeof HTMLElement;
  globalThis.HTMLAnchorElement = DomAnchor as unknown as typeof HTMLAnchorElement;
  globalThis.CSS = { escape: (value: string) => value } as unknown as typeof CSS;
  globalThis.getComputedStyle = (() => ({
    getPropertyValue: (name: string) => (name === "--site-header-offset" ? "112px" : ""),
  })) as unknown as typeof getComputedStyle;
  globalThis.window = {
    addEventListener() {
      /* scroll spy binds once; this suite does not dispatch scroll */
    },
  } as unknown as Window & typeof globalThis;
  globalThis.document = {
    documentElement,
    createElement: (tag: string) =>
      tag.toLowerCase() === "a" ? new DomAnchor(tag) : new DomElement(tag),
    getElementById: (id: string) => documentRoot.querySelector(`#${id}`),
    querySelector: (selector: string) => documentRoot.querySelector(selector),
  } as unknown as Document;
  return { nav, scope };
}

function anchors(nav: DomElement): NavAnchor[] {
  return nav.querySelectorAll(`a.${PATTERN_INPAGE_NAV_PILL_CLASS}[data-nav-section-id]`);
}

describe("Sideways pattern reuses the shared in-page navigation", () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
    HTMLAnchorElement: globalThis.HTMLAnchorElement,
    CSS: (globalThis as { CSS?: unknown }).CSS,
    getComputedStyle: globalThis.getComputedStyle,
  };

  beforeAll(() => {
    installDom({});
  });

  afterAll(() => {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.HTMLAnchorElement = previous.HTMLAnchorElement;
    (globalThis as { CSS?: unknown }).CSS = previous.CSS;
    globalThis.getComputedStyle = previous.getComputedStyle;
  });

  it("mounts the shared nav shell and syncs it after the pattern renders", () => {
    const page = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    const script = readFileSync(resolve("src/scripts/sideways-cardigan-pattern-page.ts"), "utf8");
    const content = page.slice(
      page.indexOf('id="pattern-content"'),
      page.indexOf("</main>"),
    );
    expect(page).toContain('class="wizard-page sleeveless-pattern-page');
    expect(content).toContain('data-sleeveless-pattern-inpage-nav');
    expect(content).toContain('aria-label="Jump to pattern section"');
    expect(content).toContain("sleeveless-pattern-inpage-nav no-print");
    expect(content.indexOf("data-sleeveless-pattern-inpage-nav")).toBeLessThan(
      content.indexOf("data-sideways-body-sequence"),
    );
    expect(content.indexOf("data-sideways-body-sequence")).toBeLessThan(
      content.indexOf("data-sideways-sleeve-host"),
    );
    expect(content).toContain("data-sideways-diagram-tabs-mount");
    expect(content).toContain("data-sideways-sleeve-sequence");
    expect(page).toMatch(
      /#pattern-content > \.sleeveless-pattern-inpage-nav\s*\{[^}]*min-width:\s*0;/,
    );
    expect(page).toContain("#pattern-content > [data-sideways-sleeve-host]");
    expect(script).toContain("syncPatternInpageNav");
    expect(script).toContain("SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS");
    expect(script).toContain("bindSleevelessDiagramZoom");
    expect(script).toContain("fillSidewaysPatternDiagrams");
    expect(script).toContain("fillSidewaysSleeveDiagrams");
  });

  it("keeps sticky placement, anchor offset, narrow-screen scrolling, keyboard focus, and print hiding", () => {
    const css = readFileSync(resolve("src/styles/patterns/sleeveless-pattern-shared.css"), "utf8");
    const printCss = readFileSync(resolve("src/styles/global.css"), "utf8");
    const phoneCss = readFileSync(
      resolve("src/styles/patterns/pattern-phone-workspace.css"),
      "utf8",
    );
    expect(css).toContain("position: sticky;");
    expect(css).toContain(
      "top: calc(var(--kbm-env-banner-h, 0px) + var(--header-offset, 170px) + 4px);",
    );
    expect(css).toMatch(
      /scroll-margin-top:\s*calc\(\s*var\(--kbm-env-banner-h, 0px\) \+ var\(--header-offset, 170px\) \+ var\(--pattern-inpage-nav-height, 3\.35rem\)\s*\);/,
    );
    expect(css).toContain(".sleeveless-pattern-inpage-nav__pill:focus-visible");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("flex-wrap: nowrap;");
    expect(css).toContain("overflow-x: auto;");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toMatch(/@media print[\s\S]*?\.no-print\s*\{[^}]*display:\s*none !important;/);
    expect(printCss).toMatch(
      /@media print[\s\S]*?\bnav,[\s\S]*?\.no-print\s*\{[^}]*display:\s*none !important;/,
    );
    expect(phoneCss).toContain(".sleeveless-pattern-inpage-nav");
    expect(phoneCss).toContain(
      "top: calc(var(--kbm-env-banner-h, 0px) + var(--header-offset, 64px) + 2px);",
    );
  });

  it("links only real cardigan headings, including body, neckline, and sleeve", () => {
    const html = `${cardiganBodyHtml()}${sleeveHtml()}${sleeveHtml("top-down")}`;
    expect(SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS.map((item) => item.label)).toEqual([
      "BODY",
      "FIRST V-NECK",
      "FIRST ARMHOLE",
      "BACK NECK",
      "SECOND ARMHOLE",
      "SECOND V-NECK",
      "SLEEVE",
      "FRONT AND NECK BAND",
      "FINISHING",
    ]);
    for (const item of SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS) {
      const id = item.ids[0]!;
      expect(html).toContain(`id="${id}"`);
      expect(headingForSection(html, id)).toBe(item.label);
    }
    const labels = SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS.map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(["BODY", "SLEEVE", "FIRST V-NECK", "BACK NECK", "SECOND V-NECK"]));
    for (const heading of UNLINKED_VISIBLE_HEADINGS) {
      expect(html).toContain(`<h2>${heading}</h2>`);
      expect(labels).not.toContain(heading);
    }
    expect(html).toContain("<h2>FINISHING</h2>");
    expect(html).toContain('id="sg-finishing"');
    expect(html).not.toContain("<h2>Neckband</h2>");
    expect(labels).toContain("FINISHING");
    expect(labels).not.toContain("Neckband");
  });

  it("does not reuse diagram-tab ids", () => {
    const patternIds = sectionIds(`${cardiganBodyHtml()}${sleeveHtml()}`);
    const diagramIds = [
      ...`${buildSidewaysCardiganPatternDiagramTabsShellHtml()}${buildSidewaysCardiganSleeveDiagramTabsShellHtml()}`.matchAll(
        /id="([^"]+)"/g,
      ),
    ].map((match) => match[1]!);
    expect(new Set(patternIds).size).toBe(patternIds.length);
    expect(diagramIds.length).toBeGreaterThan(0);
    for (const id of patternIds) expect(diagramIds).not.toContain(id);
    for (const item of SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS) {
      expect(patternIds).toContain(item.ids[0]);
    }
  });

  it("omits links whose sections are not rendered", () => {
    const bodyOnly = installDom(
      Object.fromEntries(sectionIds(cardiganBodyHtml()).map((id) => [id, 800])),
    );
    const bodyCount = syncPatternInpageNav({
      items: SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS,
      nav: bodyOnly.nav,
      scope: bodyOnly.scope,
    });
    const bodyLabels = anchors(bodyOnly.nav).map((anchor) => anchor.textContent);
    expect(bodyCount).toBe(bodyLabels.length);
    expect(bodyLabels).not.toContain("SLEEVE");
    expect(bodyLabels).toContain("BODY");
    expect(bodyLabels).toContain("FIRST V-NECK");

    const pullover = installDom({});
    const pulloverCount = syncPatternInpageNav({
      items: SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS,
      nav: pullover.nav,
      scope: pullover.scope,
    });
    expect(pulloverBodyHtml()).not.toContain('id="sg-body"');
    expect(renderSidewaysSleeveNotConnectedHtml()).not.toContain('id="sg-sleeve"');
    expect(pulloverCount).toBe(0);
    expect(pullover.nav.hidden).toBe(true);
    expect(anchors(pullover.nav)).toHaveLength(0);
  });

  it("renders hash links and initializes the active section", () => {
    const ids = SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS.map((item) => item.ids[0]!);
    const tops = Object.fromEntries(ids.map((id) => [id, id === "sg-body" ? 0 : 800]));
    const { nav, scope } = installDom(tops);
    const count = syncPatternInpageNav({
      items: SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS,
      nav,
      scope,
    });
    const links = anchors(nav);
    expect(count).toBe(ids.length);
    expect(nav.hidden).toBe(false);
    expect(links.map((link) => link.textContent)).toEqual(
      SIDEWAYS_CARDIGAN_INPAGE_NAV_ITEMS.map((item) => item.label),
    );
    for (const link of links) {
      expect(link.tagName).toBe("A");
      expect(link.href).toBe(`#${link.dataset.navSectionId}`);
      expect(link.getAttribute("tabindex")).toBeNull();
    }
    const active = links.filter((link) => link.classes.has("is-active"));
    expect(active).toHaveLength(1);
    expect(active[0]!.dataset.navSectionId).toBe("sg-body");
    expect(active[0]!.getAttribute("aria-current")).toBe("location");

    const neck = scope.querySelector("#sg-body-first-v-neck");
    expect(neck).toBeTruthy();
    neck!.top = 20;
    updatePatternInpageNavActivePill();
    const next = anchors(nav).filter((link) => link.classes.has("is-active"));
    expect(next).toHaveLength(1);
    expect(next[0]!.dataset.navSectionId).toBe("sg-body-first-v-neck");
    expect(next[0]!.getAttribute("aria-current")).toBe("location");
    expect(active[0]!.getAttribute("aria-current")).toBeNull();
  });
});
