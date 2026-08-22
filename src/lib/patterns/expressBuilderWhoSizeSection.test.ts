import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildExpressStandardBodyMeasurementsSummary,
  patchExpressStandardBodyMeasurementsSummary,
  refreshExpressSizePanel,
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  EXPRESS_BUILDER_SIZE_HEADING,
  EXPRESS_BUILDER_SIZE_INSTRUCTION,
  EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN,
  EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL,
} from "./expressBuilderCopy";

const whoSizeSection = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoSizeSection.astro"),
  "utf8",
);
const whoPicker = readFileSync(
  resolve("src/components/patterns/ExpressBuilderWhoPicker.astro"),
  "utf8",
);
const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const customBuildDesignAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/custom-build/design/index.astro"),
  "utf8",
);

const missesRows: ChartRow[] = [
  { size: 4, bust_or_chest: 33, waist: 25, hip: 35, upper_arm: 11 },
  { size: 6, bust_or_chest: 35, waist: 27, hip: 37, upper_arm: 11.5 },
];
const kidsRows: ChartRow[] = [
  { size: "4 yr", bust_or_chest: 25, waist: 23, hip: 27, upper_arm: 8 },
  { size: "6 yr", bust_or_chest: 26.5, waist: 24, hip: 28.5, upper_arm: 8.5 },
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
    if (name === "hidden") this.hidden = true;
  }

  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }

  removeAttribute(name: string): void {
    delete this.attrs[name];
    if (name === "hidden") this.hidden = false;
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

  after(node: FakeElement): void {
    const parent = this.parentElement;
    if (!parent) return;
    const index = parent.children.indexOf(this);
    node.parentElement = parent;
    parent.children.splice(index + 1, 0, node);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
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

/** Mirrors ExpressBuilderWhoSizeSection.astro + data-express-builder wrapper. */
function buildSleevelessBuilderSizeScope(): FakeElement {
  const scope = new FakeElement("DIV");
  scope.setAttribute("data-express-builder", "");

  const intro = new FakeElement("DIV", ["express-who-size-intro"]);
  const heading = new FakeElement("H3", ["express-size-heading"]);
  heading.textContent = EXPRESS_BUILDER_SIZE_HEADING;
  const instruction = new FakeElement("P", ["express-size-instruction"]);
  instruction.setAttribute("id", "express-size-helper-text");
  instruction.textContent = EXPRESS_BUILDER_SIZE_INSTRUCTION;
  const linkWrap = new FakeElement("P", ["express-size-chart-link-wrap"]);
  const link = new FakeElement("A");
  link.setAttribute("data-express-sweater-sizing-chart-link", "");
  link.textContent = EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL;
  linkWrap.appendChild(link);
  intro.append(heading, instruction, linkWrap);

  const nested = new FakeElement("DIV", ["express-who-size-nested"]);
  nested.setAttribute("data-express-nested-size", "");
  nested.setAttribute("hidden", "");

  const tableBody = new FakeElement("TBODY");
  tableBody.setAttribute("data-express-size-table-body", "");
  const table = new FakeElement("TABLE");
  table.appendChild(tableBody);
  const select = new FakeSelectElement("SELECT");
  select.setAttribute("data-express-size-select", "");
  const wrap = new FakeElement("DIV");
  wrap.setAttribute("data-express-size-select-wrap", "");
  wrap.append(table, select);

  const summary = new FakeElement("DIV", ["express-size-standard-body-summary"]);
  summary.setAttribute("data-express-size-standard-body-summary", "");
  summary.setAttribute("hidden", "");

  nested.append(wrap, summary);
  scope.append(intro, nested);
  return scope;
}

function summaryEl(scope: FakeElement): FakeElement | null {
  return scope.querySelector("[data-express-size-standard-body-summary]");
}

describe("ExpressBuilderWhoSizeSection shared markup", () => {
  it("includes the full size introduction and sizing chart link", () => {
    expect(whoSizeSection).toContain("expressBuilderCopy");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_HEADING");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_INSTRUCTION");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL");
    expect(whoSizeSection).toContain("{EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL}");
    expect(EXPRESS_BUILDER_SWEATER_SIZING_CHART_LINK_LABEL).toBe("View the sweater sizing chart");
    expect(EXPRESS_BUILDER_SIZE_INSTRUCTION).toContain("Select the body bust/chest measurement closest to your own");
    expect(EXPRESS_BUILDER_SIZE_INSTRUCTION).toContain("Knit It Now standard sizing chart");
    expect(EXPRESS_BUILDER_SIZE_INSTRUCTION).toContain("starting point for your sweater");
    expect(whoSizeSection).toContain("EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN");
    expect(EXPRESS_BUILDER_SIZE_TABLE_BODY_BUST_CHEST_COLUMN).toBe("Body Bust/Chest");
    expect(whoSizeSection).toContain("data-express-size-standard-body-summary");
    expect(whoSizeSection).toContain("express-who-size-intro");
    expect(whoSizeSection).toContain("data-express-nested-size");
  });

  it("wires the shared section into both unified builders", () => {
    expect(sleevelessBuilderAstro).toContain("ExpressBuilderWhoSizeSection");
    expect(dropShoulderBuilderAstro).toContain("ExpressBuilderWhoSizeSection");
    expect(sleevelessBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/sleeveless/builder")',
    );
    expect(dropShoulderBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/drop-shoulder/builder")',
    );
  });

  it("shares text-only Size Range options with unchanged who values", () => {
    expect(whoSizeSection).toContain("ExpressBuilderWhoPicker");
    expect(whoPicker).toContain('data-field="who"');
    expect(whoPicker).toContain('data-value={opt.value}');
    expect(whoPicker).toContain('{ value: "women", label: "Women" }');
    expect(whoPicker).toContain('{ value: "men", label: "Men" }');
    expect(whoPicker).toContain('{ value: "kids", label: "Kids" }');
    expect(whoPicker).toContain('{ value: "baby", label: "Baby" }');
    expect(whoPicker).toContain("express-options--who-text");
    expect(whoPicker).not.toContain("<img");
    expect(sleevelessBuilderAstro).not.toContain('data-field="who"');
    expect(dropShoulderBuilderAstro).not.toContain('data-field="who"');
    expect(sleevelessBuilderAstro).not.toContain("sleeveless-woman-pullover-round-neck.webp");
    expect(dropShoulderBuilderAstro).not.toContain("drop-woman-pullover-round.webp");
  });

  it("reuses the shared text who picker in Custom Build Design", () => {
    expect(customBuildDesignAstro).toContain("ExpressBuilderWhoPicker");
    expect(customBuildDesignAstro).not.toContain("<img");
    expect(customBuildDesignAstro).not.toContain("sleeveless-woman-pullover-round-neck.webp");
    expect(customBuildDesignAstro).toContain("Who are you knitting for?");
  });

  it("removes obsolete audience-card image refresh from builder clients", () => {
    const expressPageSrc = readFileSync(resolve("src/scripts/sleeveless-express-page.ts"), "utf8");
    const customBuildDesignPageSrc = readFileSync(
      resolve("src/scripts/sleeveless-custom-build-design-page.ts"),
      "utf8",
    );
    expect(expressPageSrc).not.toContain("refreshExpressWhoCardHeroImages");
    expect(expressPageSrc).not.toContain("expressPatternDataForAudienceHeroImages");
    expect(expressPageSrc).not.toContain("resolveSleevelessAudienceHeroImageSrc");
    expect(customBuildDesignPageSrc).not.toContain("refreshCbDesignWhoCardImages");
    expect(customBuildDesignPageSrc).not.toContain("resolveSleevelessAudienceHeroImageSrc");
  });
});

describe("Sleeveless builder size panel runtime rendering", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("HTMLSelectElement", FakeSelectElement);
    vi.stubGlobal("document", {
      createElement: (tag: string) =>
        tag.toLowerCase() === "select" ? new FakeSelectElement("SELECT") : new FakeElement(tag),
      querySelector: () => null,
    });
    seedExpressSweaterChartsForTests("misses", missesRows);
    seedExpressSweaterChartsForTests("kids", kidsRows);
  });

  afterEach(() => {
    resetExpressSweaterChartsForTests();
    vi.unstubAllGlobals();
  });

  it("renders the standard body measurements panel after a size is selected", () => {
    const scope = buildSleevelessBuilderSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "6" }, true);

    const panel = summaryEl(scope);
    expect(panel?.hasAttribute("hidden")).toBe(false);
    expect(panel?.innerHTML).toContain("Size 6 standard body measurements");
    expect(panel?.innerHTML).toContain("Bust/Chest");
    expect(panel?.innerHTML).toContain("Waist");
    expect(panel?.innerHTML).toContain("Hip");
    expect(panel?.innerHTML).toContain("Upper Arm");
    expect(panel?.innerHTML).toContain('35"');
  });

  it("updates panel values when the selected size changes", () => {
    const scope = buildSleevelessBuilderSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "4" }, true);
    expect(summaryEl(scope)?.innerHTML).toContain('33"');

    refreshExpressSizePanel(scope, { who: "women", selectedSize: "6" }, true);
    expect(summaryEl(scope)?.innerHTML).toContain("Size 6 standard body measurements");
    expect(summaryEl(scope)?.innerHTML).toContain('35"');
    expect(summaryEl(scope)?.innerHTML).not.toContain('33"');
  });

  it("updates panel heading and values when the audience changes", () => {
    const scope = buildSleevelessBuilderSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "6" }, true);
    expect(summaryEl(scope)?.innerHTML).toContain("Size 6 standard body measurements");

    refreshExpressSizePanel(scope, { who: "kids", selectedSize: "4 yr" }, true);
    const html = summaryEl(scope)?.innerHTML ?? "";
    expect(html).toContain("Size 4 yr standard body measurements");
    expect(html).toContain('25"');
    expect(html).not.toContain("Size 6 standard body measurements");
  });

  it("hides the panel and clears stale values when audience is cleared", () => {
    const scope = buildSleevelessBuilderSizeScope();
    refreshExpressSizePanel(scope, { who: "women", selectedSize: "6" }, true);
    refreshExpressSizePanel(scope, { who: "" }, true);

    const panel = summaryEl(scope);
    expect(panel?.innerHTML).toBe("");
    expect(panel?.hasAttribute("hidden")).toBe(true);
  });

  it("builds panel values from shared chart data via buildExpressStandardBodyMeasurementsSummary", () => {
    const summary = buildExpressStandardBodyMeasurementsSummary({
      who: "women",
      selectedSize: "6",
    });
    expect(summary?.heading).toBe("Size 6 standard body measurements");
    expect(summary?.measurements.find((m) => m.label === "Bust/Chest")?.value).toBe('35"');
    expect(summary?.measurements.find((m) => m.label === "Upper Arm")?.value).toBe('11.5"');
  });

  it("patchExpressStandardBodyMeasurementsSummary is invoked by refreshExpressSizePanel", () => {
    const scope = buildSleevelessBuilderSizeScope();
    patchExpressStandardBodyMeasurementsSummary(scope, { who: "women", selectedSize: "4" });
    expect(summaryEl(scope)?.innerHTML).toContain("Size 4 standard body measurements");
  });
});
