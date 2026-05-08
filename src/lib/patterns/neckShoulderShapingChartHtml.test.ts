import { describe, expect, it } from "vitest";
import {
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";

function plainRow(
  rc: number,
  sts: { left: number; right: number } = { left: 47, right: 47 },
): NeckShoulderShapingChartRow {
  return {
    row: rc,
    action: "",
    leftSide: "-",
    leftNeck: "-",
    centerNeck: "-",
    rightNeck: "-",
    rightSide: "-",
    leftStitchCount: sts.left,
    rightStitchCount: sts.right,
  };
}

describe("renderNeckShoulderShapingPrintInstructionTableHtml knit-even compression", () => {
  it("merges 2+ consecutive no-action rows with same sts and sequential RC into one row", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let rc = 279; rc <= 308; rc += 1) rows.push(plainRow(rc));
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(neckShoulderShapingChartFromRows(rows));
    expect(html).toContain("279-308");
    expect(html).toContain("Knit even");
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(1);
  });

  it("does not merge a single no-action row", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([plainRow(100)]),
    );
    expect(html).toContain(">100<");
    expect(html).not.toContain("Knit even");
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(1);
  });

  it("breaks the run when stitch counts change", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([
        plainRow(10, { left: 47, right: 47 }),
        plainRow(11, { left: 46, right: 46 }),
        plainRow(12, { left: 46, right: 46 }),
      ]),
    );
    expect(html).toContain(">10<");
    expect(html).toContain("11-12");
    expect(html).not.toContain("10-12");
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(2);
  });

  it("breaks the run on non-sequential RC (does not span a gap)", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([plainRow(10), plainRow(12), plainRow(13)]),
    );
    expect(html).toContain(">10<");
    expect(html).toContain("12-13");
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(2);
  });

  it("does not merge rows with Neck or Shoulder action labels", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([
        plainRow(20),
        { ...plainRow(21), action: "Neck", leftNeck: "-1", rightNeck: "-1", leftStitchCount: 46, rightStitchCount: 46 },
        plainRow(22),
      ]),
    );
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(3);
  });

  it("does not merge center bind-off row", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([
        plainRow(30),
        {
          ...plainRow(31),
          centerNeck: "-12",
          leftStitchCount: 41,
          rightStitchCount: 41,
        },
        plainRow(32),
      ]),
    );
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(3);
    expect(html).toContain("Center BO");
  });

  it("does not merge when left or right shaping text is present", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([
        plainRow(40),
        { ...plainRow(41), leftNeck: "-1", rightNeck: "-1", leftStitchCount: 46, rightStitchCount: 46 },
      ]),
    );
    const trCount = (html.match(/<tr class="ns-shaping-mini__row/g) ?? []).length;
    expect(trCount).toBe(2);
  });
});

describe("renderNeckShoulderShapingChartTableOnlyHtml active-side mode", () => {
  it("renders RC, active action, and active stitch columns only", () => {
    const rows: NeckShoulderShapingChartRow[] = [
      {
        row: 283,
        action: "Neck",
        leftSide: "-",
        leftNeck: "-3",
        centerNeck: "-",
        rightNeck: "-3",
        rightSide: "-",
        leftStitchCount: 52,
        rightStitchCount: 52,
      },
      {
        row: 284,
        action: "Shoulder",
        leftSide: "-8",
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: "-8",
        leftStitchCount: 44,
        rightStitchCount: 44,
      },
    ];
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      neckShoulderShapingChartFromRows(rows),
      "ns-back",
      undefined,
      { activeSideOnly: true }
    );

    expect(html).toContain("RC");
    expect(html).toContain("Action (Active Side)");
    expect(html).toContain("Sts (Active Side)");
    expect(html).toContain("Neck: -3");
    expect(html).toContain("Shoulder: -8");
    expect(html).toContain(">52<");
    expect(html).toContain(">44<");

    expect(html).not.toContain("Left</th>");
    expect(html).not.toContain("Right</th>");
    expect(html).not.toContain("Neck center");
    expect(html).toContain(
      "Work one side only. When this side is complete, rehang the remaining stitches and repeat for the other side, reversing the shaping."
    );
  });
});
