import { describe, expect, it } from "vitest";
import { NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL, plainKnitSpanCarriageEdgeDisplay } from "./neckShoulderShapingChart";
import {
  applyNeckShoulderShoulderTabSelection,
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  compactActiveSideInstructionRowsForPrint,
  formatActionCellHtml,
  isSleevelessPulloverVNeckFrontChart,
  neckShoulderChartHasCarriagePositionColumn,
  NS_SHOULDER_PANEL_ATTR,
  NS_SHOULDER_TABS_ROOT_ATTR,
  renderActiveShoulderChartIntroHtml,
  renderCarriagePositionPatternTipHtml,
  renderNecklineInstructionsWithNotationPreviewHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
  resolveJapaneseNotationQuickReferencePreviewSrc,
  SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC,
  DROP_SHOULDER_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC,
} from "./neckShoulderShapingChartHtml";
import { buildHeldSideInstructionTableRows } from "./neckShoulderActiveSideChecklist";
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
    expect(html).toContain(
      'class="ns-shaping-chart__th-row">RC <span class="ns-shaping-chart__row-counter-side">(carriage side)</span></th>',
    );
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

  it("V-neck front overlap: divide/setup row is present; hiding it leaves real shaping first", () => {
    const r = generateSleevelessBackPattern(vNeckPattern());
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.debug.armholeStartRow, {
      includeCenterNecklineSetupRow: true,
    });
    const builtRows = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(r.debug.frontArmholeNecklineOverlap).toBeDefined();
    expect(builtRows.some((row) => row.edge === "Center")).toBe(true);
    expect(builtRows.find((row) => row.edge === "Center")?.action).toMatch(/Divide at center/i);

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
    expect(printMini).toMatch(/Place center \d+ neckline stitches in hold/i);
  });
});

describe("front round-neck First/Second Shoulder setup row presentation", () => {
  function firstChecklistTbody(html: string): string {
    return html.match(/First Shoulder Checklist[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  }

  function secondChecklistTbody(html: string): string {
    return html.match(/Second Shoulder Checklist[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? "";
  }

  it("sleeveless: First keeps divide once; Second returns to held shoulder; Sts Remaining is needles in work", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const built = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const setup = built.find((row) => row.edge === "Center");
    expect(setup).toBeDefined();
    const y = setup!.stitchesRemaining;

    // Matches sleeveless front online options: setup row kept visible in both checklists.
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-sleeveless-front-setup", undefined, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: false,
      tableHeading: "First Shoulder Checklist",
    });

    const firstTbody = firstChecklistTbody(html);
    const secondTbody = secondChecklistTbody(html);
    expect(firstTbody).toMatch(/Scrap off center \d+ neckline/);
    expect(firstTbody).toContain(`${y} needles in work`);
    expect(firstTbody).not.toMatch(/\d+\s+total\s*\/\s*\d+\s+active/);
    expect(secondTbody).toContain(`Return to the held shoulder with ${y} needles in work.`);
    expect(secondTbody).toContain(`${y} needles in work`);
    expect(secondTbody).not.toMatch(/Scrap off center|to divide/i);
    expect(secondTbody).not.toMatch(/\d+\s+total\s*\/\s*\d+\s+active/);
  });
});

describe("shoulder checklist full-width collapsible layout", () => {
  it("renders First and Second Shoulder checklists as separate full-width disclosures", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-layout", undefined, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
      tableHeading: "First Shoulder Checklist",
    });

    expect(html).toContain('class="ns-shaping-chart ns-shaping-chart--collapsible"');
    expect(html).toContain("ns-shaping-chart__disclosure-header");
    expect(html).toContain("ns-shaping-chart__disclosure-chevron");
    expect(html).toContain("data-chart-print-slot");
    expect(html).toContain("ns-shaping-chart__checklist-inner");
    expect(html).toContain("data-checklist-print-lead");
    expect(html).toContain("ns-shaping-chart__print-lead-heading");
    expect(html).toContain("ns-shaping-chart--second-shoulder");
    expect(html).toContain("data-second-shoulder-content");
    expect(html).not.toContain("ns-shaping-chart__preview-title");
    expect(html.match(/ns-shaping-chart--collapsible/g)?.length).toBe(2);
    expect(html.indexOf("First Shoulder Checklist")).toBeLessThan(
      html.indexOf("Second Shoulder Checklist"),
    );
    const firstPrintLead = html.indexOf('data-checklist-print-lead');
    const firstTable = html.indexOf("ns-shaping-chart__table--checklist");
    expect(firstPrintLead).toBeGreaterThan(-1);
    expect(firstPrintLead).toBeLessThan(firstTable);
    const firstClose = html.indexOf("</details>");
    const secondOpen = html.indexOf("ns-shaping-chart--second-shoulder");
    expect(secondOpen).toBeGreaterThan(firstClose);
  });

  it("defaults to collapsible layout for shoulder checklist headings without an explicit flag", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const chart = r.neckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
      includeCenterNecklineSetupRow: true,
    });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, "test-back-layout", undefined, {
      activeSideOnly: true,
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
      tableHeading: "First Shoulder Checklist",
    });
    expect(html).toContain("<details");
    expect(html).toContain("First Shoulder Checklist");
    expect(html).toContain("Second Shoulder Checklist");
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

describe("Japanese Notation Quick Reference preview (renderActiveShoulderChartIntroHtml)", () => {
  const baseOpts = {
    wrapperClass: "pattern-shaping-intro",
    layout: "labeled" as const,
    localStartRcLabel: "RC:050",
    centerBindOffStitches: 6,
    includeWorkflowSteps: true,
  };

  it("omits the preview card by default (print/PDF unaffected)", () => {
    const html = renderActiveShoulderChartIntroHtml(baseOpts);
    expect(html).not.toContain("ns-jp-preview");
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
    expect(html).not.toContain("ns-shaping-intro--with-preview");
  });

  it("renders the front preview card wired to the front piece", () => {
    const html = renderActiveShoulderChartIntroHtml({ ...baseOpts, notationPreview: "front" });
    expect(html).toContain("ns-shaping-intro--with-preview");
    expect(html).toContain('data-neckline-notation-preview-trigger="front"');
    expect(html).toContain("diagram-jp-front-preview.svg");
    expect(html).toContain("Japanese Notation Quick Reference");
    expect(html).toContain("Click to enlarge");
    // Keyboard-accessible button + aria label + magnifying-glass overlay + excluded from print.
    expect(html).toMatch(/<button[^>]*data-neckline-notation-preview-trigger="front"/);
    expect(html).toContain('aria-label="Open Japanese notation quick reference"');
    expect(html).toContain("fa-magnifying-glass");
    expect(html).toContain('class="ns-jp-preview no-print"');
    // Existing instructions still present alongside the preview.
    expect(html).toContain("Before Shaping");
    expect(html).toContain("Divide the Neckline");
  });

  it("renders the back preview card wired to the back piece (back asset, not front)", () => {
    const html = renderActiveShoulderChartIntroHtml({ ...baseOpts, notationPreview: "back" });
    expect(html).toContain("ns-shaping-intro--with-preview");
    expect(html).toContain('data-neckline-notation-preview-trigger="back"');
    expect(html).toContain("diagram-jp-back-preview.svg");
    expect(html).not.toContain("diagram-jp-front-preview.svg");
    expect(html).toContain('aria-label="Open Japanese notation quick reference"');
    expect(html).toContain("fa-magnifying-glass");
    expect(html).toContain('class="ns-jp-preview no-print"');
  });
});

describe("resolveJapaneseNotationQuickReferencePreviewSrc", () => {
  it("resolves sleeveless back and front preview assets by default", () => {
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("back")).toBe(
      SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC.back,
    );
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("front")).toBe(
      SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC.front,
    );
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("back", "sleeveless")).toContain(
      "/sleeveless/diagrams/diagram-jp-back-preview.svg",
    );
  });

  it("resolves drop-shoulder back and front preview assets when construction is drop-shoulder", () => {
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("back", "drop-shoulder")).toBe(
      DROP_SHOULDER_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC.back,
    );
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("front", "drop-shoulder")).toBe(
      DROP_SHOULDER_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC.front,
    );
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("back", "drop-shoulder")).toContain(
      "/drop-shoulder/jp-drop-body-back-preview.svg",
    );
    expect(resolveJapaneseNotationQuickReferencePreviewSrc("front", "drop-shoulder")).toContain(
      "/drop-shoulder/jp-drop-body-front-preview.svg",
    );
  });
});

describe("renderNecklineInstructionsWithNotationPreviewHtml (drop shoulder)", () => {
  it("places instructions in the left column and preview in the right sidebar column", () => {
    const html = renderNecklineInstructionsWithNotationPreviewHtml(
      '<div class="sleeveless-pattern-row">Bind off shoulders.</div>',
      "back",
      "drop-shoulder",
    );
    expect(html).toContain("sleeveless-neckline-preview-split");
    expect(html).toContain("pattern-layout__content");
    expect(html).toContain("pattern-layout__sidebar");
    expect(html).toContain("sleeveless-pattern-instructions");
    expect(html).not.toContain("ns-shaping-intro--with-preview");
    expect(html).not.toContain("ns-shaping-intro__main");
    expect(html).toContain("jp-drop-body-back-preview.svg");
    expect(html).not.toContain("diagram-jp-back-preview.svg");
    expect(html).toContain('data-neckline-notation-preview-trigger="back"');
    expect(html).toContain("Bind off shoulders.");
    const contentIdx = html.indexOf("pattern-layout__content");
    const sidebarIdx = html.indexOf("pattern-layout__sidebar");
    const previewIdx = html.indexOf("ns-jp-preview");
    expect(contentIdx).toBeGreaterThan(-1);
    expect(sidebarIdx).toBeGreaterThan(contentIdx);
    expect(previewIdx).toBeGreaterThan(sidebarIdx);
    expect(html.indexOf("Bind off shoulders.")).toBeLessThan(sidebarIdx);
  });

  it("uses front drop-shoulder preview asset for front piece", () => {
    const html = renderNecklineInstructionsWithNotationPreviewHtml(
      "<p>Front neck bind-off.</p>",
      "front",
      "drop-shoulder",
    );
    expect(html).toContain("jp-drop-body-front-preview.svg");
    expect(html).toContain('data-neckline-notation-preview-trigger="front"');
    expect(html).toContain("pattern-layout__sidebar");
  });
});

describe("sleeveless pullover V-neck Front shoulder tabs", () => {
  function shallowVNeckPattern(): Record<string, unknown> {
    return {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 39,
          back_neck_to_hem: 18,
          armhole_depth: 8,
          neck_opening: 6,
          shoulder_width: 12,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "v-neck" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
  }

  function overlapVNeckPattern(): Record<string, unknown> {
    return {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 39,
          back_neck_to_hem: 18,
          armhole_depth: 8,
          neck_opening: 6,
          shoulder_width: 12,
          front_neck_depth: 6.86,
          back_neck_depth: 1,
        },
      },
      style: { recipientCategory: "misses", neckline: "v-neck" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 4,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
  }

  function renderFrontTabs(pattern: Record<string, unknown>) {
    const r = generateSleevelessBackPattern(pattern);
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.debug.armholeStartRow, {
      includeCenterNecklineSetupRow: true,
    });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      chart,
      "ns-shaping-chart-front",
      undefined,
      {
        activeSideOnly: true,
        activeSideRcStart: rcStart,
        includeCenterNecklineSetupRow: true,
        hideCenterNecklineSetupRow: false,
        tableHeading: "First Shoulder Checklist",
        shoulderTabs: true,
        collapsible: false,
      },
    );
    return { r, chart, rcStart, html };
  }

  it("is scoped to sleeveless pullover V-neck Front charts only", () => {
    const vNeck = generateSleevelessBackPattern(shallowVNeckPattern());
    const round = generateSleevelessBackPattern(baseRoundNeckPattern());
    expect(isSleevelessPulloverVNeckFrontChart(vNeck.frontNeckShoulderShapingChart)).toBe(true);
    expect(isSleevelessPulloverVNeckFrontChart(vNeck.neckShoulderShapingChart)).toBe(false);
    expect(isSleevelessPulloverVNeckFrontChart(round.frontNeckShoulderShapingChart)).toBe(false);
  });

  it("renders both tables as tabs: First selected, Second mounted but inactive", () => {
    const { html } = renderFrontTabs(shallowVNeckPattern());
    expect(html).toContain(NS_SHOULDER_TABS_ROOT_ATTR);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('aria-controls="ns-shaping-chart-front-panel-first"');
    expect(html).toContain('aria-controls="ns-shaping-chart-front-panel-second"');
    expect(html).toContain('>First Shoulder<');
    expect(html).toContain('>Second Shoulder<');
    expect(html).toContain(`data-chart-id="ns-shaping-chart-front-primary"`);
    expect(html).toContain(`data-chart-id="ns-shaping-chart-front-secondary"`);
    expect(html).toMatch(new RegExp(`${NS_SHOULDER_PANEL_ATTR}="first"(?! hidden)`));
    expect(html).toContain(`${NS_SHOULDER_PANEL_ATTR}="second"`);
    expect(html).toMatch(new RegExp(`id="ns-shaping-chart-front-panel-second"[^>]*\\shidden`));
    expect(html).not.toContain("ns-shaping-chart--collapsible");
    expect(html).not.toContain("<details class=\"ns-shaping-chart");
    expect(html).not.toContain("Show second shoulder checklist");
    expect(html).not.toContain("Want less mental reversing");
    expect(html).toContain("FIRST SHOULDER");
    expect(html).toContain("SECOND SHOULDER");
    expect(html.indexOf("FIRST SHOULDER")).toBeLessThan(html.indexOf("SECOND SHOULDER"));
  });

  it("does not convert Back or round Front to tabs unless shoulderTabs is set", () => {
    const r = generateSleevelessBackPattern(baseRoundNeckPattern());
    const back = renderNeckShoulderShapingChartTableOnlyHtml(
      r.neckShoulderShapingChart,
      "ns-shaping-chart-back",
      undefined,
      {
        activeSideOnly: true,
        tableHeading: "First Shoulder Checklist",
        collapsible: true,
      },
    );
    expect(back).not.toContain(NS_SHOULDER_TABS_ROOT_ATTR);
    expect(back).toContain("Show second shoulder checklist");
    expect(back).toContain("<details");
  });

  it("switching tabs only changes visibility attributes and keeps progress ids", () => {
    const { html } = renderFrontTabs(shallowVNeckPattern());
    const firstId = "ns-shaping-chart-front-panel-first";
    const secondId = "ns-shaping-chart-front-panel-second";
    const attrs = (initial: Record<string, string>) => {
      const map = new Map(Object.entries(initial));
      return {
        setAttribute(name: string, value: string) {
          map.set(name, value);
        },
        getAttribute(name: string) {
          return map.get(name) ?? null;
        },
        removeAttribute(name: string) {
          map.delete(name);
        },
        tabIndex: initial.tabIndex !== undefined ? Number(initial.tabIndex) : 0,
        get ariaSelected() {
          return map.get("aria-selected");
        },
      };
    };
    const firstTab = Object.assign(attrs({ "aria-selected": "true", "aria-controls": firstId, tabIndex: "0" }), {
      tabIndex: 0,
    });
    const secondTab = Object.assign(attrs({ "aria-selected": "false", "aria-controls": secondId, tabIndex: "-1" }), {
      tabIndex: -1,
    });
    const firstPanel = {
      id: firstId,
      hidden: false,
      setAttribute() {},
      removeAttribute() {},
    };
    const secondPanel = {
      id: secondId,
      hidden: true,
      setAttribute() {},
      removeAttribute() {},
    };
    applyNeckShoulderShoulderTabSelection([firstTab, secondTab], [firstPanel, secondPanel], secondTab);
    expect(firstTab.getAttribute("aria-selected")).toBe("false");
    expect(secondTab.getAttribute("aria-selected")).toBe("true");
    expect(firstPanel.hidden).toBe(true);
    expect(secondPanel.hidden).toBe(false);
    expect(html).toContain(`data-chart-id="ns-shaping-chart-front-primary"`);
    expect(html).toContain(`data-chart-id="ns-shaping-chart-front-secondary"`);
  });

  it("print/PDF includes FIRST then SECOND SHOULDER even without selecting the second tab", () => {
    const { chart, rcStart } = renderFrontTabs(shallowVNeckPattern());
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(chart, "ns-print-front", "", {
      activeSideRcStart: rcStart,
      includeCenterNecklineSetupRow: true,
      showSecondShoulderChecklist: true,
      sequentialShoulderHeadings: true,
    });
    expect(printHtml).toContain("FIRST SHOULDER");
    expect(printHtml).toContain("SECOND SHOULDER");
    expect(printHtml.indexOf("FIRST SHOULDER")).toBeLessThan(printHtml.indexOf("SECOND SHOULDER"));
    expect(printHtml).not.toContain("Want less mental reversing");
    expect(printHtml).not.toContain('role="tablist"');
    expect(printHtml.match(/<tbody>/g)?.length).toBe(2);
  });

  it("overlap Second Shoulder still uses the parked held-side count", () => {
    const { r, chart, rcStart, html } = renderFrontTabs(overlapVNeckPattern());
    expect(chart.frontVNeckArmholeComposition).toBeDefined();
    const held = buildHeldSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const parked = held.find((row) => row.edge === "Center")?.stitchesRemaining;
    expect(parked).toBeDefined();
    expect(html).toContain(`Return to the held shoulder with ${parked} needles in work.`);
    expect(held[0]?.stitchesRemaining).toBe(parked);
    const first = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(first.find((row) => row.edge === "Center")?.stitchesRemaining).toBeDefined();
    expect(r.debug.frontArmholeNecklineOverlap).toBeDefined();
  });
});
