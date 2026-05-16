import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  buildSleevelessFinishingStepIds,
  cardiganFrontEdgeRowsFromDebug,
  coreAssemblyFinishingStepIds,
  sleevelessFinishingFromPattern,
} from "./sleevelessPatternFinishing";
import { buildSleevelessFinishingStepsHtml } from "./sleevelessPatternFinishingHtml";

function baseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function gauge() {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function pulloverPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "closed" },
    yarnGaugeMachine: gauge(),
  };
}

function cardiganPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "round", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  };
}

describe("buildSleevelessFinishingStepIds", () => {
  it("pullover core order: shoulders, armholes, neckline, side seams", () => {
    expect(coreAssemblyFinishingStepIds({ isCardigan: false })).toEqual([
      "joinShoulders",
      "finishArmholes",
      "finishNeckline",
      "joinSideSeams",
    ]);
  });

  it("cardigan core order inserts finishFrontEdges before neckline", () => {
    expect(coreAssemblyFinishingStepIds({ isCardigan: true })).toEqual([
      "joinShoulders",
      "finishArmholes",
      "finishFrontEdges",
      "finishNeckline",
      "joinSideSeams",
    ]);
  });

  it("pullover does not include finishFrontEdges", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: false })).not.toContain("finishFrontEdges");
  });

  it("cardigan includes finishFrontEdges", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: true })).toContain("finishFrontEdges");
  });
});

describe("generateSleevelessBackPattern finishing integration", () => {
  it("pullover: no front-edge pickup debug fields", () => {
    const r = generateSleevelessBackPattern(pulloverPattern());
    expect(r.debug.cardiganFrontEdgeRows).toBeUndefined();
    expect(r.debug.cardiganFrontEdgePickupSts).toBeUndefined();
    const finishing = sleevelessFinishingFromPattern(pulloverPattern(), r.debug);
    expect(finishing.isCardigan).toBe(false);
    expect(finishing.steps.some((s) => s.id === "finishFrontEdges")).toBe(false);
  });

  it("cardigan: front-edge row count and pickup stitches from neckline start RC", () => {
    const pattern = cardiganPattern();
    const r = generateSleevelessBackPattern(pattern);
    expect(r.debug.frontNecklineStartRC).toBeGreaterThan(1);
    const expectedRows = cardiganFrontEdgeRowsFromDebug({
      frontNecklineStartRC: r.debug.frontNecklineStartRC,
    });
    expect(r.debug.cardiganFrontEdgeRows).toBe(expectedRows);
    expect(r.debug.cardiganFrontEdgePickupSts).toBeGreaterThan(0);
    const finishing = sleevelessFinishingFromPattern(pattern, r.debug);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.frontEdgePickupSts).toBe(r.debug.cardiganFrontEdgePickupSts);
    const titles = finishing.steps.map((s) => s.title);
    expect(titles).toContain("Finish Front Edges");
    const coreTitles = finishing.steps
      .filter((s) =>
        ["joinShoulders", "finishArmholes", "finishFrontEdges", "finishNeckline", "joinSideSeams"].includes(
          s.id,
        ),
      )
      .map((s) => s.title);
    expect(coreTitles).toEqual([
      "Join Shoulders",
      "Finish Armholes",
      "Finish Front Edges",
      "Finish Neckline",
      "Join Side Seams",
    ]);
  });
});

describe("buildSleevelessFinishingStepsHtml", () => {
  const deps = {
    escapeHtml: (s: string) => s,
    glossaryTooltip: (_id: number, term: string) => term,
    oneShoulderFinishingHelpHtml: () => "one shoulder",
    neckFinishingVideoKey: "onePieceBand",
    neckFinishingButtonLabel: "One-piece neckband",
    neckFinishingLeadHtml: "",
  };

  it("cardigan finish front edges wraps turning row with glossary id 324", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      frontEdgePickupSts: 99,
      deps: {
        ...deps,
        glossaryTooltip: (id, term) =>
          `<span data-glossary-id="${id}" data-term="${term}">${term}</span>`,
      },
    });
    const turningRowSpans = html.match(/data-glossary-id="324"[^>]*>turning row<\/span>/g);
    expect(turningRowSpans?.length).toBe(2);
    expect(html).toContain("Knit 1 <span data-glossary-id=\"324\"");
    expect(html).toContain("Fold the band on the <span data-glossary-id=\"324\"");
  });

  it("renders numbered steps without duplicate numbers for cardigan", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      frontEdgePickupSts: 99,
      deps,
    });
    expect(html).toContain("Finish Front Edges");
    expect(html).toContain("Pick up approximately 99 stitches");
    expect(html).not.toMatch(/5\. Finish Neckline[\s\S]*6\. Finish Armholes/);
    const finishFrontMatch = html.match(/(\d+)\. Finish Front Edges/);
    const finishNeckMatch = html.match(/(\d+)\. Finish Neckline/);
    const finishArmMatch = html.match(/(\d+)\. Finish Armholes/);
    expect(finishArmMatch && finishFrontMatch && finishNeckMatch).toBeTruthy();
    expect(Number(finishArmMatch![1])).toBeLessThan(Number(finishFrontMatch![1]));
    expect(Number(finishFrontMatch![1])).toBeLessThan(Number(finishNeckMatch![1]));
  });

  it("pullover html omits Finish Front Edges", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      deps,
    });
    expect(html).not.toContain("Finish Front Edges");
    expect(html).toMatch(/3\. Finish Armholes/);
    expect(html).toMatch(/4\. Finish Neckline/);
    expect(html).toMatch(/5\. Join Side Seams/);
  });
});
