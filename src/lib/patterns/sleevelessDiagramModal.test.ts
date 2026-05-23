import { describe, expect, it } from "vitest";
import {
  buildShapingNotationDiagramPrintDocument,
  getDiagramModeFromHost,
  getDiagramModeFromPanel,
  getDiagramHostFromTrigger,
  isDisplayedShapingNotationSvg,
  isShapingNotationDiagramHost,
  resolveDiagramViewMode,
  shouldShowShapingNotationDiagramPrint,
} from "./sleevelessDiagramModal";

function mockDiagramHost(opts: {
  piece?: "back" | "front";
  mode?: "sts-rows" | "shaping-notation";
  modeAttrOnly?: boolean;
}): HTMLElement {
  const attrs: Record<string, string> = {};
  if (opts.piece === "back") {
    attrs["data-sleeveless-back-diagram"] = "";
    if (opts.mode) attrs["data-sleeveless-back-diagram-mode"] = opts.mode;
  }
  if (opts.piece === "front") {
    attrs["data-sleeveless-front-diagram"] = "";
    if (opts.mode) attrs["data-sleeveless-front-diagram-mode"] = opts.mode;
  }
  const dataset: Record<string, string> = {};
  if (!opts.modeAttrOnly && opts.piece === "back" && opts.mode) {
    dataset.sleevelessBackDiagramMode = opts.mode;
  }
  if (!opts.modeAttrOnly && opts.piece === "front" && opts.mode) {
    dataset.sleevelessFrontDiagramMode = opts.mode;
  }
  return {
    hasAttribute: (name: string) => name in attrs,
    getAttribute: (name: string) => attrs[name] ?? null,
    closest: () => null,
    dataset,
  } as unknown as HTMLElement;
}

function mockSvg(ariaLabel: string): Element {
  return {
    getAttribute: (name: string) => (name === "aria-label" ? ariaLabel : null),
  } as unknown as Element;
}

function mockTrigger(opts: {
  host: HTMLElement | null;
  svgAriaLabel?: string;
}): HTMLElement {
  const svg =
    opts.svgAriaLabel !== undefined
      ? mockSvg(opts.svgAriaLabel)
      : null;
  return {
    querySelector: (sel: string) => {
      if (sel === "[data-sleeveless-diagram]") return opts.host;
      if (sel === ".sleeveless-piece-split__diagram-inline") return svg;
      return null;
    },
  } as unknown as HTMLElement;
}

function mockPanel(activeMode: "sts-rows" | "shaping-notation", piece: "back" | "front") {
  const attr =
    piece === "back"
      ? "data-sleeveless-back-diagram-mode-btn"
      : "data-sleeveless-front-diagram-mode-btn";
  return {
    querySelector: () =>
      ({
        getAttribute: (name: string) => (name === attr ? activeMode : null),
      }) as unknown as HTMLElement,
  } as unknown as ParentNode;
}

describe("sleevelessDiagramModal", () => {
  it("detects shaping notation mode on back diagram host via attribute", () => {
    const host = mockDiagramHost({ piece: "back", mode: "shaping-notation" });
    expect(getDiagramModeFromHost(host)).toBe("shaping-notation");
    expect(isShapingNotationDiagramHost(host)).toBe(true);
    const trigger = mockTrigger({ host });
    expect(getDiagramHostFromTrigger(trigger)).toBe(host);
    expect(shouldShowShapingNotationDiagramPrint(trigger)).toBe(true);
  });

  it("detects sts-rows mode on front diagram host", () => {
    const host = mockDiagramHost({ piece: "front", mode: "sts-rows" });
    expect(getDiagramModeFromHost(host)).toBe("sts-rows");
    expect(isShapingNotationDiagramHost(host)).toBe(false);
    expect(shouldShowShapingNotationDiagramPrint(mockTrigger({ host }))).toBe(false);
  });

  it("does not show print for diagrams without mode toggle", () => {
    const host = mockDiagramHost({});
    expect(getDiagramModeFromHost(host)).toBeNull();
    expect(shouldShowShapingNotationDiagramPrint(mockTrigger({ host }))).toBe(false);
  });

  it("reads mode from getAttribute when dataset is stale after toggle", () => {
    const host = mockDiagramHost({
      piece: "back",
      mode: "shaping-notation",
      modeAttrOnly: true,
    });
    expect(getDiagramModeFromHost(host)).toBe("shaping-notation");
  });

  it("uses active panel toggle when host mode attribute is still sts-rows", () => {
    const host = {
      ...mockDiagramHost({ piece: "back", mode: "sts-rows" }),
      closest: (sel: string) =>
        sel === ".sleeveless-back-diagram-panel"
          ? mockPanel("shaping-notation", "back")
          : null,
    } as unknown as HTMLElement;
    expect(resolveDiagramViewMode(host)).toBe("shaping-notation");
    expect(getDiagramModeFromPanel(mockPanel("shaping-notation", "back"))).toBe(
      "shaping-notation",
    );
  });

  it("shows print from displayed SVG aria-label after toggle (host still sts-rows)", () => {
    const host = mockDiagramHost({ piece: "back", mode: "sts-rows" });
    const trigger = mockTrigger({
      host,
      svgAriaLabel: "Sleeveless back piece shaping notation diagram",
    });
    expect(
      isDisplayedShapingNotationSvg(
        mockSvg("Sleeveless back piece shaping notation diagram"),
      ),
    ).toBe(true);
    expect(shouldShowShapingNotationDiagramPrint(trigger)).toBe(true);
  });

  it("hides print when displayed SVG is stitches and rows (host says notation)", () => {
    const host = mockDiagramHost({ piece: "front", mode: "shaping-notation" });
    const trigger = mockTrigger({
      host,
      svgAriaLabel: "Sleeveless front piece diagram",
    });
    expect(shouldShowShapingNotationDiagramPrint(trigger)).toBe(false);
  });

  it("front cardigan notation mode via panel and SVG", () => {
    const host = {
      ...mockDiagramHost({ piece: "front", mode: "shaping-notation" }),
      closest: (sel: string) =>
        sel === ".sleeveless-back-diagram-panel"
          ? mockPanel("shaping-notation", "front")
          : null,
    } as unknown as HTMLElement;
    expect(resolveDiagramViewMode(host)).toBe("shaping-notation");
    const trigger = mockTrigger({
      host,
      svgAriaLabel: "Sleeveless front piece shaping notation diagram",
    });
    expect(shouldShowShapingNotationDiagramPrint(trigger)).toBe(true);
  });

  it("builds a minimal print document containing the svg", () => {
    const html = buildShapingNotationDiagramPrintDocument(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      "Back shaping notation",
    );
    expect(html).toContain("<svg");
    expect(html).toContain("print-diagram-root");
    expect(html).toContain("<title>Back shaping notation</title>");
  });
});
