import { describe, expect, it } from "vitest";
import {
  BACK_DIAGRAM_STS_ROWS_SRC,
  JP_BACK_NOTATION_SVG_SRC,
  SLEEVELESS_BACK_DIAGRAM_STS_ROWS_SRC,
  SLEEVELESS_BACK_JP_NOTATION_DIAGRAM_SRC,
  resolveSleevelessBackDiagramSrc,
} from "./sleevelessBackDiagramSrc";

describe("sleeveless back diagram routing", () => {
  it("uses diagram-back.svg for sts-rows and diagram-jp-back.svg for notation", () => {
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
});
