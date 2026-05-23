import { describe, expect, it } from "vitest";
import { buildSleevelessBodyBlockPlan } from "./bodyBlock/sleevelessBodyBlock";
import {
  buildBodyShapeGuideSvgFragment,
  diagramGuidesForAppliedBodyShaping,
  SLEEVELESS_BODY_SHAPE_GUIDE_STROKE,
} from "./sleevelessBodyShapeDiagramGuides";
import type { SleevelessBodyDiagramGuides } from "./bodyBlock/sleevelessBodyBlock";

const alineDecreaseGuides: SleevelessBodyDiagramGuides = {
  showBodyShapeGuides: true,
  bodyShapeKind: "aline",
  shapingDirection: "decrease",
  hemStitches: 110,
  bustStitches: 100,
  hemCircumferenceInches: 44,
  bustCircumferenceInches: 40,
};

describe("diagramGuidesForAppliedBodyShaping", () => {
  it("clears guides when A-line shaping is not active", () => {
    const synced = diagramGuidesForAppliedBodyShaping(alineDecreaseGuides, false);
    expect(synced.showBodyShapeGuides).toBe(false);
    expect(synced.bodyShapeKind).toBe("straight");
    expect(synced.shapingDirection).toBe("none");
    expect(synced.hemStitches).toBe(alineDecreaseGuides.bustStitches);
    expect(buildBodyShapeGuideSvgFragment(synced, "back")).toBe("");
  });

  it("preserves guides when A-line shaping is active without dedicated SVG", () => {
    const synced = diagramGuidesForAppliedBodyShaping(alineDecreaseGuides, true);
    expect(synced.showBodyShapeGuides).toBe(true);
    expect(buildBodyShapeGuideSvgFragment(synced, "back")).toContain('id="body-shape-guides"');
  });

  it("suppresses guides when dedicated body-shape diagram SVG is used", () => {
    const synced = diagramGuidesForAppliedBodyShaping(alineDecreaseGuides, true, true);
    expect(synced.showBodyShapeGuides).toBe(false);
    expect(synced.bodyShapeKind).toBe("aline");
    expect(buildBodyShapeGuideSvgFragment(synced, "back")).toBe("");
  });
});

describe("buildBodyShapeGuideSvgFragment", () => {
  it("returns empty for straight / hidden guides", () => {
    expect(
      buildBodyShapeGuideSvgFragment(
        { ...alineDecreaseGuides, showBodyShapeGuides: false, bodyShapeKind: "straight" },
        "back",
      ),
    ).toBe("");
  });

  it("renders dashed green side lines for A-line decrease on back layout", () => {
    const frag = buildBodyShapeGuideSvgFragment(alineDecreaseGuides, "back");
    expect(frag).toContain('id="body-shape-guides"');
    expect(frag).toContain(`stroke="${SLEEVELESS_BODY_SHAPE_GUIDE_STROKE}"`);
    expect(frag).toContain('stroke-dasharray="4 3"');
    expect(frag).toContain('stroke-width="1.5"');
    expect(frag).toContain('opacity="0.72"');
    expect(frag).not.toContain("#f00");
    expect(frag).not.toContain("red");
    expect((frag.match(/<line/g) ?? []).length).toBe(2);
  });

  it("bust 38 hip 44 decrease: hem endpoints sit clearly outside bust guide anchors", () => {
    const plan = buildSleevelessBodyBlockPlan({
      garmentStyle: "pullover",
      pieceRole: "back",
      bustCircumferenceInches: 38,
      hipCircumferenceInches: 44,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      rowsToArmhole: 100,
      hemRows: 14,
    });
    expect(plan.diagramGuides.showBodyShapeGuides).toBe(true);
    expect(plan.diagramGuides.shapingDirection).toBe("decrease");

    const frag = buildBodyShapeGuideSvgFragment(plan.diagramGuides, "back");
    const leftBustX = 40.5 - 3;
    const rightBustX = 169.5 + 3;
    const leftLine = frag.match(
      new RegExp(`x1="${leftBustX}" y1="131\\.5" x2="([\\d.]+)" y2="256"`),
    );
    const rightLine = frag.match(
      new RegExp(`x1="${rightBustX}" y1="131\\.5" x2="([\\d.]+)" y2="256"`),
    );
    expect(leftLine).not.toBeNull();
    expect(rightLine).not.toBeNull();
    const leftHemX = Number(leftLine![1]);
    const rightHemX = Number(rightLine![1]);
    expect(leftBustX - leftHemX).toBeGreaterThanOrEqual(15);
    expect(rightHemX - rightBustX).toBeGreaterThanOrEqual(15);
    expect(leftHemX).toBe(leftBustX - 15);
    expect(rightHemX).toBe(rightBustX + 15);
  });

  it("uses shapingDirection increase without re-deriving from measurements", () => {
    const frag = buildBodyShapeGuideSvgFragment(
      { ...alineDecreaseGuides, shapingDirection: "increase", hemStitches: 90 },
      "back",
    );
    expect(frag).toContain("<line");
    const decreaseFrag = buildBodyShapeGuideSvgFragment(alineDecreaseGuides, "back");
    expect(frag).not.toBe(decreaseFrag);
  });
});
