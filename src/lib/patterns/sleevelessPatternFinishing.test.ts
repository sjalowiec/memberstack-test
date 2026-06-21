import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  buildSleevelessFinishingStepIds,
  cardiganFrontEdgeRowsFromDebug,
  coreAssemblyFinishingStepIds,
  sleevelessCardiganFrontEdgeFinishingMode,
  sleevelessFinishingFromPattern,
} from "./sleevelessPatternFinishing";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "./sleevelessPatternFinishingHtml";

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

function vNeckCardiganPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline: "v-neck", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  };
}

function dropShoulderPulloverPattern(): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: {
      neckline: "round",
      frontStyle: "closed",
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
    },
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

  it("drop-shoulder pullover omits finishArmholes", () => {
    expect(buildSleevelessFinishingStepIds({ isCardigan: false, isDropShoulder: true })).not.toContain(
      "finishArmholes",
    );
    expect(coreAssemblyFinishingStepIds({ isCardigan: false, isDropShoulder: true })).toEqual([
      "joinShoulders",
      "finishNeckline",
      "joinSideSeams",
    ]);
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

  it("cardigan front-edge finishing mode follows neckline", () => {
    expect(sleevelessCardiganFrontEdgeFinishingMode(cardiganPattern())).toBe("pickup");
    expect(sleevelessCardiganFrontEdgeFinishingMode(vNeckCardiganPattern())).toBe("verticalBand");
    expect(sleevelessCardiganFrontEdgeFinishingMode(pulloverPattern())).toBeUndefined();
  });

  it("round-neck cardigan: front-edge row count and pickup stitches from neckline start RC", () => {
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
    expect(finishing.cardiganFrontEdgeFinishingMode).toBe("pickup");
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

  it("v-neck cardigan: debug pickup math unchanged; finishing uses vertical bands", () => {
    const pattern = vNeckCardiganPattern();
    const r = generateSleevelessBackPattern(pattern);
    expect(r.debug.cardiganFrontEdgePickupSts).toBeGreaterThan(0);
    const finishing = sleevelessFinishingFromPattern(pattern, r.debug);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.cardiganFrontEdgeFinishingMode).toBe("verticalBand");
    expect(finishing.frontEdgePickupSts).toBeUndefined();
    expect(finishing.steps.map((s) => s.id)).toContain("finishFrontEdges");
  });
});

describe("buildSleevelessFinishingStepsHtml", () => {
  const deps = {
    escapeHtml: (s: string) => s,
    glossaryTooltip: (_id: number, term: string) => term,
    neckFinishingVideoKey: "onePieceBand",
    neckFinishingButtonLabel: "One-piece neckband",
    neckFinishingLeadHtml: "",
  };

  it("round-neck cardigan finish front edges includes turning row instructions", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
      frontEdgePickupSts: 99,
      deps,
    });
    expect(html).toContain("Knit 1 turning row.");
    expect(html).toContain("Fold the band on the turning row and stitch it down.");
  });

  it("renders numbered steps without duplicate numbers for round-neck cardigan", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
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

  it("v-neck cardigan finish front edges uses vertical band instructions", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "verticalBand",
      deps,
    });
    expect(html).toContain("Finish Front Edges");
    expect(html).toContain("vertical front band");
    expect(html).toContain("Knit the band vertically to match the front edge length");
    expect(html).not.toContain("Pick up approximately");
    expect(html).not.toContain("turning row");
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

  it("drop-shoulder pullover html omits Finish Armholes and uses cuff-to-hem side seams", () => {
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isDropShoulder: true,
      deps,
    });
    expect(html).not.toContain("Finish Armholes");
    expect(html).toMatch(/3\. Finish Neckline/);
    expect(html).toMatch(/4\. Join Side Seams/);
    expect(html).toContain("Seam from cuff to hem.");
    expect(html).not.toContain("Seam from hem to underarm.");
  });

  it("drop-shoulder pullover finishing from pattern omits armhole step", () => {
    const finishing = sleevelessFinishingFromPattern(dropShoulderPulloverPattern(), {});
    expect(finishing.isDropShoulder).toBe(true);
    expect(finishing.steps.some((s) => s.id === "finishArmholes")).toBe(false);
    expect(finishing.steps.find((s) => s.id === "joinSideSeams")?.stepNumber).toBe(4);
  });

  it("includes neckline finishing help video links for pullover and cardigan", () => {
    for (const isCardigan of [false, true]) {
      const html = buildSleevelessFinishingStepsHtml({
        isCardigan,
        cardiganFrontEdgeFinishingMode: isCardigan ? "pickup" : undefined,
        deps,
      });
      expect(html).toContain("Need help finishing the neckline?");
      expect(html).toContain(
        'href="https://app.knititnow.com/videos/386/?q=v-neck"',
      );
      expect(html).toContain("V-Neck Finishing Instructions");
      expect(html).toContain(
        'href="https://app.knititnow.com/videos/695/?q=band"',
      );
      expect(html).toContain("Round Neck Finishing Instructions");
      expect(html).toContain('target="_blank"');
    }
  });
});

describe("buildSleevelessFinishingPrintListHtml", () => {
  it("round-neck cardigan print line includes pickup stitch count", () => {
    const html = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "pickup",
      frontEdgePickupSts: 99,
    });
    expect(html).toContain("pick up 99 stitches");
    expect(html).not.toContain("knit each front band vertically");
  });

  it("v-neck cardigan print line describes vertical bands", () => {
    const html = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      cardiganFrontEdgeFinishingMode: "verticalBand",
    });
    expect(html).toContain("knit each front band vertically");
    expect(html).not.toContain("pick up");
  });
});
