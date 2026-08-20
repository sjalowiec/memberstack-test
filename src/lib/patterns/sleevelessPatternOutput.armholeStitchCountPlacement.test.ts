import { describe, expect, it } from "vitest";
import {
  buildSleevelessBackDisplayRows,
  buildSleevelessFrontDisplayRows,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";

type Block = Extract<SleevelessPatternDisplayRow, { kind: "block" }>;

function armholeBlocks(rows: readonly SleevelessPatternDisplayRow[]): Block[] {
  let inArmhole = false;
  const out: Block[] = [];
  for (const row of rows) {
    if (row.kind === "section") {
      if (row.title === "ARMHOLE") {
        inArmhole = true;
        continue;
      }
      if (inArmhole) break;
    }
    if (inArmhole && row.kind === "block") out.push(row);
  }
  return out;
}

function blockText(block: Block): string {
  return [...(block.paragraphs ?? []), ...(block.trustedParagraphs ?? [])].join("\n");
}

function printRowContaining(html: string, needle: string): string {
  const idx = html.indexOf(needle);
  expect(idx).toBeGreaterThanOrEqual(0);
  const rowStart = html.lastIndexOf('<div class="print-inst-row', idx);
  expect(rowStart).toBeGreaterThanOrEqual(0);
  const nextRow = html.indexOf('<div class="print-inst-row', rowStart + 1);
  return html.slice(rowStart, nextRow < 0 ? undefined : nextRow);
}

const ARMHOLE_START_STS = 78;
const FIRST_BIND_OFF = 8;
const AFTER_FIRST_BO = 70;
const AFTER_SECOND_BO = 62;
const DECREASE_STS = 3;
const AFTER_DECREASES = 56;
const FIRST_ARMHOLE_RC = 69;

function build78StsArmholeRows() {
  return buildSleevelessBackDisplayRows({
    castOnSts: ARMHOLE_START_STS,
    armholeStartSts: ARMHOLE_START_STS,
    hemRows: 14,
    hemRowsValid: true,
    bodyToArmholeRows: FIRST_ARMHOLE_RC - 14,
    bodyRowsValid: true,
    armholeMath: {
      bindOffSts: FIRST_BIND_OFF,
      decreaseSts: DECREASE_STS,
      decreaseRows: DECREASE_STS * 2,
      evenRows: 8,
    },
    firstArmholeRC: FIRST_ARMHOLE_RC,
    stitchesAfterArmhole: AFTER_DECREASES,
    upperBackRows: 4,
    upperStartRc: FIRST_ARMHOLE_RC + 2 + DECREASE_STS * 2 + 8,
    evenRowPadRows: 0,
    padStartRc: 0,
    backNecklineStartRC: FIRST_ARMHOLE_RC + 2 + DECREASE_STS * 2 + 8 + 4,
    neckChartRows: [],
    useNeckChartRows: false,
  });
}

function expectArmholeBindOffStitchPlacement(rows: readonly SleevelessPatternDisplayRow[]) {
  const blocks = armholeBlocks(rows);
  const reset = blocks.find((b) => b.rowCounterReset === true);
  const firstBo = blocks.find((b) =>
    /Bind off OR hold 8 stitches at the armhole edge \(carriage side\)/.test(blockText(b)),
  );
  const secondBo = blocks.find((b) =>
    /Bind off OR hold 8 stitches at the remaining armhole edge/.test(blockText(b)),
  );
  const decreases = blocks.find((b) => /Decrease 1 stitch at each armhole edge/.test(blockText(b)));

  expect(reset).toBeDefined();
  expect(firstBo).toBeDefined();
  expect(secondBo).toBeDefined();
  expect(decreases).toBeDefined();

  expect(reset!.stitchCount).toBeUndefined();
  expect(firstBo!.stitchCount).toBe(AFTER_FIRST_BO);
  expect(secondBo!.stitchCount).toBe(AFTER_SECOND_BO);
  expect(decreases!.stitchCount).toBe(AFTER_DECREASES);

  expect(blocks.indexOf(reset!)).toBeLessThan(blocks.indexOf(firstBo!));
  expect(blocks.indexOf(firstBo!)).toBeLessThan(blocks.indexOf(secondBo!));
  expect(blocks.indexOf(secondBo!)).toBeLessThan(blocks.indexOf(decreases!));
}

describe("sleeveless armhole stitch-count placement", () => {
  it("places 70 / 62 after the bind-offs, not on the reset (Back Armhole)", () => {
    const rows = build78StsArmholeRows();
    expectArmholeBindOffStitchPlacement(rows);

    const html = renderSleevelessPrintPieceHtml(rows, "", "back");
    const resetRow = printRowContaining(html, "RESET ROW COUNTER TO 000");
    expect(resetRow).not.toContain("70 sts");
    expect(resetRow).not.toContain('class="print-inst-sts"');

    const firstBoRow = printRowContaining(
      html,
      "Bind off OR hold 8 stitches at the armhole edge (carriage side)",
    );
    expect(firstBoRow).toContain('<div class="print-inst-sts">70 sts</div>');

    const secondBoRow = printRowContaining(
      html,
      "Bind off OR hold 8 stitches at the remaining armhole edge",
    );
    expect(secondBoRow).toContain('<div class="print-inst-sts">62 sts</div>');
  });

  it("places 70 / 62 after the bind-offs, not on the reset (Front Armhole)", () => {
    const backRows = build78StsArmholeRows();
    const frontRows = buildSleevelessFrontDisplayRows({
      frontNecklineStartRC: FIRST_ARMHOLE_RC + 20,
      frontNecklineStartLocalRC: 20,
      sharedExecutionRows: backRows,
      useNeckChartRows: false,
      neckChartRows: [],
    });
    expectArmholeBindOffStitchPlacement(frontRows);

    const html = renderSleevelessPrintPieceHtml(frontRows, "", "front");
    const resetRow = printRowContaining(html, "RESET ROW COUNTER TO 000");
    expect(resetRow).not.toContain("70 sts");
    expect(resetRow).not.toContain('class="print-inst-sts"');

    const firstBoRow = printRowContaining(
      html,
      "Bind off OR hold 8 stitches at the armhole edge (carriage side)",
    );
    expect(firstBoRow).toContain('<div class="print-inst-sts">70 sts</div>');

    const secondBoRow = printRowContaining(
      html,
      "Bind off OR hold 8 stitches at the remaining armhole edge",
    );
    expect(secondBoRow).toContain('<div class="print-inst-sts">62 sts</div>');
  });

  it("keeps generated Front and Back armhole stitch counts on the bind-off rows", () => {
    const r = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "round" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    });

    const startSts = r.debug.bustBodyStitches ?? r.debug.backStitches;
    const eachSide = r.debug.armholeStitchesEachSide;
    expect(startSts).toBeGreaterThan(0);
    expect(eachSide).toBeGreaterThan(0);
    const bindOffSts = Math.round(eachSide! / 2);
    const afterFirst = startSts - bindOffSts;
    const afterSecond = startSts - 2 * bindOffSts;
    const afterShaping = r.debug.stitchesAfterArmhole;

    for (const rows of [r.displayRows, r.frontDisplayRows]) {
      const blocks = armholeBlocks(rows);
      const reset = blocks.find((b) => b.rowCounterReset === true);
      const firstBo = blocks.find((b) =>
        new RegExp(
          `Bind off OR hold ${bindOffSts} stitches at the armhole edge \\(carriage side\\)`,
        ).test(blockText(b)),
      );
      const secondBo = blocks.find((b) =>
        new RegExp(
          `Bind off OR hold ${bindOffSts} stitches at the remaining armhole edge`,
        ).test(blockText(b)),
      );
      const decreases = blocks.find((b) =>
        /Decrease 1 stitch at each armhole edge/.test(blockText(b)),
      );

      expect(reset).toBeDefined();
      expect(reset!.stitchCount).toBeUndefined();
      expect(firstBo?.stitchCount).toBe(afterFirst);
      expect(secondBo?.stitchCount).toBe(afterSecond);
      if (decreases) {
        expect(decreases.stitchCount).toBe(afterShaping);
      }
    }
  });
});
