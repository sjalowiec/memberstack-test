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

describe("renderNeckShoulderShapingPrintInstructionTableHtml active-side mode", () => {
  it("renders the printable chart as one side with reset RC and edge landmarks", () => {
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(
      neckShoulderShapingChartFromRows([
        {
          ...plainRow(30, { left: 55, right: 55 }),
          centerNeck: "-12",
        },
        {
          ...plainRow(31, { left: 52, right: 52 }),
          action: "Neck",
          leftNeck: "-3",
          rightNeck: "-3",
        },
        {
          ...plainRow(31, { left: 44, right: 44 }),
          action: "Shoulder",
          leftSide: "-8",
          rightSide: "-8",
        },
      ]),
    );

    expect(html).toContain("Carriage Position");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain(">000<");
    expect(html).toContain(">001<");
    expect(html).toContain(">Right<");
    expect(html).toContain(">Left<");
    expect(html).toContain("Decrease 3 sts");
    expect(html).toContain("Bind off 8 sts");
    expect(html).toContain(">Neck<");
    expect(html).toContain(">Armhole<");
    expect(html).not.toContain("Reset the row counter to RC:000");
    expect(html).toContain(
      "Once this side is complete, cut yarn and rehang the remaining 55 stitches. Repeat the table and shaping diagram logic for the second side, reversing the edge landmarks."
    );
    expect(html).not.toContain("Second Shoulder Checklist");
    expect(html).not.toContain("<th scope=\"col\">Left</th>");
    expect(html).not.toContain("<th scope=\"col\">Right</th>");
  });
});

describe("renderNeckShoulderShapingChartTableOnlyHtml active-side mode", () => {
  it("renders reset RC, carriage position, action, edge, and active stitch columns only", () => {
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
    expect(html).toContain("Carriage Position");
    expect(html).toContain("Action");
    expect(html).toContain("Edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain(">000<");
    expect(html).toContain(">001<");
    expect(html).toContain(">Right<");
    expect(html).toContain(">Left<");
    expect(html).toContain("Decrease 3 sts");
    expect(html).toContain("Bind off 8 sts");
    expect(html).toContain(">Neck<");
    expect(html).toContain(">Armhole<");
    expect(html).toContain(">52<");
    expect(html).toContain(">44<");

    expect(html).not.toContain("Left</th>");
    expect(html).not.toContain("Right</th>");
    expect(html).not.toContain("Neck center");
    expect(html).toContain("Show second shoulder checklist");
    expect(html).toContain("Second Shoulder Checklist");
    expect(html).toContain(
      "Once this side is complete, cut yarn and rehang the remaining 52 stitches. Repeat the table and shaping diagram logic for the second side, reversing the edge landmarks."
    );
    expect(html).toContain(
      "Once this side is complete, cut yarn and rehang the remaining 52 stitches. Follow the second shoulder checklist below."
    );
    expect(html).toContain("data-second-shoulder-content");
    expect(html).toContain("data-second-shoulder-toggle");
    expect(html).toContain("data-second-shoulder-default-instruction");
    expect(html).toContain("data-second-shoulder-checked-instruction");
  });
});

describe("renderNeckShoulderShapingChartTableOnlyHtml — final bind-off paragraph placement", () => {
  /**
   * Helper: build an active-side chart with a configurable final remaining stitch count.
   * Lays out a center bind-off row + N "Shoulder" rows that walk down to `finalRemaining`,
   * so the final rendered checklist row's `Sts Remaining` cell equals `finalRemaining`.
   * Caps the per-row bind-off chunk so the active-side checklist actually has multiple
   * decremented rows when totalDecrease is large.
   */
  function buildActiveSideChartWithFinalRemaining(args: {
    initial: number;
    finalRemaining: number;
  }): ReturnType<typeof neckShoulderShapingChartFromRows> {
    const initial = Math.max(0, Math.floor(args.initial));
    const remaining = Math.max(0, Math.min(initial, Math.floor(args.finalRemaining)));
    const totalDecrease = initial - remaining;
    const chunk = Math.max(1, Math.ceil(totalDecrease / 4));
    const chartRows: NeckShoulderShapingChartRow[] = [];
    chartRows.push({
      row: 30,
      action: "",
      leftSide: "-",
      leftNeck: "-",
      centerNeck: `-${initial}`,
      rightNeck: "-",
      rightSide: "-",
      leftStitchCount: initial,
      rightStitchCount: initial,
    });
    let running = initial;
    let rc = 31;
    while (running > remaining) {
      const take = Math.min(chunk, running - remaining);
      running -= take;
      chartRows.push({
        row: rc,
        action: "Shoulder",
        leftSide: `-${take}`,
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: `-${take}`,
        leftStitchCount: running,
        rightStitchCount: running,
      });
      rc += 1;
    }
    return neckShoulderShapingChartFromRows(chartRows);
  }

  it("renders 'Bind off remaining N stitches.' between </table></div> and the second-shoulder toggle", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 24, finalRemaining: 4 });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-back", undefined, {
      activeSideOnly: true,
    });

    expect(html).toContain("Bind off remaining 4 stitches.");
    const bindoffIdx = html.indexOf("Bind off remaining 4 stitches.");
    // Active-side render contains TWO tables (visible active-side + hidden second-shoulder
    // checklist). The bind-off paragraph must follow the FIRST table's </tbody>, not the last.
    const firstTableEndIdx = html.indexOf("</tbody>");
    const toggleIdx = html.indexOf("ns-shaping-chart__second-shoulder-toggle");
    const togglePromptIdx = html.indexOf(
      "Want less mental reversing? Show a second checklist for the opposite shoulder.",
    );
    expect(firstTableEndIdx).toBeGreaterThan(0);
    expect(toggleIdx).toBeGreaterThan(0);
    expect(togglePromptIdx).toBeGreaterThan(0);
    // Visual order: first table → bind-off → toggle prompt/copy.
    expect(bindoffIdx).toBeGreaterThan(firstTableEndIdx);
    expect(bindoffIdx).toBeLessThan(toggleIdx);
    expect(bindoffIdx).toBeLessThan(togglePromptIdx);
  });

  it("uses singular wording when exactly one stitch remains", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 12, finalRemaining: 1 });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-back", undefined, {
      activeSideOnly: true,
    });
    expect(html).toContain("Bind off remaining 1 stitch.");
    expect(html).not.toContain("Bind off remaining 1 stitches.");
  });

  it("omits the bind-off line when the final rendered checklist row has 0 stitches remaining", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 16, finalRemaining: 0 });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-back", undefined, {
      activeSideOnly: true,
    });
    expect(html).not.toMatch(/Bind off remaining\s+\d+\s+stitch/i);
    expect(html).not.toContain("data-active-side-bindoff");
  });

  /**
   * Regression guard for issue #4 follow-up: previously the second-shoulder toggle copy was the
   * very next visible element after the active-side table. This test fails if the toggle prompt
   * sits directly adjacent to the closing </table></div> with no bind-off paragraph in between.
   */
  it("regression: second-shoulder prompt never appears immediately after the table without the bind-off line between", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 24, finalRemaining: 4 });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-back", undefined, {
      activeSideOnly: true,
    });
    // Use the FIRST table close (the visible active-side table). The hidden second-shoulder
    // checklist appears further down and renders its own table after the bind-off / toggle.
    const firstTableCloseIdx = html.indexOf("</table>");
    const firstTableWrapCloseIdx = html.indexOf("</div>", firstTableCloseIdx);
    const togglePromptIdx = html.indexOf(
      "Want less mental reversing? Show a second checklist for the opposite shoulder.",
    );
    const bindoffIdx = html.indexOf("Bind off remaining");
    expect(firstTableWrapCloseIdx).toBeGreaterThan(0);
    expect(togglePromptIdx).toBeGreaterThan(firstTableWrapCloseIdx);
    expect(bindoffIdx).toBeGreaterThan(firstTableWrapCloseIdx);
    expect(bindoffIdx).toBeLessThan(togglePromptIdx);
    /**
     * The slice of HTML between the closing </div> of the active table-wrap and the toggle
     * prompt must contain the bind-off sentence. If the bind-off line ever moves below the
     * prompt (or is dropped), this slice would no longer contain the sentence and the test
     * fails — guarding the visible "table → bind-off → toggle" order.
     */
    const between = html.slice(firstTableWrapCloseIdx, togglePromptIdx);
    expect(between).toMatch(/Bind off remaining \d+ stitch(?:es)?\./);
  });
});

describe("renderNeckShoulderShapingPrintInstructionTableHtml — final bind-off paragraph placement", () => {
  function buildActiveSideChartWithFinalRemaining(args: {
    initial: number;
    finalRemaining: number;
  }): ReturnType<typeof neckShoulderShapingChartFromRows> {
    const initial = Math.max(0, Math.floor(args.initial));
    const remaining = Math.max(0, Math.min(initial, Math.floor(args.finalRemaining)));
    const totalDecrease = initial - remaining;
    const chunk = Math.max(1, Math.ceil(totalDecrease / 4));
    const chartRows: NeckShoulderShapingChartRow[] = [];
    chartRows.push({
      row: 30,
      action: "",
      leftSide: "-",
      leftNeck: "-",
      centerNeck: `-${initial}`,
      rightNeck: "-",
      rightSide: "-",
      leftStitchCount: initial,
      rightStitchCount: initial,
    });
    let running = initial;
    let rc = 31;
    while (running > remaining) {
      const take = Math.min(chunk, running - remaining);
      running -= take;
      chartRows.push({
        row: rc,
        action: "Shoulder",
        leftSide: `-${take}`,
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: `-${take}`,
        leftStitchCount: running,
        rightStitchCount: running,
      });
      rc += 1;
    }
    return neckShoulderShapingChartFromRows(chartRows);
  }

  it("renders 'Bind off remaining N stitches.' between </table></div> and the reset-rc note", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 24, finalRemaining: 4 });
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(chart);
    expect(html).toContain("Bind off remaining 4 stitches.");
    const bindoffIdx = html.indexOf("Bind off remaining 4 stitches.");
    const tableEndIdx = html.lastIndexOf("</tbody>");
    const resetIdx = html.indexOf("Sts Remaining is for this side only.");
    expect(tableEndIdx).toBeGreaterThan(0);
    expect(resetIdx).toBeGreaterThan(0);
    expect(bindoffIdx).toBeGreaterThan(tableEndIdx);
    expect(bindoffIdx).toBeLessThan(resetIdx);
  });

  it("omits the bind-off line when the final printable checklist row has 0 stitches remaining", () => {
    const chart = buildActiveSideChartWithFinalRemaining({ initial: 16, finalRemaining: 0 });
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(chart);
    expect(html).not.toMatch(/Bind off remaining\s+\d+\s+stitch/i);
    expect(html).not.toContain("ns-shaping-mini__bindoff-remaining");
  });
});
