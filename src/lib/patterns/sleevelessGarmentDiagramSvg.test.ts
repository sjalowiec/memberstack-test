import { describe, expect, it } from "vitest";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";

describe("applyGarmentDiagramSvgReplacements", () => {
  it("replaces placeholders split across Illustrator tspans", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text><tspan>{{SHOULDER_BINDOFF_S</tspan><tspan>T</tspan><tspan>S}} sts</tspan></text></svg>`;
    const out = applyGarmentDiagramSvgReplacements(svg, { SHOULDER_BINDOFF_STS: "15" });
    expect(out).toContain("15 sts");
    expect(out).not.toMatch(/\{\{/);
  });
});
