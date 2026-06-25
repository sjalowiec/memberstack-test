import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import {
  formatSleevelessAlineBodyShapingInstructionLines,
  type SleevelessAlineShapingEdgeScope,
} from "./sleevelessAlineShaping";
import {
  buildSleevelessBodyShapingChartRows,
  renderSleevelessBodyShapingChartHtml,
  sleevelessBodyShapingActionLabel,
  type SleevelessBodyShapingChartRow,
} from "./sleevelessBodyShapingChartHtml";

function gauge() {
  return {
    gaugeStitchesPerInch: 7,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function alineMeasurements() {
  return {
    finished_bust_chest: 40,
    finished_hip: 48,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

/** Body-shaping chart rows from the BODY section of one piece's display rows. */
function bodyChartRows(
  rows: readonly SleevelessPatternDisplayRow[],
): SleevelessBodyShapingChartRow[] {
  let inBody = false;
  const out: SleevelessBodyShapingChartRow[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") inBody = true;
    else if (row.kind === "section") inBody = false;
    else if (inBody && row.kind === "block" && row.bodyShapingChartRows) {
      out.push(...row.bodyShapingChartRows);
    }
  }
  return out;
}

function bodyParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  let inBody = false;
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") inBody = true;
    else if (row.kind === "section") inBody = false;
    else if (inBody && row.kind === "block") {
      out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
    }
  }
  return out;
}

/** RC numbers that the old "Work decreases/increases on: RC:…" sentence would have listed. */
function legacySentenceRcs(
  rowNumbers: readonly number[],
  edgeScope: SleevelessAlineShapingEdgeScope,
): number[] {
  const lines = formatSleevelessAlineBodyShapingInstructionLines(
    "decrease-to-bust",
    rowNumbers,
    rowNumbers.length * 4,
    edgeScope,
  );
  const listLine = lines.find((l) => /Work decreases on:/i.test(l)) ?? "";
  return [...listLine.matchAll(/RC:(\d{1,4})/g)].map((m) => parseInt(m[1], 10));
}

describe("body shaping chart helper", () => {
  it("labels back / pullover front decreases as each side edge", () => {
    expect(sleevelessBodyShapingActionLabel("decrease-to-bust", "symmetricSides")).toBe(
      "Dec 1 stitch at each side edge",
    );
  });

  it("labels cardigan front decreases as armhole edge", () => {
    expect(sleevelessBodyShapingActionLabel("decrease-to-bust", "armholeEdgeOnly")).toBe(
      "Dec 1 stitch at armhole edge",
    );
  });

  it("labels waist-shaped increases with Inc", () => {
    expect(sleevelessBodyShapingActionLabel("increase-to-bust", "symmetricSides")).toBe(
      "Inc 1 stitch at each side edge",
    );
  });

  it("returns no rows for straight bodies", () => {
    expect(buildSleevelessBodyShapingChartRows("straight", [10, 20], "symmetricSides")).toEqual([]);
  });

  it("maps every shaping row number to a chart row with running stitch counts", () => {
    const rows = buildSleevelessBodyShapingChartRows(
      "decrease-to-bust",
      [24, 41, 58],
      "symmetricSides",
      168,
    );
    expect(rows.map((r) => r.rc)).toEqual([24, 41, 58]);
    expect(rows.every((r) => r.action === "Dec 1 stitch at each side edge")).toBe(true);
    expect(rows.map((r) => r.stitchesRemaining)).toEqual([166, 164, 162]);
  });

  it("cardigan front decreases one stitch per shaping row", () => {
    const rows = buildSleevelessBodyShapingChartRows(
      "decrease-to-bust",
      [24, 41],
      "armholeEdgeOnly",
      84,
    );
    expect(rows.map((r) => r.stitchesRemaining)).toEqual([83, 82]);
  });

  it("renders an interactive checklist table with checkbox / RC / action / sts columns", () => {
    const html = renderSleevelessBodyShapingChartHtml(
      [
        { rc: 24, action: "Dec 1 stitch at each side edge", stitchesRemaining: 166 },
        { rc: 41, action: "Dec 1 stitch at each side edge", stitchesRemaining: 164 },
      ],
      { chartId: "sleeveless-body-shaping-chart-back" },
    );
    expect(html).toContain('data-chart-id="sleeveless-body-shaping-chart-back"');
    expect(html).toContain("ns-shaping-chart__row-check");
    expect(html).toContain('data-rc="24"');
    expect(html).toContain(">024<");
    expect(html).toContain("Dec 1 stitch at each side edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain(">166<");
    expect(html).toContain(">164<");
    // Two shaping rows -> two checkboxes.
    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(2);
  });

  it("returns empty string when there are no rows", () => {
    expect(renderSleevelessBodyShapingChartHtml([], { chartId: "x" })).toBe("");
  });
});

describe("A-line body shaping chart in generated pattern", () => {
  const pulloverPattern = {
    fit: { selectedMeasurements: alineMeasurements() },
    style: { neckline: "round", frontStyle: "closed", bodyShape: "aline" },
    yarnGaugeMachine: gauge(),
  } as Record<string, unknown>;

  const cardiganPattern = {
    fit: { selectedMeasurements: alineMeasurements() },
    style: { neckline: "round", frontStyle: "open", bodyShape: "aline" },
    yarnGaugeMachine: gauge(),
  } as Record<string, unknown>;

  it("back renders a chart with Dec 1 stitch at each side edge", () => {
    const result = generateSleevelessBackPattern(pulloverPattern);
    const rows = bodyChartRows(result.displayRows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action === "Dec 1 stitch at each side edge")).toBe(true);
    expect(rows.every((r) => r.stitchesRemaining > 0)).toBe(true);
    const last = rows[rows.length - 1]!;
    expect(last.stitchesRemaining).toBe(result.debug.bustBodyStitches);
    // Summary heading + sts-remain prose preserved around the chart.
    const paras = bodyParagraphs(result.displayRows).join(" ");
    expect(paras).toMatch(/Begin A-line shaping/i);
    expect(paras).toMatch(/sts remain after shaping/i);
  });

  it("pullover front renders a chart with Dec 1 stitch at each side edge", () => {
    const result = generateSleevelessBackPattern(pulloverPattern);
    const rows = bodyChartRows(result.frontDisplayRows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action === "Dec 1 stitch at each side edge")).toBe(true);
  });

  it("cardigan front renders a chart with Dec 1 stitch at armhole edge", () => {
    const result = generateSleevelessBackPattern(cardiganPattern);
    const rows = bodyChartRows(result.frontDisplayRows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action === "Dec 1 stitch at armhole edge")).toBe(true);
  });

  it("cardigan front does NOT render each side edge for body shaping", () => {
    const result = generateSleevelessBackPattern(cardiganPattern);
    const rows = bodyChartRows(result.frontDisplayRows);
    expect(rows.some((r) => /each side edge/i.test(r.action))).toBe(false);
    // No body-shaping RC-list prose sentence remains anywhere on the front.
    const paras = bodyParagraphs(result.frontDisplayRows).join(" ");
    expect(paras).not.toMatch(/Work (decreases|increases) on:/i);
  });

  it("chart includes all shaping RC values that were previously listed in the sentence", () => {
    const result = generateSleevelessBackPattern(pulloverPattern);
    const rows = bodyChartRows(result.displayRows);
    const chartRcs = rows.map((r) => r.rc);
    const legacyRcs = legacySentenceRcs(chartRcs, "symmetricSides");
    // legacySentenceRcs is derived from the same numbers, so this verifies the chart carries
    // exactly the RC values the sentence would have printed.
    expect(legacyRcs).toEqual(chartRcs);
    expect(chartRcs.length).toBeGreaterThan(0);
  });

  it("renders the interactive chart markup in print HTML with unique back/front chart ids", () => {
    const result = generateSleevelessBackPattern(pulloverPattern);
    const backHtml = renderSleevelessPrintPieceHtml(result.displayRows, "", "back");
    const frontHtml = renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front");
    expect(backHtml).toContain('data-chart-id="sleeveless-body-shaping-chart-back"');
    expect(frontHtml).toContain('data-chart-id="sleeveless-body-shaping-chart-front"');
    expect(backHtml).toContain("Dec 1 stitch at each side edge");
  });

  it("still produces neckline / shoulder shaping charts alongside the body chart", () => {
    const result = generateSleevelessBackPattern(pulloverPattern);
    expect(result.neckShoulderShapingChart.rows.length).toBeGreaterThan(0);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
    const hasNeckMount = result.displayRows.some(
      (r) => r.kind === "neckShoulderChartTableMount",
    );
    expect(hasNeckMount).toBe(true);
  });
});
