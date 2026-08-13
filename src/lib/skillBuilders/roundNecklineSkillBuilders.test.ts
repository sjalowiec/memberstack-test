import { describe, expect, it } from "vitest";

import {
  buildRoundNecklineSkillBuilderDiagramHtml,
  buildRoundNecklineSkillBuilderDiagramSvg,
  buildRoundNecklineSkillBuilderShapingMapData,
} from "./roundNecklineSkillBuilderDiagram";
import {
  calculateRoundNecklineSkillBuilder,
  ROUND_NECKLINE_SKILL_BUILDERS,
  formatSkillBuilderRowCounter,
  PAUSE_AND_CHECK_TEXT,
  roundNecklineSkillBuilderIsMemberOnly,
  SAVE_THIS_PRACTICE_PIECE_NOTE,
  SHAPING_ROW_COUNTER_START,
  SHOULDER_WORKFLOW_HEADING,
  SHOULDER_WORKFLOW_TEACHING_NOTE,
} from "./roundNecklineSkillBuilders";
import { ROUND_NECKLINE_SKILL_BUILDER_VIDEOS } from "./roundNecklineSkillBuilderVideos";
import { formatCenterStitchesLabel } from "../patterns/shapingMapSvg";

const SAMPLE_GAUGE = { stitchesPerFourInches: 16, rowsPerFourInches: 24 };
const FINER_GAUGE = { stitchesPerFourInches: 28, rowsPerFourInches: 40 };

const BUILDERS = [
  "round-neckline-basics",
  "round-necklines-shaped-shoulders",
] as const;
const EXERCISES = ["shallow-back", "deep-front"] as const;

function result(
  builderId: (typeof BUILDERS)[number],
  exerciseId: (typeof EXERCISES)[number],
  gauge = SAMPLE_GAUGE,
) {
  return calculateRoundNecklineSkillBuilder(gauge, builderId, exerciseId)!;
}

describe("round neckline Skill Builder catalog", () => {
  it("defines two public builders with two exercises each", () => {
    expect(Object.keys(ROUND_NECKLINE_SKILL_BUILDERS)).toEqual([
      "round-neckline-basics",
      "round-necklines-shaped-shoulders",
    ]);
    expect(ROUND_NECKLINE_SKILL_BUILDERS["round-neckline-basics"].exercises).toHaveLength(2);
    expect(ROUND_NECKLINE_SKILL_BUILDERS["round-necklines-shaped-shoulders"].exercises).toHaveLength(2);
    expect(ROUND_NECKLINE_SKILL_BUILDERS["round-necklines-shaped-shoulders"].prerequisiteNote).toMatch(
      /Complete Round Neckline Basics first/,
    );
    expect(roundNecklineSkillBuilderIsMemberOnly("round-neckline-basics")).toBe(false);
    expect(roundNecklineSkillBuilderIsMemberOnly("round-necklines-shaped-shoulders")).toBe(true);
  });

  it("keeps video slots configured but empty so no broken embeds are created", () => {
    for (const slot of Object.values(ROUND_NECKLINE_SKILL_BUILDER_VIDEOS)) {
      expect(slot).toBeNull();
    }
  });
});

describe("calculateRoundNecklineSkillBuilder", () => {
  it("returns null for invalid gauge", () => {
    expect(
      calculateRoundNecklineSkillBuilder(
        { stitchesPerFourInches: 0, rowsPerFourInches: 24 },
        "round-neckline-basics",
        "shallow-back",
      ),
    ).toBeNull();
  });

  it("derives whole, consistent counts at 16 stitches and 24 rows per 4 inches", () => {
    const sample = result("round-neckline-basics", "shallow-back");

    expect(sample.castOnStitches).toBe(32);
    expect(sample.rowsBeforeNeckline).toBe(12);
    expect(sample.neckOpeningStitches).toBe(14);
    expect(sample.centerBindOffStitches).toBe(6);
    expect(sample.firstShoulderSectionStitches).toBe(13);
    expect(sample.secondShoulderSectionStitches).toBe(13);
    expect(sample.finalShoulderStitches).toBe(9);
    expect(sample.neckDepthRows).toBe(6);
    expect(sample.neckEdgeBindOffs).toEqual([2]);
    expect(sample.neckEdgeDecreaseCount).toBe(2);
    expect(sample.outsideShoulderBindOffs).toEqual([]);
    expect(sample.shoulderStyle).toBe("straight");

    const neckBindOffs = sample.firstShoulderRows.filter(
      (row) => row.edge === "neck" && /bind off/i.test(row.action),
    );
    const decreases = sample.firstShoulderRows.filter(
      (row) => row.edge === "neck" && /decrease/i.test(row.action),
    );
    expect(neckBindOffs).toHaveLength(1);
    expect(neckBindOffs[0]?.row).toBe(0);
    expect(neckBindOffs[0]?.action).toMatch(/Bind off 2 stitches/);
    expect(decreases.map((row) => row.row)).toEqual([2, 4]);
    expect(decreases.every((row) => /Decrease 1 stitch/.test(row.action))).toBe(true);
    expect(sample.firstShoulderRows.at(-1)?.row).toBe(5);
    expect(formatSkillBuilderRowCounter(sample.firstShoulderRows.at(-1)!.row)).toBe("005");
  });

  it("uses the same RC 000 neck-edge sequence on all four exercises at 16/24", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        expect(sample.rowsBeforeNeckline).toBe(12);
        expect(sample.centerBindOffStitches).toBe(6);
        expect(sample.neckEdgeBindOffs).toEqual([2]);
        const neck = sample.firstShoulderRows.filter((row) => row.edge === "neck");
        expect(neck[0]?.row).toBe(0);
        expect(neck[0]?.action).toMatch(/Bind off 2 stitches/);
        expect(neck.filter((row) => /decrease/i.test(row.action)).map((row) => row.row)).toEqual([
          2, 4,
        ]);
        expect(sample.neckDepthRows).toBe(exerciseId === "shallow-back" ? 6 : 16);
        expect(sample.firstShoulderRows.at(-1)?.row).toBe(sample.neckDepthRows - 1);
        const instructions = sample.instructionSteps.join(" ");
        expect(instructions).toMatch(/Knit 12 rows even/);
        expect((instructions.match(/Reset the row counter to 000/g) ?? []).length).toBeGreaterThanOrEqual(
          2,
        );
        expect(instructions).toMatch(/Do not bind off the center neck stitches again/);
      }
    }

    const fine = result("round-neckline-basics", "shallow-back", FINER_GAUGE);
    expect(fine.rowsBeforeNeckline).toBe(20);
    expect(fine.neckDepthRows).toBe(12);
    const fineNeck = fine.firstShoulderRows.filter((row) => row.edge === "neck");
    expect(fineNeck[0]?.row).toBe(0);
    expect(fineNeck.filter((row) => /bind off/i.test(row.action)).map((row) => row.row)[0]).toBe(0);
    expect(fineNeck.filter((row) => /decrease/i.test(row.action)).every((row) => row.row > 0)).toBe(
      true,
    );
    expect(fine.instructionSteps.join(" ")).toMatch(/Reset the row counter to 000/);
    expect(buildRoundNecklineSkillBuilderShapingMapData(fine).rowMin).toBe(0);
  });

  it("keeps stitch math internally consistent for every exercise", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        expect(
          sample.firstShoulderSectionStitches +
            sample.centerBindOffStitches +
            sample.secondShoulderSectionStitches,
        ).toBe(sample.castOnStitches);
        expect(sample.firstShoulderSectionStitches).toBe(sample.secondShoulderSectionStitches);
        expect(
          sample.finalShoulderStitches +
            sample.neckEdgeBindOffs.reduce((sum, n) => sum + n, 0) +
            sample.neckEdgeDecreaseCount,
        ).toBe(sample.firstShoulderSectionStitches);
        expect(sample.rowsBeforeNeckline + sample.neckDepthRows).toBe(sample.totalRows);
        expect(sample.castOnStitches % 1).toBe(0);
        expect(sample.neckDepthRows % 2).toBe(0);
      }
    }
  });

  it("starts neck-edge shaping at RC 000 with the first bind-off, then single-stitch decreases", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        for (const gauge of [SAMPLE_GAUGE, FINER_GAUGE]) {
          const sample = result(builderId, exerciseId, gauge);
          const firstNeckBo = sample.firstShoulderRows.find((row) => row.edge === "neck");
          const neckBindOffs = sample.firstShoulderRows.filter(
            (row) => row.edge === "neck" && /bind off/i.test(row.action),
          );
          const decreases = sample.firstShoulderRows.filter(
            (row) => row.edge === "neck" && /decrease/i.test(row.action),
          );
          expect(firstNeckBo?.row).toBe(SHAPING_ROW_COUNTER_START);
          expect(neckBindOffs[0]?.row).toBe(SHAPING_ROW_COUNTER_START);
          expect(neckBindOffs[0]?.action).toMatch(/Bind off [2-9]/);
          expect(sample.firstShoulderRows.some((row) => /Bind off 1 stitch/i.test(row.action))).toBe(
            false,
          );
          expect(sample.shapingChart.find((row) => row.step === "Center neck")?.rows).toBe("000");
          expect(sample.shapingChart.find((row) => row.step === "Neck-edge bind-offs")?.rows).toBe(
            "000",
          );
          expect(sample.shapingChart.find((row) => row.step === "Reset row counter")?.rows).toBe(
            "000",
          );
          expect(sample.shapingChart.find((row) => row.step === "Knit even")?.rows).toBe(
            String(sample.rowsBeforeNeckline),
          );
          if (decreases.length > 0) {
            expect(decreases[0]?.row).toBe(SHAPING_ROW_COUNTER_START + 2 * sample.neckEdgeBindOffs.length);
            for (let i = 1; i < decreases.length; i += 1) {
              expect(decreases[i]!.row).toBe(decreases[0]!.row + 2 * i);
            }
          }
          const lastShaping = Math.max(
            ...sample.firstShoulderRows.filter((row) => row.edge !== "even").map((row) => row.row),
          );
          expect(SHAPING_ROW_COUNTER_START + sample.neckDepthRows - 1).toBeGreaterThanOrEqual(
            lastShaping,
          );
          expect(sample.firstShoulderRows.at(-1)?.row).toBe(
            SHAPING_ROW_COUNTER_START + sample.neckDepthRows - 1,
          );
        }
      }
    }
  });

  it("updates every displayed value family when gauge changes", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const coarse = result(builderId, exerciseId, SAMPLE_GAUGE);
        const fine = result(builderId, exerciseId, FINER_GAUGE);
        const coarseMap = buildRoundNecklineSkillBuilderShapingMapData(coarse);
        const fineMap = buildRoundNecklineSkillBuilderShapingMapData(fine);
        const coarseHtml = buildRoundNecklineSkillBuilderDiagramHtml(coarse);
        const fineHtml = buildRoundNecklineSkillBuilderDiagramHtml(fine);
        const coarseSvg = buildRoundNecklineSkillBuilderDiagramSvg(coarse);
        const fineSvg = buildRoundNecklineSkillBuilderDiagramSvg(fine);

        expect(fine.castOnStitches).not.toBe(coarse.castOnStitches);
        expect(fine.rowsBeforeNeckline).not.toBe(coarse.rowsBeforeNeckline);
        expect(fine.neckDepthRows).not.toBe(coarse.neckDepthRows);
        expect(fine.firstShoulderSectionStitches).not.toBe(coarse.firstShoulderSectionStitches);
        expect(fine.neckOpeningStitches).not.toBe(coarse.neckOpeningStitches);

        expect(fineMap.rowMin).toBe(SHAPING_ROW_COUNTER_START);
        expect(coarseMap.rowMin).toBe(SHAPING_ROW_COUNTER_START);
        expect(fineMap.rowMax).toBe(SHAPING_ROW_COUNTER_START + fine.neckDepthRows);
        expect(fineMap.centerStitches).toBe(fine.centerBindOffStitches);
        expect(fineMap.paths.find((path) => path.id === "shoulder-right")?.startX).toBe(fine.castOnStitches);
        expect(coarseMap.paths.find((path) => path.id === "shoulder-right")?.startX).toBe(
          coarse.castOnStitches,
        );

        expect(fineSvg).toContain(`>-${fine.centerBindOffStitches} center sts<`);
        expect(coarseSvg).toContain(`>-${coarse.centerBindOffStitches} center sts<`);
        expect(fineHtml).not.toContain("Center: bind off");
        expect(coarseHtml).not.toContain("Center: bind off");
        if (fine.centerBindOffStitches !== coarse.centerBindOffStitches) {
          expect(fineSvg).not.toContain(`>-${coarse.centerBindOffStitches} center sts<`);
        }

        expect(fineSvg).toContain(">000<");
        expect(fineSvg).not.toContain(`>${fine.rowsBeforeNeckline}<`);
        expect(coarseSvg).toContain(">000<");
        expect(coarseSvg).not.toContain(`>${coarse.rowsBeforeNeckline}<`);

        const fineCastOn = fine.shapingChart.find((row) => row.step === "Cast on");
        const fineKnit = fine.shapingChart.find((row) => row.step === "Knit even");
        expect(fineCastOn?.stitches).toBe(String(fine.castOnStitches));
        expect(fineKnit?.rows).toBe(String(fine.rowsBeforeNeckline));
        expect(fineKnit?.stitches).toBe(String(fine.castOnStitches));
        expect(fine.shapingChart.find((row) => row.step === "Center neck")?.stitches).toBe(
          String(fine.centerBindOffStitches),
        );
        expect(fine.shapingChart.find((row) => row.step === "Neck-edge bind-offs")?.stitches).toBe(
          String(fine.neckEdgeBindOffs.reduce((sum, n) => sum + n, 0)),
        );
        expect(fine.shapingChart.find((row) => row.step === "Neck-edge decreases")?.stitches).toBe(
          String(fine.neckEdgeDecreaseCount),
        );
        expect(fine.shapingChart.find((row) => row.step === "Neckline depth")?.rows).toBe(
          String(fine.neckDepthRows),
        );
        expect(fine.shapingChart.find((row) => row.step === "Right shoulder")?.stitches).toBe(
          String(fine.firstShoulderSectionStitches),
        );
        expect(fine.instructionSteps.join(" ")).toContain(`${fine.castOnStitches} sts`);
        expect(fine.instructionSteps.join(" ")).toContain(`${fine.rowsBeforeNeckline} rows even`);
        expect(fine.instructionSteps.join(" ")).toMatch(/Reset the row counter to 000/);
        if (fine.castOnStitches !== coarse.castOnStitches) {
          expect(fine.instructionSteps.join(" ")).not.toContain(`${coarse.castOnStitches} sts`);
        }
        expect(fine.firstShoulderRows[0]?.row).toBe(SHAPING_ROW_COUNTER_START);
        expect(coarse.firstShoulderRows[0]?.row).toBe(SHAPING_ROW_COUNTER_START);
        expect(fine.firstShoulderRows.at(-1)?.row).not.toBe(coarse.firstShoulderRows.at(-1)?.row);

        if (builderId === "round-necklines-shaped-shoulders") {
          expect(fine.outsideShoulderBindOffs.reduce((sum, n) => sum + n, 0)).toBe(
            fine.finalShoulderStitches,
          );
          expect(fineSvg).not.toContain(`>BO ${fine.outsideShoulderBindOffs[0]}<`);
          expect(fineSvg).not.toContain("shaping-map-annotation--notation");
          expect(fineSvg).toContain(`>${fine.firstShoulderSectionStitches} sts<`);
        } else {
          expect(fineSvg).toContain(`>${fine.finalShoulderStitches} sts<`);
        }
      }
    }
  });

  it("makes shallow backs visibly shallower than deep fronts", () => {
    for (const builderId of BUILDERS) {
      const shallow = result(builderId, "shallow-back");
      const deep = result(builderId, "deep-front");
      expect(shallow.neckDepthRows).toBeLessThan(deep.neckDepthRows);
    }
  });

  it("keeps straight-shoulder exercises free of outside-edge bind-offs", () => {
    for (const exerciseId of EXERCISES) {
      const sample = result("round-neckline-basics", exerciseId);
      expect(sample.outsideShoulderBindOffs).toEqual([]);
      expect(sample.instructionSteps.join(" ")).toMatch(/outside shoulder edge stays straight|Do not shape the outside shoulder edge/i);
      expect(sample.instructionSteps.join(" ")).not.toMatch(/At the outside shoulder edge, bind off/);
    }
  });

  it("uses visible stepped bind-offs at the outside edge for shaped-shoulder exercises", () => {
    for (const exerciseId of EXERCISES) {
      const sample = result("round-necklines-shaped-shoulders", exerciseId);
      expect(sample.outsideShoulderBindOffs.length).toBeGreaterThanOrEqual(2);
      expect(sample.outsideShoulderBindOffs.every((n) => n >= 2)).toBe(true);
      expect(sample.outsideShoulderBindOffs.reduce((sum, n) => sum + n, 0)).toBe(
        sample.finalShoulderStitches,
      );
      expect(sample.instructionSteps.join(" ")).toMatch(/At the outside shoulder edge, bind off/);
      expect(sample.instructionSteps.join(" ")).toMatch(/neck edge/);
    }
  });

  it("uses the same machine workflow on every exercise", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        const method = sample.separateSectionsSteps.join(" ");
        const instructions = sample.instructionSteps.join(" ");
        expect(sample.prepareHeading).toBe(SHOULDER_WORKFLOW_HEADING);
        expect(sample.teachingNote).toBe(SHOULDER_WORKFLOW_TEACHING_NOTE);
        expect(sample.pauseAndCheck).toBe(PAUSE_AND_CHECK_TEXT);
        expect(sample.saveThisPracticePiece).toBe(SAVE_THIS_PRACTICE_PIECE_NOTE);
        expect(sample.teachingNote).not.toMatch(/held only briefly/);
        expect(method).toMatch(/Break the working yarn/);
        expect(method).toMatch(/Scrap off the right shoulder stitches and remove that shoulder section from the machine/);
        expect(method).toMatch(/Join working yarn at the center neck edge/);
        expect(method).toMatch(/Bind off the center neck stitches loosely on the machine/);
        expect(method).toMatch(/The left shoulder stays on the machine/);
        expect(method).not.toMatch(/Scrap off the center neck stitches/);
        expect(method).not.toMatch(/Rehang the center neck stitches/);
        expect(method).not.toMatch(/Scrap off the left shoulder stitches/);
        expect(instructions).toMatch(/Knit \d+ rows even/);
        expect(instructions).toMatch(/Reset the row counter to 000/);
        expect(instructions).toMatch(/Do not bind off the center neck stitches again/);
        expect((instructions.match(/Reset the row counter to 000/g) ?? []).length).toBeGreaterThanOrEqual(
          2,
        );
        expect(instructions).toMatch(/carriage and working yarn are on the right/);
        expect(instructions).toMatch(/Follow the Shape the Shoulders on the Machine steps above/);
        expect(instructions).toMatch(/shape the left shoulder directly on the machine/);
        expect(instructions).toMatch(/right-hand neck edge of the left shoulder/);
        expect(instructions).toMatch(/Do not scrap off or rehang the left shoulder before it is shaped/);
        expect(instructions).toMatch(/Scrap off the completed left shoulder stitches onto waste yarn/);
        expect(instructions).toMatch(/Rehang the right shoulder stitches/);
        expect(instructions).toMatch(/Attach working yarn at the neck edge/);
        expect(instructions).toMatch(/Scrap off the completed right shoulder stitches onto waste yarn/);
        expect(instructions).toMatch(/Do not bind off remaining live stitches/);
        expect(instructions).not.toMatch(/Rehang the left shoulder stitches/);
        expect(instructions).not.toMatch(/Scrap off the center neck stitches/);
        expect(instructions).not.toMatch(/Rehang the center neck stitches/);
        expect(instructions).not.toMatch(/Bind off the remaining shoulder stitches/);
        expect(instructions).not.toMatch(/short-?row/i);
        expect(instructions).not.toMatch(/held only briefly/);
        expect(sample.instructionPhases.map((phase) => phase.id)).toEqual([
          "knit",
          "first-shoulder",
          "mirror-shoulder",
        ]);
        expect(sample.instructionPhases.map((phase) => phase.title)).toEqual([
          "1. Knit the Practice Piece",
          "2. Shape the Left Shoulder",
          "3. Shape the Right Shoulder",
        ]);
      }
    }
  });

  it("scraps off the right shoulder, binds off the center, then shapes the left before rehanging the right", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        const method = sample.separateSectionsSteps;
        const scrapRightIdx = method.findIndex((step) =>
          step.includes("Scrap off the right shoulder stitches"),
        );
        const centerIdx = method.findIndex((step) =>
          step.includes("Bind off the center neck stitches loosely on the machine"),
        );
        const leftStaysIdx = method.findIndex((step) =>
          step.includes("The left shoulder stays on the machine"),
        );
        const shapeLeftIdx = sample.instructionSteps.findIndex((step) =>
          step.includes("shape the left shoulder directly on the machine"),
        );
        const scrapLeftIdx = sample.instructionSteps.findIndex((step) =>
          step.includes("Scrap off the completed left shoulder stitches onto waste yarn"),
        );
        const rehangRightIdx = sample.instructionSteps.findIndex((step) =>
          step.includes("Rehang the right shoulder stitches"),
        );
        const scrapRightCompletedIdx = sample.instructionSteps.findIndex((step) =>
          step.includes("Scrap off the completed right shoulder stitches onto waste yarn"),
        );
        expect(scrapRightIdx).toBeGreaterThan(-1);
        expect(centerIdx).toBeGreaterThan(scrapRightIdx);
        expect(leftStaysIdx).toBeGreaterThan(centerIdx);
        expect(shapeLeftIdx).toBeGreaterThan(-1);
        expect(scrapLeftIdx).toBeGreaterThan(shapeLeftIdx);
        expect(rehangRightIdx).toBeGreaterThan(scrapLeftIdx);
        expect(scrapRightCompletedIdx).toBeGreaterThan(rehangRightIdx);
      }
    }
  });

  it("matches the unified method in the summary, legend, and common mistakes", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        const summary = sample.shapingChart.map((row) => `${row.step} ${row.detail}`).join(" ");
        const legend = sample.diagramLegend.map((item) => `${item.label} ${item.detail}`).join(" ");
        const mistakes = sample.commonMistakes.join(" ");
        expect(summary).toMatch(/Scrap off unshaped, then rehang later/);
        expect(summary).toMatch(/Bind off loosely on the machine at RC 000, once, before the first shoulder/);
        expect(summary).toMatch(/Keep on the machine\. Shape immediately after the center bind-off/);
        expect(summary).toMatch(/scrap off the remaining|scrap off completed stitches onto waste yarn/i);
        expect(summary).not.toMatch(/Bind off the remaining/);
        expect(legend).toContain("scrap off first, then rehang to shape");
        expect(legend).toContain("stays on the machine and is shaped after the center bind-off");
        expect(legend).toContain("never scrap off or rehang");
        expect(mistakes).toMatch(/scrapped off the left shoulder before I shaped it/i);
        expect(mistakes).toMatch(/scrapped off or rehung the center neck stitches/i);
        expect(mistakes).toMatch(/Only the right shoulder is scrapped off first and rehung later/);
        expect(mistakes).toMatch(/bound off the remaining shoulder stitches instead of scrapping them off/i);
        expect(mistakes).not.toMatch(/held only briefly/);
        expect(mistakes).not.toMatch(/I rehung the right shoulder\./);
      }
    }
  });

  it("shapes both edges of shaped shoulders during the same rows on left and right", () => {
    const back = result("round-necklines-shaped-shoulders", "shallow-back");
    const front = result("round-necklines-shaped-shoulders", "deep-front");
    for (const sample of [back, front]) {
      const text = `${sample.instructionSteps.join(" ")} ${sample.firstShoulderDetailSteps.join(" ")}`;
      expect(text).toMatch(
        new RegExp(
          `During the next ${sample.neckDepthRows} rows, shape both edges of this shoulder section`,
        ),
      );
      expect(text).toMatch(/At the neck edge, bind off/);
      expect(text).toMatch(/At the outside shoulder edge, bind off/);
      expect(text).toMatch(/Left-shoulder row sequence \(both edges\)/);
      expect(text).toMatch(/shape both edges as a mirror image of the left shoulder/);
      expect(text).toMatch(/same physical edge/);
      expect(text).not.toMatch(/finish the neckline, then shape/i);
      const summary = sample.shapingChart.map((row) => `${row.step} ${row.detail}`).join(" ");
      expect(summary).toMatch(/Shape both edges during these rows/);
      expect(summary).toMatch(/Worked during the same rows as the neckline depth, not after it/);
      const neckRows = sample.firstShoulderRows.filter((row) => row.edge === "neck").map((row) => row.row);
      const outsideRows = sample.firstShoulderRows.filter((row) => row.edge === "outside").map((row) => row.row);
      const endRow = SHAPING_ROW_COUNTER_START + sample.neckDepthRows - 1;
      expect(neckRows[0]).toBe(SHAPING_ROW_COUNTER_START);
      expect(outsideRows[0]).toBeGreaterThan(SHAPING_ROW_COUNTER_START);
      expect(outsideRows[0]).toBeLessThanOrEqual(endRow);
      expect(Math.max(...outsideRows)).toBeLessThanOrEqual(endRow);
      expect(sample.firstShoulderRows.some((row) => row.row === SHAPING_ROW_COUNTER_START && row.edge === "neck")).toBe(
        true,
      );
    }
  });

  it("leaves enough stitches after neck-edge shaping", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId, FINER_GAUGE);
        expect(sample.finalShoulderStitches).toBeGreaterThanOrEqual(6);
        const lastRow = sample.firstShoulderRows.at(-1);
        if (builderId === "round-necklines-shaped-shoulders") {
          expect(lastRow?.stitchesAfter).toBe(0);
        } else {
          expect(lastRow?.stitchesAfter).toBe(sample.finalShoulderStitches);
        }
      }
    }
  });
});

describe("round neckline Skill Builder diagrams", () => {
  function parseRowNumbers(svg: string): number[] {
    return [...svg.matchAll(/class="shaping-map-row-number"[^>]*>(\d+)</g)].map((m) =>
      Number(m[1]),
    );
  }

  it("draws a to-scale shaping map from the generated counts, not a silhouette", () => {
    for (const builderId of BUILDERS) {
      for (const exerciseId of EXERCISES) {
        const sample = result(builderId, exerciseId);
        const data = buildRoundNecklineSkillBuilderShapingMapData(sample);
        const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
        const html = buildRoundNecklineSkillBuilderDiagramHtml(sample);
        const startRow = SHAPING_ROW_COUNTER_START;
        const endRow = startRow + sample.neckDepthRows;

        expect(data.rowMin).toBe(startRow);
        expect(data.rowMax).toBe(endRow);
        expect(data.centerStitches).toBe(sample.centerBindOffStitches);
        expect(svg).toContain('class="shaping-map__svg shaping-map__svg--practice"');
        expect(svg).toContain('class="shaping-map-path"');
        expect(svg).toContain('class="shaping-map-grid-minor"');
        expect(svg).not.toContain(`>${formatCenterStitchesLabel(sample.centerBindOffStitches)}<`);
        expect(svg).not.toContain(">Neck Edge<");
        expect(svg).not.toContain(">Outside Edge<");
        expect(data.layout).toBe("symmetrical");
        expect(data.paths.some((path) => path.id === "shoulder-right")).toBe(true);

        const rows = parseRowNumbers(svg);
        expect(rows).toContain(0);
        expect(rows).toContain(sample.neckDepthRows);
        expect(svg).toContain(">000<");
        expect(svg).toContain(`>${String(sample.neckDepthRows).padStart(3, "0")}<`);
        expect(Math.min(...rows)).toBe(0);
        expect(Math.max(...rows)).toBe(sample.neckDepthRows);
        expect(data.rowMin).not.toBe(sample.rowsBeforeNeckline);

        for (const amount of sample.neckEdgeBindOffs) {
          expect(svg).toContain(`>-${amount}<`);
        }
        if (sample.neckEdgeDecreaseCount > 0) {
          expect(svg).toContain(">-1<");
        }
        expect(svg).not.toContain(">BO ");
        expect(svg).not.toContain(">Dec ");

        expect(html).not.toContain("BO = bind off");
        expect(html).not.toContain("Dec = decrease");
        expect(html).not.toContain(`Center: bind off ${sample.centerBindOffStitches} stitches`);
        expect(html).not.toContain("shaping-map__key");
        expect(html).not.toContain("mirror-image orientation");
        const legend = sample.diagramLegend.map((item) => `${item.label} ${item.detail}`).join(" ");
        expect(legend).toContain(`Bind off center ${sample.centerBindOffStitches} sts`);
        expect(legend).not.toContain("mirror-image orientation");
        expect(legend).toContain("bind off loosely on the machine");
        expect(legend).toContain("scrap off first, then rehang to shape");
        expect(legend).toContain("stays on the machine and is shaped after the center bind-off");
        expect(legend).not.toContain("shape on the machine, then scrap off onto waste yarn");
        expect(svg).not.toMatch(/scrap off the center/i);
        for (const line of sample.necklineJpLines) {
          expect(legend).not.toContain(line);
        }
        expect(svg).not.toContain(">2-2-1<");
        expect(svg).not.toContain("shaping-map-annotation--notation");
        expect(svg).toContain(`>${sample.firstShoulderSectionStitches} sts<`);
      }
    }
  });

  it("shows a straight shoulder edge without outside bind-off steps", () => {
    for (const exerciseId of EXERCISES) {
      const sample = result("round-neckline-basics", exerciseId);
      const data = buildRoundNecklineSkillBuilderShapingMapData(sample);
      const svg = buildRoundNecklineSkillBuilderDiagramSvg(sample);
      const shoulder = data.paths.find((path) => path.id === "shoulder");
      expect(sample.outsideShoulderBindOffs).toEqual([]);
      expect(shoulder?.steps.some((step) => (step.label ?? "").startsWith("BO "))).toBe(false);
      expect(svg).toContain(`>${sample.finalShoulderStitches} sts<`);
    }
  });

  it("keeps Japanese notation off the chart and diagram legend", () => {
    const straight = result("round-neckline-basics", "deep-front");
    const shaped = result("round-necklines-shaped-shoulders", "deep-front");
    expect(straight.shoulderJpLines).toEqual([]);
    expect(shaped.shoulderJpLines.length).toBeGreaterThan(0);
    const shapedLegend = shaped.diagramLegend.map((item) => item.detail).join(" ");
    const straightLegend = straight.diagramLegend.map((item) => item.detail).join(" ");
    for (const line of shaped.shoulderJpLines) {
      expect(shapedLegend).not.toContain(line);
      expect(straightLegend).not.toContain(line);
    }
    const shapedSvg = buildRoundNecklineSkillBuilderDiagramSvg(shaped);
    const straightSvg = buildRoundNecklineSkillBuilderDiagramSvg(straight);
    for (const amount of shaped.outsideShoulderBindOffs) {
      expect(shapedSvg).not.toContain(`>BO ${amount}<`);
    }
    expect(shapedSvg).not.toContain("shaping-map-annotation--notation");
    expect(shapedSvg).not.toContain(">3-2-3<");
    expect(shapedSvg).toContain(`>${shaped.firstShoulderSectionStitches} sts<`);
    expect(straightSvg).toContain(`>${straight.finalShoulderStitches} sts<`);
    expect(straightSvg).toContain(`>${straight.firstShoulderSectionStitches} sts<`);
  });

  it("marks the same vertical row range for back shaped neckline depth and shoulder slope", () => {
    const backShaped = result("round-necklines-shaped-shoulders", "shallow-back");
    const frontShaped = result("round-necklines-shaped-shoulders", "deep-front");
    const backStraight = result("round-neckline-basics", "shallow-back");
    const backData = buildRoundNecklineSkillBuilderShapingMapData(backShaped);
    const frontData = buildRoundNecklineSkillBuilderShapingMapData(frontShaped);
    const straightData = buildRoundNecklineSkillBuilderShapingMapData(backStraight);

    expect(backData.paths.some((path) => path.id === "shoulder")).toBe(true);
    expect(backData.paths.some((path) => path.id === "neck")).toBe(true);
    expect(backData.rowMax - backData.rowMin).toBe(backShaped.neckDepthRows);
    expect(frontData.paths.some((path) => path.id === "shoulder")).toBe(true);
    expect(frontData.paths.some((path) => path.id === "neck")).toBe(true);
    expect(straightData.paths.find((path) => path.id === "shoulder")?.steps.some((step) =>
      (step.label ?? "").startsWith("BO "),
    )).toBe(false);

    const legend = backShaped.diagramLegend.map((item) => `${item.label} ${item.detail}`).join(" ");
    expect(legend).toContain("Neckline depth & shoulder slope");
    expect(legend).toContain(`same ${backShaped.neckDepthRows} rows (1 inch)`);
    const frontLegend = frontShaped.diagramLegend.map((item) => `${item.label} ${item.detail}`).join(" ");
    expect(frontLegend).toContain("Neckline depth & shoulder slope");
    expect(frontLegend).toContain(`both edges are shaped during these ${frontShaped.neckDepthRows} neckline rows`);
    expect(frontLegend).not.toContain("1 inch");
  });
});
