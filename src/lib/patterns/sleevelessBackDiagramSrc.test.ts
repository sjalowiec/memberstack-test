import { describe, expect, it } from "vitest";
import {
  BACK_DIAGRAM_STS_ROWS_SRC,
  isSleevelessAlineBackDiagram,
  JP_BACK_NOTATION_SVG_SRC,
  resolveSleevelessBackDiagramSrc,
  SLEEVELESS_BACK_ALINE_DIAGRAM_STS_ROWS_SRC,
  SLEEVELESS_BACK_ALINE_JP_NOTATION_DIAGRAM_SRC,
  SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC,
  SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC,
} from "./sleevelessBackDiagramSrc";

const alineMeasurements = {
  fit: {
    selectedMeasurements: { finished_bust_chest: 38, finished_hip: 44 },
  },
  style: { bodyShape: "aline", garmentStyle: "pullover" },
};

describe("sleeveless back diagram routing", () => {
  it("uses diagram-back.svg for sts-rows and diagram-jp-back.svg for notation (straight)", () => {
    expect(SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back.svg",
    );
    expect(SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-back.svg",
    );
    expect(BACK_DIAGRAM_STS_ROWS_SRC).toBe(SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC);
    expect(JP_BACK_NOTATION_SVG_SRC).toBe(SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC);
    expect(resolveSleevelessBackDiagramSrc("sts-rows")).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back.svg",
    );
    expect(resolveSleevelessBackDiagramSrc("shaping-notation")).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-back.svg",
    );
  });

  it("uses A-line SVGs for sts-rows and shaping notation when body shape is A-line", () => {
    expect(isSleevelessAlineBackDiagram(alineMeasurements)).toBe(true);
    expect(resolveSleevelessBackDiagramSrc("sts-rows", alineMeasurements)).toBe(
      SLEEVELESS_BACK_ALINE_DIAGRAM_STS_ROWS_SRC,
    );
    expect(resolveSleevelessBackDiagramSrc("shaping-notation", alineMeasurements)).toBe(
      SLEEVELESS_BACK_ALINE_JP_NOTATION_DIAGRAM_SRC,
    );
    expect(SLEEVELESS_BACK_ALINE_DIAGRAM_STS_ROWS_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back-aline.svg",
    );
    expect(SLEEVELESS_BACK_ALINE_JP_NOTATION_DIAGRAM_SRC).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-back-aline.svg",
    );
  });

  it("keeps straight routing when bust and hip match", () => {
    const straight = {
      fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
      style: { bodyShape: "straight" },
    };
    expect(isSleevelessAlineBackDiagram(straight)).toBe(false);
    expect(resolveSleevelessBackDiagramSrc("sts-rows", straight)).toBe(SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC);
  });

  it("uses shaped SVGs when bodyShape is shaped", () => {
    const shaped = {
      fit: { selectedMeasurements: { finished_bust_chest: 40, finished_hip: 40 } },
      style: { bodyShape: "shaped" },
    };
    expect(isSleevelessAlineBackDiagram(shaped)).toBe(false);
    expect(resolveSleevelessBackDiagramSrc("sts-rows", shaped)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back-shaped.svg",
    );
    expect(resolveSleevelessBackDiagramSrc("shaping-notation", shaped)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-jp-back-shaped.svg",
    );
  });
});
