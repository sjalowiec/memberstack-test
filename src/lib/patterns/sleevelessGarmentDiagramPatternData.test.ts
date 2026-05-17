import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { buildSleevelessGarmentDiagramPatternData } from "./sleevelessPatternBuilderMerge";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { resolveSleevelessFrontDiagram } from "./sleevelessFrontDiagramSrc";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

describe("buildSleevelessGarmentDiagramPatternData", () => {
  it("routes front schematic from generator style, not stale root-level neckline", () => {
    const patternMerged = {
      style: {},
      neckline: "round",
      fit: { selectedMeasurements: baseMeasurements },
    };
    const generatorPatternData = {
      style: { neckline: "v" },
      fit: { selectedMeasurements: baseMeasurements },
    };

    const diagramData = buildSleevelessGarmentDiagramPatternData(patternMerged, generatorPatternData);
    const fromMergedOnly = resolveSleevelessFrontDiagram(patternMerged);
    const fromDiagramData = resolveSleevelessFrontDiagram(diagramData);

    expect(fromMergedOnly.diagramType).toBe("pulloverFullFrontRound");
    expect(fromDiagramData.diagramType).toBe("pulloverFullFrontV");
    expect(fromDiagramData.src.endsWith("/diagram-front-V.svg")).toBe(true);
  });

  it("matches cardigan half-front routing used by pattern generation", () => {
    const patternMerged = {
      style: { neckline: "round", garmentStyle: "cardigan", frontStyle: "open" },
      fit: { selectedMeasurements: baseMeasurements },
    };
    const generatorPatternData = {
      style: { neckline: "round", garmentStyle: "cardigan", frontStyle: "open", patternMode: "custom-build" },
      fit: {
        selectedMeasurements: baseMeasurements,
        cbMeasurementOverrides: { armholeDepth: "10" },
      },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    };

    const genResult = generateSleevelessBackPattern(generatorPatternData);
    const diagramData = buildSleevelessGarmentDiagramPatternData(patternMerged, generatorPatternData);
    const front = resolveSleevelessFrontDiagram(diagramData);

    expect(genResult.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(front.diagramType).toBe("cardiganHalfFrontRound");
    expect(front.src.endsWith("/cardigan-round.svg")).toBe(true);

    const repl = buildSleevelessGarmentDiagramReplacements(genResult, "in", {
      patternData: diagramData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    expect(repl.ARMHOLE_DEPTH).toBe("10");
    expect(repl.ARMHOLE_ROWS).toBe(String(genResult.debug.armholeRows));
  });
});
