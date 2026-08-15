import { describe, expect, it } from "vitest";
import {
  SWIRL_CROWN_SECTION_COUNT_FALLBACK,
  SWIRL_DECREASE_EDGE,
  SWIRL_REPRESENTATIVE_SECTION,
  buildSwirlCrownGeometry,
} from "./hatSwirlCrownGeometry";

describe("buildSwirlCrownGeometry", () => {
  it("builds one-sided trailing decrease sections from the calculated count", () => {
    const geometry = buildSwirlCrownGeometry({
      hatLeft: 100,
      hatWidth: 180,
      tipY: 40,
      bodyTop: 120,
      sectionCount: 6,
    });

    expect(geometry.sectionCount).toBe(6);
    expect(geometry.decreaseEdge).toBe(SWIRL_DECREASE_EDGE);
    expect(geometry.decreaseEdge).toBe("trailing");
    expect(geometry.sections).toHaveLength(6);
    expect(geometry.representativeIndex).toBe(SWIRL_REPRESENTATIVE_SECTION);

    for (const section of geometry.sections) {
      expect(section.decreaseEdge).toBe("trailing");
      expect(section.nonDecreaseEdge).toBe("leading");
      // Vertical non-decrease edge shares x; diagonal ends further right.
      expect(section.right).toBeGreaterThan(section.left);
      expect(section.pathD).toContain(`M ${section.left} ${section.bodyTop}`);
      expect(section.pathD).toContain(`L ${section.left} ${section.tipY}`);
      expect(section.pathD).toContain(`L ${section.right} ${section.bodyTop}`);
    }

    // Sawtooth outline — not a centered dome path.
    expect(geometry.outlinePoints.split(" ").length).toBe(1 + 6 * 2);
    expect(geometry.outlinePoints).toContain("100,120");
  });

  it("falls back to the shared section count when given a non-positive value", () => {
    const geometry = buildSwirlCrownGeometry({
      hatLeft: 0,
      hatWidth: 120,
      tipY: 10,
      bodyTop: 80,
      sectionCount: 0,
    });
    expect(geometry.sectionCount).toBe(SWIRL_CROWN_SECTION_COUNT_FALLBACK);
    expect(geometry.sections).toHaveLength(SWIRL_CROWN_SECTION_COUNT_FALLBACK);
  });
});
