import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSweaterSizingChartHref,
  wireExpressSweaterSizingChartLink,
} from "../reference/sweaterSizingChartNavigation";
import {
  refreshExpressSizePanel,
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const whoSizeSection = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoSizeSection.astro"),
  "utf8",
);
const expressPageSrc = readFileSync(resolve("src/scripts/sleeveless-express-page.ts"), "utf8");
const sizeChartClientSrc = readFileSync(
  resolve("src/lib/patterns/sleevelessExpressSizeChartClient.ts"),
  "utf8",
);
const sizeSelectionCss = readFileSync(resolve("src/styles/express-size-selection.css"), "utf8");

const sampleRows: ChartRow[] = [
  { size: 4, bust_or_chest: 33, waist: 25, hip: 35, upper_arm: 11 },
  { size: 6, bust_or_chest: 35, waist: 27, hip: 37, upper_arm: 11.5 },
  { size: 8, bust_or_chest: 37, waist: 29, hip: 39, upper_arm: 12.25 },
];

class FakeClassList {
  private classes: Set<string>;
  constructor(classes: string[] = []) {
    this.classes = new Set(classes);
  }
  toggle(name: string, force?: boolean): void {
    if (force === true) this.classes.add(name);
    else if (force === false) this.classes.delete(name);
    else if (this.classes.has(name)) this.classes.delete(name);
    else this.classes.add(name);
  }
  contains(name: string): boolean {
    return this.classes.has(name);
  }
}

class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  classList: FakeClassList;
  hidden = false;
  textContent = "";
  innerHTML = "";
  value = "";
  href = "";
  tagName: string;
  parentElement: FakeElement | null = null;
  private _className = "";

  constructor(tagName = "DIV", classes: string[] = []) {
    this.tagName = tagName.toUpperCase();
    this.classList = new FakeClassList(classes);
    if (classes.length) this._className = classes.join(" ");
  }

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList = new FakeClassList(value.split(/\s+/).filter(Boolean));
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }

  removeAttribute(name: string): void {
    delete this.attrs[name];
  }

  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...nodes: FakeElement[]): void {
    nodes.forEach((node) => this.appendChild(node));
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
  }

  after(node: FakeElement): void {
    const parent = this.parentElement;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    node.parentElement = parent;
    parent.children.splice(index + 1, 0, node);
  }

  querySelector(selector: string): FakeElement | null {
    const attrMatch = selector.match(/^\[([^=\]]+)\]$/);
    if (attrMatch) {
      const attr = attrMatch[1]!;
      return this.findDescendant((el) => el.hasAttribute(attr));
    }
    const className = selector.startsWith(".") ? selector.slice(1) : selector;
    return this.findDescendant((el) => el.classList.contains(className));
  }

  findDescendant(pred: (el: FakeElement) => boolean): FakeElement | null {
    if (pred(this)) return this;
    for (const child of this.children) {
      const found = child.findDescendant(pred);
      if (found) return found;
    }
    return null;
  }
}

class FakeSelectElement extends FakeElement {}

function buildExpressSizeScope(): FakeElement {
  const scope = new FakeElement("DIV");
  scope.setAttribute("data-express-builder", "");

  const intro = new FakeElement("DIV", ["express-who-size-intro"]);
  const linkWrap = new FakeElement("P", ["express-size-chart-link-wrap"]);
  const link = new FakeElement("A");
  link.setAttribute("data-express-sweater-sizing-chart-link", "");
  linkWrap.appendChild(link);
  intro.appendChild(linkWrap);

  const nested = new FakeElement("DIV");
  nested.setAttribute("data-express-nested-size", "");

  const tableBody = new FakeElement("TBODY");
  tableBody.setAttribute("data-express-size-table-body", "");
  const table = new FakeElement("TABLE");
  table.appendChild(tableBody);
  const select = new FakeSelectElement("SELECT");
  select.setAttribute("data-express-size-select", "");
  const wrap = new FakeElement("DIV");
  wrap.setAttribute("data-express-size-select-wrap", "");
  wrap.append(table, select);

  const summary = new FakeElement("DIV");
  summary.setAttribute("data-express-size-standard-body-summary", "");
  summary.setAttribute("hidden", "");

  nested.append(wrap, summary);
  scope.append(intro, nested);
  return scope;
}

function sizeRows(scope: FakeElement): FakeElement[] {
  const body = scope.querySelector("[data-express-size-table-body]");
  return body?.children.filter((child) => child.getAttribute("data-express-size-row") !== null) ?? [];
}

function selectedRows(scope: FakeElement): FakeElement[] {
  return sizeRows(scope).filter((row) => row.classList.contains("is-selected"));
}

function badgeForRow(row: FakeElement): FakeElement | null {
  return row.querySelector("express-size-row__selected-badge");
}

describe("Express builder size-selection parity", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLSelectElement", FakeSelectElement);
    vi.stubGlobal("document", {
      createElement: (tag: string) =>
        tag.toLowerCase() === "select" ? new FakeSelectElement("SELECT") : new FakeElement(tag),
      querySelector: () => null,
    });
    seedExpressSweaterChartsForTests("misses", sampleRows);
  });

  afterEach(() => {
    resetExpressSweaterChartsForTests();
    vi.unstubAllGlobals();
  });

  it("sleeveless builder links to the sweater sizing chart with sleeveless returnTo", () => {
    expect(sleevelessBuilderAstro).toContain("ExpressBuilderWhoSizeSection");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL");
    expect(sleevelessBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/sleeveless/builder")',
    );
    expect(sleevelessBuilderAstro).toContain("sweaterSizingChartHref={sweaterSizingChartHref}");
    expect(whoSizeSection).toContain("data-express-sweater-sizing-chart-link");
    expect(buildSweaterSizingChartHref("/patterns/sleeveless/builder")).toBe(
      "/reference/sweater-sizing-chart?returnTo=%2Fpatterns%2Fsleeveless%2Fbuilder",
    );
  });

  it("preserves edit query state in the runtime sizing chart link", () => {
    const link = new FakeElement("A");
    const wrap = new FakeElement("P", ["express-size-chart-link-wrap"]);
    wrap.appendChild(link);
    vi.stubGlobal("document", {
      querySelector: (selector: string) =>
        selector === ".express-size-chart-link-wrap a" ? link : null,
      createElement: (tag: string) => new FakeElement(tag),
    });
    vi.stubGlobal("window", {
      location: { pathname: "/patterns/sleeveless/builder", search: "?edit=choices&new=1" },
    });

    wireExpressSweaterSizingChartLink("/patterns/sleeveless/builder");

    expect(link.href).toBe(
      "/reference/sweater-sizing-chart?returnTo=%2Fpatterns%2Fsleeveless%2Fbuilder%3Fedit%3Dchoices",
    );
  });

  it("shares selected-size row markup and styles across builders", () => {
    for (const source of [sleevelessBuilderAstro, dropShoulderBuilderAstro]) {
      expect(source).toContain("ExpressBuilderWhoSizeSection");
      expect(source).toContain("express-size-selection.css");
    }
    expect(whoSizeSection).toContain("data-express-sweater-sizing-chart-link");
    expect(whoSizeSection).toContain("data-express-size-table-body");
    expect(sizeChartClientSrc).toContain('rowEl.classList.toggle("is-selected", isSelected)');
    expect(sizeChartClientSrc).toContain('badge.className = "express-size-row__selected-badge"');
    expect(sizeChartClientSrc).toContain('checkSpan.textContent = isSelected ?');
    expect(sizeChartClientSrc).toContain('badge.textContent = "Selected"');
    expect(sizeSelectionCss).toContain(".express-size-row__selected-badge");
    expect(sizeSelectionCss).toContain("tr.express-size-row.is-selected");
  });

  it("wires sleeveless builder size clicks through the shared express client", () => {
    expect(expressPageSrc).toContain("wireExpressSweaterSizingChartLink(window.location.pathname)");
    expect(expressPageSrc).toContain("onExpressSizeRowActivate");
    expect(expressPageSrc).toContain("selectExpressSize");
    expect(expressPageSrc).toContain("resolveExpressBuilderRoot");
    expect(expressPageSrc).toContain("refreshExpressWhoSizePanel");
    expect(expressPageSrc).toContain('root.addEventListener("click", onExpressSizeRowActivate)');
  });

  it("marks only the chosen size with selected state on first render", () => {
    const scope = buildExpressSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "6" }, true);

    expect(selectedRows(scope)).toHaveLength(1);
    const row = selectedRows(scope)[0]!;
    expect(row.getAttribute("data-value")).toBe("6");
    expect(row.getAttribute("aria-checked")).toBe("true");
    expect(row.querySelector(".express-size-row__check")?.textContent).toBe("\u2713");
    expect(badgeForRow(row)?.textContent).toBe("Selected");
    expect(sizeRows(scope).filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("moves selected state when the active size changes", () => {
    const scope = buildExpressSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "4" }, true);
    expect(selectedRows(scope)[0]?.getAttribute("data-value")).toBe("4");

    refreshExpressSizePanel(scope, { who: "women", selectedSize: "8" }, true);

    expect(selectedRows(scope)).toHaveLength(1);
    expect(selectedRows(scope)[0]?.getAttribute("data-value")).toBe("8");
    expect(sizeRows(scope).find((r) => r.getAttribute("data-value") === "4")?.classList.contains("is-selected")).toBe(
      false,
    );
    expect(badgeForRow(sizeRows(scope).find((r) => r.getAttribute("data-value") === "8")!)!.textContent).toBe(
      "Selected",
    );
    expect(badgeForRow(sizeRows(scope).find((r) => r.getAttribute("data-value") === "4")!)).toBeNull();
  });

  it("leaves drop shoulder builder on the shared size-selection implementation", () => {
    expect(dropShoulderBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/drop-shoulder/builder")',
    );
    expect(readFileSync(resolve("src/scripts/drop-shoulder-builder-page.ts"), "utf8")).toContain(
      'import "/src/scripts/sleeveless-builder-page.ts"',
    );
    expect(readFileSync(resolve("src/scripts/sleeveless-builder-page.ts"), "utf8")).toContain(
      'import "/src/scripts/sleeveless-express-page.ts"',
    );
  });
});
