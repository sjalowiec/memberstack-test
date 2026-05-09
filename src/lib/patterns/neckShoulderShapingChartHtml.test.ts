import { describe, expect, it } from "vitest";
import {
  collapsePlainKnitChartRowsForDisplay,
  collapsePlainKnitChartRowsForPrint,
  neckShoulderShapingChartFromRows,
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  ACTIVE_SHOULDER_RESET_RC_SENTENCE,
  formatActiveShoulderCenterNecklinePlainSentence,
} from "./neckShoulderActiveIntroCopy";
import {
  ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ACTIVE_SHOULDER_DIVIDE_SENTENCE,
  compactActiveSideInstructionRowsForPrint,
  renderActiveShoulderChartIntroHtml,
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
    expect(html).toContain("ns-shaping-mini__diagram-notation-help");
    expect(html).toContain("<strong>Shaping notation:</strong> stitches, rows, times");
    expect(html).toContain("1s-2r-3x = decrease 1 stitch every 2 rows, 3 times");

    // Carriage parity rule for the active right shoulder:
    //   Carriage Right (even RC) ⇒ Armhole edge; Carriage Left (odd RC) ⇒ Neck edge.
    // The neck decrease should land on an odd RC and the armhole bind-off on an even RC.
    expect(html).toMatch(/000<\/td>\s*<td>Right<\/td>\s*<td>Knit in pattern<\/td>\s*<td>Armhole<\/td>/);
    expect(html).toMatch(/001<\/td>\s*<td>Left<\/td>\s*<td>Decrease 3 sts<\/td>\s*<td>Neck<\/td>/);
    expect(html).toMatch(/002<\/td>\s*<td>Right<\/td>\s*<td>Bind off 8 sts<\/td>\s*<td>Armhole<\/td>/);
  });

  it("offsets printable checklist RC column when activeSideRcStart is non-zero", () => {
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
      "ns-shaping-chart-print-local-rc",
      undefined,
      { activeSideRcStart: 78 },
    );

    expect(html).not.toMatch(/ns-shaping-mini__rc">000</);
    expect(html).toContain(">078<");
    expect(html).toContain(">079<");
    expect(html).toContain(">080<");
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

    // Carriage parity rule: Right (even RC) → Armhole edge, Left (odd RC) → Neck edge.
    expect(html).toMatch(/001<\/td>\s*<td>Left<\/td>\s*<td>Decrease 3 sts<\/td>\s*<td>Neck<\/td>/);
    expect(html).toMatch(/002<\/td>\s*<td>Right<\/td>\s*<td>Bind off 8 sts<\/td>\s*<td>Armhole<\/td>/);

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

  /**
   * Visible sleeveless pattern table (`pattern.astro` / beta-pattern): RC + Carriage Position + Action + Edge + Sts.
   * Must run the same plain-knit compaction as print (not gated on `compactPlainKnitSpansForPrint`).
   */
  it("compacts consecutive plain Knit in pattern rows in the active-side table (pattern tab path)", () => {
    const chartRows: NeckShoulderShapingChartRow[] = [
      {
        row: 100,
        action: "",
        leftSide: "-",
        leftNeck: "-",
        centerNeck: "-12",
        rightNeck: "-",
        rightSide: "-",
        leftStitchCount: 55,
        rightStitchCount: 55,
      },
    ];
    for (let r = 101; r <= 119; r++) {
      chartRows.push(plainRow(r, { left: 55, right: 55 }));
    }
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      neckShoulderShapingChartFromRows(chartRows),
      "ns-active-plain-compact",
      undefined,
      { activeSideOnly: true, activeSideRcStart: 0 },
    );
    const firstTbody = html.split("</tbody>")[0] ?? html;
    expect(firstTbody).toMatch(/000[\u2013-]018/);
    expect(firstTbody).toContain("Alternating Left/Right");
    expect(firstTbody).toContain("Alternating Neck/Armhole");
    expect((firstTbody.match(/Knit in pattern/g) ?? []).length).toBe(1);
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

/**
 * Parse the rendered active-side checklist back into structured rows so tests can verify
 * carriage parity, edge labels, and stitch counts without depending on whitespace.
 *
 * The active-side `<tbody>` rows have this exact column order:
 *   [RC, Carriage Position, Action, Edge, Sts Remaining]
 *
 * `firstTableOnly: true` (default) limits parsing to the FIRST table in the rendered HTML —
 * for online charts this is the visible active-side checklist; the (hidden) second-shoulder
 * checklist comes after and would otherwise double-count rows.
 */
function parseActiveSideTableRows(
  html: string,
  options: { firstTableOnly?: boolean } = {}
): Array<{
  rc: number;
  carriagePosition: "Right" | "Left";
  action: string;
  edge: string;
  stitchesRemaining: number;
}> {
  const firstTableOnly = options.firstTableOnly !== false;
  const tbodyOpen = "<tbody>";
  const tbodyClose = "</tbody>";
  const tbodyStart = html.indexOf(tbodyOpen);
  if (tbodyStart < 0) return [];
  const tbodyEnd = firstTableOnly
    ? html.indexOf(tbodyClose, tbodyStart)
    : html.lastIndexOf(tbodyClose);
  if (tbodyEnd < 0) return [];
  const body = html.slice(tbodyStart + tbodyOpen.length, tbodyEnd);
  const rowRe = /<tr\s[^>]*>([\s\S]*?)<\/tr>/g;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
  const out: Array<{
    rc: number;
    carriagePosition: "Right" | "Left";
    action: string;
    edge: string;
    stitchesRemaining: number;
  }> = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(body))) {
    const rowHtml = m[1] ?? "";
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowHtml))) {
      cells.push(String(cm[1] ?? "").trim());
    }
    if (cells.length < 5) continue;
    const rcLabel = cells[0]!;
    const carriage = cells[1]! as "Right" | "Left";
    const action = cells[2]!;
    const edge = cells[3]!;
    const sts = cells[4]!;
    const rc = parseInt(rcLabel, 10);
    if (!Number.isFinite(rc)) continue;
    if (carriage !== "Right" && carriage !== "Left") continue;
    out.push({
      rc,
      carriagePosition: carriage,
      action,
      edge,
      stitchesRemaining: parseInt(sts, 10),
    });
  }
  return out;
}

/**
 * The chart represents the active RIGHT shoulder. For that piece the right-side edge of
 * the active stitches is the Armhole/outer edge, and the left-side edge is the Neck/inner
 * edge. A shaping action is ONLY valid on the edge where the carriage is currently located,
 * so:
 *   - Carriage Right (even RC) ⇒ action edge must be Armhole.
 *   - Carriage Left  (odd RC) ⇒ action edge must be Neck.
 * Plain "Knit in pattern" rows may appear at either parity (no shaping).
 */
function expectActiveSideRowsObeyCarriageRule(
  rows: ReturnType<typeof parseActiveSideTableRows>,
): void {
  for (const r of rows) {
    expect(r.carriagePosition).toBe(r.rc % 2 === 0 ? "Right" : "Left");
    if (/Bind off|Decrease/i.test(r.action)) {
      if (r.carriagePosition === "Right") {
        expect(r.edge).toBe("Armhole");
      } else {
        expect(r.edge).toBe("Neck");
      }
    }
  }
}

describe("active-side checklist carriage rule", () => {
  it("schedules every shaping action on a row whose carriage side matches the active edge", () => {
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      neckShoulderShapingChartFromRows([
        {
          row: 100,
          action: "",
          leftSide: "-",
          leftNeck: "-",
          centerNeck: "-12",
          rightNeck: "-",
          rightSide: "-",
          leftStitchCount: 38,
          rightStitchCount: 38,
        },
        {
          row: 101,
          action: "Neck",
          leftSide: "-",
          leftNeck: "-3",
          centerNeck: "-",
          rightNeck: "-3",
          rightSide: "-",
          leftStitchCount: 35,
          rightStitchCount: 35,
        },
        {
          row: 101,
          action: "Shoulder",
          leftSide: "-7",
          leftNeck: "-",
          centerNeck: "-",
          rightNeck: "-",
          rightSide: "-7",
          leftStitchCount: 28,
          rightStitchCount: 28,
        },
        {
          row: 103,
          action: "Shoulder",
          leftSide: "-7",
          leftNeck: "-",
          centerNeck: "-",
          rightNeck: "-",
          rightSide: "-7",
          leftStitchCount: 21,
          rightStitchCount: 21,
        },
      ]),
      "ns-back",
      undefined,
      { activeSideOnly: true },
    );

    const rows = parseActiveSideTableRows(html, { firstTableOnly: true });
    expect(rows.length).toBeGreaterThan(0);
    expectActiveSideRowsObeyCarriageRule(rows);
  });
});

describe("Back active shoulder synthetic 38 → 4 example", () => {
  /**
   * User-specified scenario: active shoulder begins at 38 stitches after the center bind-off
   * row, removes 34 stitches through the chart, and leaves 4 stitches before the final bind-off.
   * This mirrors a Back where shoulderBandTotal/2 + neck-edge stitches = 38 per side.
   */
  function build38Sts4FinalChart(): ReturnType<typeof neckShoulderShapingChartFromRows> {
    const rows: NeckShoulderShapingChartRow[] = [
      {
        row: 200,
        action: "",
        leftSide: "-",
        leftNeck: "-",
        centerNeck: "-8",
        rightNeck: "-",
        rightSide: "-",
        leftStitchCount: 38,
        rightStitchCount: 38,
      },
      {
        row: 201,
        action: "Neck",
        leftSide: "-",
        leftNeck: "-3",
        centerNeck: "-",
        rightNeck: "-3",
        rightSide: "-",
        leftStitchCount: 35,
        rightStitchCount: 35,
      },
      {
        row: 203,
        action: "Shoulder",
        leftSide: "-9",
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: "-9",
        leftStitchCount: 26,
        rightStitchCount: 26,
      },
      {
        row: 205,
        action: "Shoulder",
        leftSide: "-9",
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: "-9",
        leftStitchCount: 17,
        rightStitchCount: 17,
      },
      {
        row: 207,
        action: "Shoulder",
        leftSide: "-9",
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: "-9",
        leftStitchCount: 8,
        rightStitchCount: 8,
      },
      {
        row: 209,
        action: "Shoulder",
        leftSide: "-4",
        leftNeck: "-",
        centerNeck: "-",
        rightNeck: "-",
        rightSide: "-4",
        leftStitchCount: 4,
        rightStitchCount: 4,
      },
    ];
    return neckShoulderShapingChartFromRows(rows);
  }

  it("renders 38 stitches initially, removes 34 through the chart, and ends with 4 stitches remaining", () => {
    const chart = build38Sts4FinalChart();
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-back", undefined, {
      activeSideOnly: true,
    });
    const rows = parseActiveSideTableRows(html, { firstTableOnly: true });
    expect(rows.length).toBeGreaterThan(0);

    // First active-side row inherits the post-center starting count (38 on the right side).
    // The first action row's `Sts Remaining` cell shows the count AFTER its own action, so the
    // earliest decrement (the neck Decrease 3) leaves 35 — confirming the initial was 38.
    const firstShapingRow = rows.find((r) => /Bind off|Decrease/i.test(r.action));
    expect(firstShapingRow).toBeDefined();
    expect(firstShapingRow!.action).toMatch(/Decrease 3 sts/);
    expect(firstShapingRow!.stitchesRemaining).toBe(35);

    // 34 stitches are removed total; the final visible checklist row has 4 remaining.
    const lastRow = rows[rows.length - 1]!;
    expect(lastRow.stitchesRemaining).toBe(4);

    // Carriage rule still holds for every shaping row in the synthetic chart.
    expectActiveSideRowsObeyCarriageRule(rows);

    // Final instruction is explicit and uses the plural "stitches" form for 4 sts.
    expect(html).toContain("Bind off remaining 4 stitches.");
  });

  it("renders the same final bind-off line for the print sheet", () => {
    const chart = build38Sts4FinalChart();
    const html = renderNeckShoulderShapingPrintInstructionTableHtml(chart);
    expect(html).toContain("Bind off remaining 4 stitches.");
    const rows = parseActiveSideTableRows(html, { firstTableOnly: true });
    expectActiveSideRowsObeyCarriageRule(rows);
    const lastRow = rows[rows.length - 1]!;
    expect(lastRow.stitchesRemaining).toBe(4);
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

describe("formatActiveShoulderCenterNecklinePlainSentence", () => {
  it("uses Armhole RC milestone wording (not duplicate RC: labels)", () => {
    expect(
      formatActiveShoulderCenterNecklinePlainSentence({
        localStartRcLabel: "RC:010",
        centerBindOffStitches: 12,
      }),
    ).toBe("When Armhole RC reaches 010, bind off the center 12 neckline stitches.");
  });
});

describe("print-only plain knit span compaction", () => {
  it("merges RC 056–076 into one printable checklist row when action is only Knit in pattern", () => {
    const rows = [];
    for (let rc = 56; rc <= 76; rc++) {
      rows.push({
        rc,
        carriagePosition: rc % 2 === 0 ? "Right" : "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: rc % 2 === 0 ? "Armhole" : "Neck",
        stitchesRemaining: 40,
      });
    }
    const compacted = compactActiveSideInstructionRowsForPrint(rows);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].rc).toBe(56);
    expect(compacted[0].rcEnd).toBe(76);
    expect(compacted[0].action).toBe(NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL);
    expect(compacted[0].carriagePosition).toBe("Alternating Left/Right");
    expect(compacted[0].edge).toBe("Alternating Neck/Armhole");
  });

  it("does not merge across a shaping row", () => {
    const rows = [
      {
        rc: 56,
        carriagePosition: "Right",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Armhole",
        stitchesRemaining: 40,
      },
      {
        rc: 57,
        carriagePosition: "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Neck",
        stitchesRemaining: 40,
      },
      {
        rc: 58,
        carriagePosition: "Right",
        action: "Decrease 2 sts",
        edge: "Neck",
        stitchesRemaining: 38,
      },
      {
        rc: 59,
        carriagePosition: "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Neck",
        stitchesRemaining: 38,
      },
      {
        rc: 60,
        carriagePosition: "Right",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Armhole",
        stitchesRemaining: 38,
      },
    ];
    const compacted = compactActiveSideInstructionRowsForPrint(rows);
    expect(compacted).toHaveLength(3);
    expect(compacted[0].rcEnd).toBe(57);
    expect(compacted[1].action).toContain("Decrease");
    expect(compacted[2].rcEnd).toBe(60);
  });

  it("renders RC:056–076 with stitch count unchanged on the full chart when compactPlainKnitSpansForPrint is set", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let r = 56; r <= 76; r++) {
      rows.push(plainRow(r, { left: 22, right: 22 }));
    }
    const chart = neckShoulderShapingChartFromRows(rows);
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-print-compact", undefined, {
      compactPlainKnitSpansForPrint: true,
    });
    expect(html).toContain("RC:056\u2013076");
    expect(html).toContain(NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL);
    expect(html).toContain("stitch count unchanged");
  });

  it("collapses source chart rows via collapsePlainKnitChartRowsForPrint without mutating inputs", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let r = 56; r <= 76; r++) {
      rows.push(plainRow(r, { left: 22, right: 22 }));
    }
    const before = rows.map((r) => r.row);
    const collapsed = collapsePlainKnitChartRowsForPrint(rows);
    expect(rows.map((r) => r.row)).toEqual(before);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].rowLabel).toBe("RC:056\u2013076");
  });
});

describe("collapsePlainKnitChartRowsForDisplay (shared online + print)", () => {
  it("collapses consecutive plain knit rows into one range with alternating meta", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let r = 25; r <= 43; r++) {
      rows.push(plainRow(r, { left: 22, right: 22 }));
    }
    const online = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
    const print = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "print" });
    expect(online).toHaveLength(1);
    expect(print).toHaveLength(1);
    expect(online[0].rowLabel).toBe("025\u2013043");
    expect(print[0].rowLabel).toBe("RC:025\u2013043");
    expect(online[0].plainKnitCarriageLabel).toBe("Alternating Left/Right");
    expect(online[0].plainKnitEdgeLabel).toBe("Alternating Neck/Armhole");
  });

  it("does not collapse when stitch counts change between plain rows", () => {
    const rows = [plainRow(10, { left: 22, right: 22 }), plainRow(11, { left: 21, right: 21 })];
    const out = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
    expect(out).toHaveLength(2);
  });

  it("does not collapse across bind-off / decrease shaping rows", () => {
    const rows = [
      plainRow(10, { left: 22, right: 22 }),
      {
        ...plainRow(11, { left: 20, right: 20 }),
        action: "Shoulder",
        leftSide: "-1",
        rightSide: "-1",
      },
      plainRow(12, { left: 20, right: 20 }),
    ];
    const out = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
    expect(out).toHaveLength(3);
  });

  it("produces the same number of display rows for online and print label styles", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let r = 1; r <= 50; r++) {
      rows.push(plainRow(r, { left: 40, right: 40 }));
    }
    rows.push({
      ...plainRow(51, { left: 38, right: 38 }),
      action: "Neck",
      leftNeck: "-1",
      rightNeck: "-1",
    });
    const a = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
    const b = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "print" });
    expect(a.length).toBe(b.length);
    expect(a.length).toBe(2);
  });

  it("embeds plain-knit carriage/edge meta in generated chart table HTML", () => {
    const rows: NeckShoulderShapingChartRow[] = [];
    for (let r = 25; r <= 43; r++) {
      rows.push(plainRow(r, { left: 22, right: 22 }));
    }
    const chart = neckShoulderShapingChartFromRows(rows);
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-online-plain-meta");
    expect(html).toContain("ns-shaping-chart__plain-knit-meta");
    expect(html).toContain("Alternating Left/Right");
    expect(html).toContain("Alternating Neck/Armhole");
  });
});

describe("renderActiveShoulderChartIntroHtml", () => {
  const sharedOpts = { localStartRcLabel: "RC:010", centerBindOffStitches: 12 };

  it("uses the same instructional sentences for compact (print) and labeled (online) layouts", () => {
    const compact = renderActiveShoulderChartIntroHtml({
      ...sharedOpts,
      wrapperClass: "print-chart-intro",
      layout: "compact",
    });
    const labeled = renderActiveShoulderChartIntroHtml({
      ...sharedOpts,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
    });
    const needles = [
      "When Armhole RC reaches 010, bind off the center 12 neckline stitches.",
      ACTIVE_SHOULDER_RESET_RC_SENTENCE,
      ACTIVE_SHOULDER_DIVIDE_SENTENCE,
      ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
    ];
    for (const n of needles) {
      expect(compact).toContain(n);
      expect(labeled).toContain(n);
    }
    expect(compact).not.toMatch(/reset\s+(?:the\s+)?row counter/i);
    expect(labeled).not.toMatch(/reset\s+(?:the\s+)?row counter/i);
    expect(labeled).toContain("Center Neckline:");
    expect(compact).toContain("Center Neckline:");
    expect(compact).not.toContain("<strong>Setup</strong>");
    expect(labeled).not.toContain("<strong>Setup</strong>");
  });
});
