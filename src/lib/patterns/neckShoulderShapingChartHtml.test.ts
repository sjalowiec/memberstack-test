import { describe, expect, it } from "vitest";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL, plainKnitSpanCarriageEdgeDisplay } from "./neckShoulderShapingChart";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  compactActiveSideInstructionRowsForPrint,
  formatActionCellHtml,
  neckShoulderChartHasCarriagePositionColumn,
  renderActiveShoulderChartIntroHtml,
  renderCarriagePositionPatternTipHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";

type ChecklistRow = {
  rc: number;
  rcEnd?: number;
  carriagePosition: string;
};

function secondShoulderCarriageAtRc(rc: number): "Right" | "Left" {
  return rc % 2 === 0 ? "Left" : "Right";
}

function expandChecklistRowsByRc(rows: readonly ChecklistRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    const end = row.rcEnd !== undefined ? row.rcEnd : row.rc;
    for (let rc = row.rc; rc <= end; rc++) {
      if (row.carriagePosition === "Alternating Left/Right") {
        map.set(rc, secondShoulderCarriageAtRc(rc));
      } else {
        map.set(rc, row.carriagePosition);
      }
    }
  }
  return map;
}

function expectStrictAlternatingCarriage(map: Map<number, string>, fromRc: number, toRc: number): void {
  for (let rc = fromRc; rc <= toRc; rc++) {
    expect(map.get(rc), `RC ${rc}`).toBe(secondShoulderCarriageAtRc(rc));
  }
  for (let rc = fromRc + 1; rc <= toRc; rc++) {
    expect(map.get(rc - 1)).not.toBe(map.get(rc));
  }
}

function parseSecondShoulderChecklistFromHtml(html: string): Map<number, string> {
  const block =
    html.match(/Second Shoulder Checklist[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  const map = new Map<number, string>();
  // Carriage position now lives inside the Row Counter cell as structured spans, e.g.
  // `<span class="...row-counter-number">037</span> <span class="...row-counter-side">(Left)</span>`.
  for (const match of block.matchAll(
    /<span class="ns-shaping-chart__row-counter-number">(\d{3})(?:\u2013(\d{3}))?<\/span> <span class="ns-shaping-chart__row-counter-side">\((Right|Left|Alternating Left\/Right)\)<\/span>/g,
  )) {
    const start = parseInt(match[1]!, 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const carriage = match[3]!;
    for (let rc = start; rc <= end; rc++) {
      map.set(
        rc,
        carriage === "Alternating Left/Right" ? secondShoulderCarriageAtRc(rc) : carriage,
      );
    }
  }
  return map;
}

function baseRoundNeckPattern(): Record<string, unknown> {
  return {
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
  };
}

describe("carriage position pattern tip", () => {
  it("detects the Carriage Position column only on active-shoulder checklists", () => {
    expect(neckShoulderChartHasCarriagePositionColumn({ activeSideOnly: true })).toBe(true);
    expect(neckShoulderChartHasCarriagePositionColumn({ activeSideOnly: false })).toBe(false);
    expect(neckShoulderChartHasCarriagePositionColumn(undefined)).toBe(false);
  });

  it("renders the collapsible tip before the chart table for back and front active-shoulder charts", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.neckShoulderShapingChart,
      r.firstArmholeGarmentRc,
    );
    const frontRcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.frontNeckShoulderShapingChart,
      r.firstArmholeGarmentRc,
    );
    const backHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      r.neckShoulderShapingChart,
      "test-carriage-tip-back",
      undefined,
      { activeSideOnly: true, activeSideRcStart: rcStart },
    );
    const frontHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      r.frontNeckShoulderShapingChart,
      "test-carriage-tip-front",
      undefined,
      { activeSideOnly: true, activeSideRcStart: frontRcStart },
    );
    for (const html of [backHtml, frontHtml]) {
      const tipIdx = html.indexOf("pattern-help-card__title");
      const titleIdx = html.indexOf("Carriage Position");
      const tableIdx = html.indexOf("ns-shaping-chart__table");
      expect(tipIdx).toBeGreaterThanOrEqual(0);
      expect(titleIdx).toBeGreaterThanOrEqual(0);
      expect(tableIdx).toBeGreaterThan(titleIdx);
      expect(html).toContain("before knitting that row");
      expect(html).toContain("on the right side before you begin knitting");
      expect(html).toContain("pattern-help-card__details");
      expect(html).toContain('data-tip-id="sleeveless-carriage-position"');
      expect(html).toContain("no-print");
    }
  });

  it("omits the tip on full-grid charts without a Carriage Position column", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      r.neckShoulderShapingChart,
      "test-carriage-tip-full",
      undefined,
      { activeSideOnly: false, includeDoneColumn: false },
    );
    expect(html).not.toContain(">Carriage Position</th>");
    expect(renderCarriagePositionPatternTipHtml({ activeSideOnly: false })).toBe("");
    expect(html).not.toContain("pattern-help-card__title");
    expect(html).not.toContain('data-tip-id="sleeveless-carriage-position"');
    expect(html).not.toContain("before knitting that row");
  });

  it("does not add the online tip to print mini-table HTML", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      r.neckShoulderShapingChart,
      "test-print-carriage-tip",
      "",
      {},
    );
    expect(printHtml).toContain("Carriage Position</th>");
    expect(printHtml).not.toContain('data-tip-id="sleeveless-carriage-position"');
    expect(printHtml).not.toContain("pattern-help-card__details");
  });
});

describe("online checklist combines Row Counter + Carriage Position", () => {
  function onlineActiveSideHtml(): string {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc);
    return renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-combined-rc", undefined, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
    });
  }

  function primaryTbody(html: string): string {
    return html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  }

  it("no longer renders a separate Carriage Position column header in the online table", () => {
    const html = onlineActiveSideHtml();
    // The dedicated column header is gone (the collapsible help-card title may still say it).
    expect(html).not.toContain(">Carriage Position</th>");
    // The Row Counter / RC header is still present.
    expect(html).toContain('class="ns-shaping-chart__th-row">RC</th>');
  });

  it("shows row counter + carriage side using full words via distinguishable number/side markup", () => {
    const tbody = primaryTbody(onlineActiveSideHtml());
    const cells = [
      ...tbody.matchAll(
        /<td class="ns-shaping-chart__td-rc"><span class="ns-shaping-chart__row-counter-number">(\d{3})<\/span> <span class="ns-shaping-chart__row-counter-side">\((Left|Right)\)<\/span><\/td>/g,
      ),
    ];
    expect(cells.length).toBeGreaterThan(0);
    // Full words only — never abbreviated to L/R.
    expect(tbody).not.toMatch(/row-counter-side">\([LR]\)</);
    for (const cell of cells) {
      expect(["Left", "Right"]).toContain(cell[2]);
    }
    // The number and the parenthetical side use separate, distinguishable classes.
    expect(tbody).toContain('class="ns-shaping-chart__row-counter-number"');
    expect(tbody).toContain('class="ns-shaping-chart__row-counter-side"');
  });

  it("applies a zebra-striping checklist class to the online checklist table", () => {
    const html = onlineActiveSideHtml();
    expect(html).toContain("ns-shaping-chart__table--checklist");
  });

  it("keeps the formal PDF/print mini-table on its separate renderer with its own Carriage Position column", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc);
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(chart, "test-print-combined", "", {
      activeSideRcStart: rcStart,
    });
    // Print output is unchanged: dedicated Carriage Position column header remains...
    expect(printHtml).toContain("Carriage Position</th>");
    // ...and carriage lives in its own cell, not merged into the RC cell or styled spans.
    expect(printHtml).not.toContain("ns-shaping-chart__row-counter-number");
    expect(printHtml).not.toContain("ns-shaping-chart__table--checklist");
    expect(printHtml).toMatch(/<td>(Left|Right|Alternating Left\/Right)<\/td>/);
  });
});

describe("center neckline divide/setup row moved out of the online checklist", () => {
  function vNeckPattern(): Record<string, unknown> {
    return {
      ...baseRoundNeckPattern(),
      style: { recipientCategory: "misses", neckline: "v-neck" },
    };
  }

  function firstPrimaryTbody(html: string): string {
    return html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  }

  function firstPrimaryTbodyRow(html: string): string {
    return firstPrimaryTbody(html).match(/<tr[\s\S]*?<\/tr>/)?.[0] ?? "";
  }

  function buildIntro(chart: Parameters<typeof renderActiveShoulderChartIntroHtml>[0]["chart"], rcLabel: string) {
    return renderActiveShoulderChartIntroHtml({
      localStartRcLabel: rcLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(chart),
      chart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
      includeWorkflowSteps: true,
    });
  }

  it("round back: divide is shown above the table; first table row is real shaping, not the divide/setup row", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const intro = buildIntro(chart, "RC:050");

    // Sanity: this round-neck back actually has a center divide/setup row in the raw checklist.
    const builtRows = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(builtRows.some((row) => row.edge === "Center")).toBe(true);
    const firstShapingRc = builtRows.find((row) => row.edge !== "Center")?.rc;

    const tableHidden = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-hide-back", intro, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
      tableHeading: "First Shoulder Checklist",
    });

    // 1. The divide/setup instruction is present (in the intro above the table)...
    expect(intro).toContain("Divide the Neckline");
    expect(intro).toMatch(/scrap off/i);
    const introIdx = tableHidden.indexOf("Divide the Neckline");
    const tableIdx = tableHidden.indexOf("ns-shaping-chart__table");
    expect(introIdx).toBeGreaterThanOrEqual(0);
    expect(tableIdx).toBeGreaterThan(introIdx);

    // 2. ...but the divide/setup row is gone from the table body itself.
    const tbody = firstPrimaryTbody(tableHidden);
    expect(tbody).not.toContain(">Center</td>");
    expect(tbody).not.toMatch(/to divide/i);

    // 3. The first visible table row is the first actual shaping/knit row (RC preserved).
    //    Carriage position is shown inside the Row Counter cell via structured spans, e.g.
    //    `<span class="...row-counter-number">001</span> <span class="...row-counter-side">(Left)</span>`.
    const firstRow = firstPrimaryTbodyRow(tableHidden);
    expect(firstRow).not.toContain(">Center</td>");
    expect(firstRow).toMatch(/>(Armhole|Neck)<\/td>/);
    expect(firstRow).toMatch(
      new RegExp(
        `<span class="ns-shaping-chart__row-counter-number">${String(firstShapingRc).padStart(
          3,
          "0",
        )}</span> <span class="ns-shaping-chart__row-counter-side">\\((Left|Right)\\)</span>`,
      ),
    );

    // Heading renamed online.
    expect(tableHidden).toContain("First Shoulder Checklist");
  });

  it("round back: hiding the setup row never changes the remaining rows' RC / stitch counts", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    // The render layer simply filters the divide/setup row out of the built rows; every other
    // row (rc, carriage, action, edge, stitchesRemaining) is untouched. Validate that invariant
    // directly on the shared builder so the shaping math can never drift.
    const built = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const setupRows = built.filter((row) => row.edge === "Center");
    const remaining = built.filter((row) => row.edge !== "Center");
    expect(setupRows.length).toBe(1);
    // Setup row is the first row; dropping it leaves the rest byte-for-byte identical.
    expect(remaining).toEqual(built.slice(1));
  });

  it("V-neck front: no center divide/setup row exists, so the first table row is already real shaping", () => {
    const r = generateSleevelessBackPattern(vNeckPattern());
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const builtRows = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(builtRows.some((row) => row.edge === "Center")).toBe(false);

    const intro = buildIntro(chart, "RC:100");
    const tableHidden = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-hide-front", intro, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
      tableHeading: "First Shoulder Checklist",
    });

    expect(intro).toContain("Divide the Neckline");
    expect(tableHidden).not.toContain(">Center</td>");
    const firstRow = firstPrimaryTbodyRow(tableHidden);
    expect(firstRow).not.toContain(">Center</td>");
    expect(firstRow).toMatch(/>(Armhole|Neck)<\/td>/);
  });

  it("keeps the default heading when tableHeading is not provided (print mini-table unaffected)", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const defaultHeading = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-default", undefined, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
    });
    expect(defaultHeading).toContain("Neckline / Shoulder Shaping Chart");
    expect(defaultHeading).not.toContain("First Shoulder Checklist");

    // The formal PDF mini-table still includes the divide/setup row (print output unchanged).
    const printMini = renderNeckShoulderShapingPrintInstructionTableHtml(chart, "test-print-mini", "", {
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
    });
    expect(printMini).toMatch(/to divide/i);
  });
});

describe("formatActionCellHtml wrap-safe Action cells", () => {
  const NBSP = "\u00A0";

  it("glues a single-stitch decrease so the count can never wrap off (RC 079/081 regression)", () => {
    const html = formatActionCellHtml("Decrease 1 st");
    expect(html).toBe(`Decrease 1${NBSP}st`);
    // The number is always present, glued to its unit — never "Decrease  st" or "Decrease st".
    expect(html).toContain(`1${NBSP}st`);
    expect(html).not.toMatch(/Decrease\s+st\b/);
  });

  it("glues plural decreases as 'X sts' on one unit", () => {
    expect(formatActionCellHtml("Decrease 4 sts")).toBe(`Decrease 4${NBSP}sts`);
    expect(formatActionCellHtml("Decrease 12 sts")).toBe(`Decrease 12${NBSP}sts`);
  });

  it("keeps 'Bind off OR hold X sts' on one readable run (RC 080 stranded 'sts' regression)", () => {
    const html = formatActionCellHtml("Bind off OR hold 3 sts");
    expect(html).toBe(`Bind${NBSP}off${NBSP}OR${NBSP}hold 3${NBSP}sts`);
    // "sts" can never strand: it is glued to its count, and the verb phrase is intact.
    expect(html).toContain(`3${NBSP}sts`);
    expect(html).not.toMatch(/\d+ sts/); // no plain ASCII space between count and unit
  });

  it("glues a plain 'Bind off X sts' verb too", () => {
    expect(formatActionCellHtml("Bind off 5 sts")).toBe(`Bind${NBSP}off 5${NBSP}sts`);
  });

  it("escapes HTML and tolerates empty/odd input", () => {
    expect(formatActionCellHtml("Knit in pattern")).toBe("Knit in pattern");
    expect(formatActionCellHtml("")).toBe("");
    expect(formatActionCellHtml(undefined as unknown as string)).toBe("");
    expect(formatActionCellHtml("<b>Decrease 1 st</b>")).toBe(`&lt;b&gt;Decrease 1${NBSP}st&lt;/b&gt;`);
  });

  it("every built checklist Decrease/Bind off action renders its number in the HTML cell", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      r.frontNeckShoulderShapingChart,
      r.firstArmholeGarmentRc,
    );
    const rows = buildActiveSideInstructionTableRows(r.frontNeckShoulderShapingChart, rcStart);
    const shapingRows = rows.filter((row) => /^(Decrease|Bind off)/.test(row.action));
    expect(shapingRows.length).toBeGreaterThan(0);
    for (const row of shapingRows) {
      const cell = formatActionCellHtml(row.action);
      // Number is present and glued to its unit; unit never separated by a plain ASCII space.
      expect(cell).toMatch(new RegExp(`\\d+${NBSP}sts?\\b`));
      expect(cell).not.toMatch(/\d+ sts?\b/u);
    }
  });
});

describe("plainKnitSpanCarriageEdgeDisplay invertCarriageParity", () => {
  it("uses odd Right / even Left when invertCarriageParity is true", () => {
    expect(plainKnitSpanCarriageEdgeDisplay(29, 29, { invertCarriageParity: true }).carriage).toBe("Right");
    expect(plainKnitSpanCarriageEdgeDisplay(30, 30, { invertCarriageParity: true }).carriage).toBe("Left");
  });
});

describe("second shoulder checklist carriage", () => {
  it("assigns carriage from RC parity only (not from prior active-shoulder carriage strings)", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: "Right",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: "Armhole",
        stitchesRemaining: 12,
      };
    });
    const second = buildSecondShoulderInstructionTableRows(active);
    expectStrictAlternatingCarriage(expandChecklistRowsByRc(second), 29, 43);
  });

  it("never has consecutive RC with the same carriage after compaction", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc);
    const active = buildActiveSideInstructionTableRows(chart, rcStart);
    const second = compactActiveSideInstructionRowsForPrint(
      buildSecondShoulderInstructionTableRows(active),
      { invertCarriageParity: true },
    );
    const byRc = expandChecklistRowsByRc(second);
    const rcs = [...byRc.keys()].sort((a, b) => a - b);
    expect(rcs.length).toBeGreaterThan(2);
    for (let i = 1; i < rcs.length; i++) {
      expect(byRc.get(rcs[i - 1]!)).not.toBe(byRc.get(rcs[i]!));
    }
  });

  it("RC 029–043 alternates Right, Left, Right, … (regression)", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: rc % 2 === 0 ? "Right" : "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: rc % 2 === 0 ? "Armhole" : "Neck",
        stitchesRemaining: 8,
      };
    });
    const secondCompact = compactActiveSideInstructionRowsForPrint(
      buildSecondShoulderInstructionTableRows(active),
      { invertCarriageParity: true },
    );
    expectStrictAlternatingCarriage(expandChecklistRowsByRc(secondCompact), 29, 43);
    const labels = secondCompact.map((r) => r.carriagePosition);
    expect(labels.every((c) => c === "Right" || c === "Left" || c === "Alternating Left/Right")).toBe(
      true,
    );
    expect(labels.filter((c) => c === "Right").length).toBeLessThan(labels.length);
  });

  it("rendered second-shoulder HTML alternates carriage for RC 029–043", () => {
    const active = Array.from({ length: 15 }, (_, i) => {
      const rc = 29 + i;
      return {
        rc,
        carriagePosition: rc % 2 === 0 ? "Right" : "Left",
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge: rc % 2 === 0 ? "Armhole" : "Neck",
        stitchesRemaining: 8,
      };
    });
    const chart = {
      columnKeys: [
        "row",
        "action",
        "leftSide",
        "leftNeck",
        "centerNeck",
        "rightNeck",
        "rightSide",
        "leftStitchCount",
        "rightStitchCount",
      ] as const,
      rows: [
        {
          row: 28,
          action: "Neck",
          leftSide: "-",
          leftNeck: "-",
          centerNeck: "-4",
          rightNeck: "-",
          rightSide: "-",
          leftStitchCount: 20,
          rightStitchCount: 20,
        },
        ...active.map((row) => ({
          row: row.rc,
          action: "Shoulder / Neck",
          leftSide: "-",
          leftNeck: "-1",
          centerNeck: "-",
          rightNeck: "-1",
          rightSide: "-",
          leftStitchCount: row.stitchesRemaining,
          rightStitchCount: row.stitchesRemaining,
        })),
      ],
    };
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-second-shoulder", undefined, {
      activeSideOnly: true,
      activeSideRcStart: 29,
    });
    expectStrictAlternatingCarriage(parseSecondShoulderChecklistFromHtml(html), 29, 43);
  });
});
