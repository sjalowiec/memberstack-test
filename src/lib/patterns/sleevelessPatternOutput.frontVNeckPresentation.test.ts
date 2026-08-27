import { describe, expect, it } from "vitest";
import {
  FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES,
  FRONT_VNECK_HANDOFF_AFTER_ARMHOLE,
  FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE,
  FRONT_VNECK_HANDOFF_DURING_ARMHOLE,
  FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST,
  FRONT_VNECK_HANDOFF_WITH_ARMHOLE,
  resolveFrontVNeckRowCounterDisplayPolicy,
  sleevelessFrontVNeckWrittenPathPresentation,
  sleevelessPulloverVNeckBeginDisplayRc,
} from "./frontArmholeNecklineComposition";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildHeldSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import {
  isSleevelessPulloverVNeckFrontChart,
  NS_SHOULDER_TABS_ROOT_ATTR,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { RESET_ROW_COUNTER_TEXT } from "./rowCounterReset";
import {
  FRONT_VNECK_HANDOFF_ARMHOLE_JOINS,
  FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT,
} from "./sleevelessFrontVNeckWrittenSummary";
import {
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

function amandaVNeckPattern(): Record<string, unknown> {
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

function sameStartVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 8.86,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

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

/** Equal 10"/10" depths, 102-stitch Front — the `-1` must not create a before-armhole divide. */
function equalDepthVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 10,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 10,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function vNeckBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 11,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function asCardigan(pattern: Record<string, unknown>): Record<string, unknown> {
  const style = (pattern.style ?? {}) as Record<string, unknown>;
  return {
    ...pattern,
    style: { ...style, garmentStyle: "cardigan", frontStyle: "open" },
  };
}

function collectParagraphs(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (row.kind === "block") {
      out.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
    }
  }
  return out;
}

function sectionTitles(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  return rows.filter((row) => row.kind === "section").map((row) => row.title);
}

function bodyKnitToTarget(rows: readonly SleevelessPatternDisplayRow[]): number | undefined {
  let inBody = false;
  let target: number | undefined;
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") inBody = true;
    else if (row.kind === "section") inBody = false;
    if (!inBody || row.kind !== "block") continue;
    for (const p of row.paragraphs) {
      const m = p
        .trim()
        .match(/^Knit (?:to RC:?\s*|in pattern to RC:?\s*|(?:\d+ rows?(?: even)? to RC:?\s*))(\d{1,4})\.\s*$/i);
      if (m) target = parseInt(m[1], 10);
    }
  }
  return target;
}

function armholeBlocks(rows: readonly SleevelessPatternDisplayRow[]) {
  let inArmhole = false;
  const out: Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] = [];
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

function knitToTargetsInSection(
  rows: readonly SleevelessPatternDisplayRow[],
  sectionTitle: string,
): number[] {
  const out: number[] = [];
  let inSection = false;
  for (const row of rows) {
    if (row.kind === "section") {
      inSection = row.title === sectionTitle;
      continue;
    }
    if (!inSection || row.kind !== "block") continue;
    for (const p of row.paragraphs) {
      const m = p
        .trim()
        .match(
          /Knit (?:in pattern to |to )(?:Armhole )?RC:?\s*(\d{1,4})/i,
        );
      if (m) out.push(parseInt(m[1], 10));
    }
  }
  return out;
}

function firstShoulderRows(r: ReturnType<typeof generateSleevelessBackPattern>) {
  const chart = r.frontNeckShoulderShapingChart;
  const armholeStart = r.debug.armholeStartRow!;
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, {
    includeCenterNecklineSetupRow: true,
  });
  return buildActiveSideInstructionTableRows(chart, rcStart, {
    includeCenterNecklineSetupRow: true,
  });
}

function writtenPathText(r: ReturnType<typeof generateSleevelessBackPattern>): string {
  const paras = collectParagraphs(r.frontDisplayRows);
  const actions = firstShoulderRows(r).map((row) => row.action);
  return [...paras, ...actions].join("\n");
}

function textLayer(r: ReturnType<typeof generateSleevelessBackPattern>): string {
  return collectParagraphs(r.frontDisplayRows).join("\n");
}

describe("sleeveless Front V-neck written presentation — Case 1 after armhole", () => {
  const r = generateSleevelessBackPattern(shallowVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;

  it("keeps the conventional Body → Armhole → Neckline flow", () => {
    expect(r.debug.frontArmholeNecklineOverlap).toBeUndefined();
    expect(r.debug.frontVNeckShapingTimingCase).toBe("after-armhole");
    expect(sectionTitles(r.frontDisplayRows)).toEqual(
      expect.arrayContaining(["BODY", "ARMHOLE", "FRONT NECKLINE & SHOULDERS"]),
    );
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
    const armhole = armholeBlocks(r.frontDisplayRows);
    expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
    expect(armhole.some((b) => b.paragraphs.some((p) => /Bind off OR hold/i.test(p)))).toBe(true);
    expect(armhole.some((b) => b.stitchCount === r.debug.stitchesAfterArmhole)).toBe(true);
    const neckLocal = r.debug.frontNecklineStartLocalRC!;
    const shoulderLocal = r.debug.backNecklineStartLocalRC ?? r.debug.frontNecklineShapingBeginLocalRC;
    expect(neckLocal).toBeGreaterThan(0);
    expect(shoulderLocal).toBeGreaterThan(neckLocal);
    const armholeKnitTo = knitToTargetsInSection(r.frontDisplayRows, "ARMHOLE");
    expect(armholeKnitTo.length).toBeGreaterThan(0);
    expect(Math.max(...armholeKnitTo)).toBe(neckLocal);
    expect(armholeKnitTo.some((t) => t > neckLocal)).toBe(false);
    expect(armholeKnitTo).not.toContain(shoulderLocal);
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras.some((p) => /row counter was reset at the beginning of armhole shaping/i.test(p))).toBe(
      false,
    );
    expect(paras.some((p) => /Front neckline \(V-neck\) shaping begins at Armhole RC/i.test(p))).toBe(
      false,
    );
    expect(paras.some((p) => /Armhole RC/i.test(p))).toBe(false);
    expect(paras).toContain(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE);
    expect(paras.some((p) => p.includes(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST))).toBe(true);
    expect(paras.some((p) => /Divide the Front at center/i.test(p))).toBe(true);
    expect(paras.some((p) => /at the same time/i.test(p))).toBe(false);
    expect(paras.some((p) => /Bind off OR hold/i.test(p))).toBe(true);
    expect(paras.some((p) => /Decrease 1 stitch at each armhole edge every other row/i.test(p))).toBe(
      true,
    );
    const beginBlock = armhole.find((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE));
    expect(beginBlock?.rc).toMatch(new RegExp(`RC:\\s*${String(neckLocal).padStart(3, "0")}`));
    expect(paras.some((p) => p === FRONT_VNECK_HANDOFF_DURING_ARMHOLE)).toBe(false);
    expect(paras.some((p) => p === FRONT_VNECK_HANDOFF_WITH_ARMHOLE)).toBe(false);
    expect(sleevelessFrontVNeckWrittenPathPresentation(r.debug.frontArmholeNecklineOverlap)).toEqual({
      timing: "after-armhole",
      checklistPrimary: false,
      checklistDefaultOpen: false,
      visualGuidesAfterChecklist: false,
    });
    expect(resolveFrontVNeckRowCounterDisplayPolicy(r.debug.frontArmholeNecklineOverlap)).toBe(
      "armhole-reset-first",
    );
  });

  it("uses the same divide RC for knit-to, Begin V-neck, Divide the Neckline, and First Shoulder setup", () => {
    const divideRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap: r.debug.frontArmholeNecklineOverlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });
    expect(divideRc).toBe(r.debug.frontNecklineStartLocalRC);
    expect(r.debug.frontNecklineCenterDivideLocalRC).toBe(divideRc);
    expect(r.debug.frontNecklineShapingBeginLocalRC).toBeGreaterThan(divideRc!);
    expect(Math.max(...knitToTargetsInSection(r.frontDisplayRows, "ARMHOLE"))).toBe(divideRc);
    const beginBlock = armholeBlocks(r.frontDisplayRows).find((b) =>
      b.paragraphs.includes(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE),
    );
    expect(beginBlock?.rc).toMatch(new RegExp(`RC:\\s*${String(divideRc).padStart(3, "0")}`));
    const first = firstShoulderRows(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup?.rc).toBe(divideRc);
    expect(setup?.action).toMatch(/Divide at center/i);
    const firstNeckDec = first.find(
      (row) => row.edge === "Neck" && /Decrease/i.test(row.action),
    );
    expect(firstNeckDec?.rc).toBe(r.debug.frontNecklineShapingBeginLocalRC);
    expect(firstNeckDec?.rc).not.toBe(divideRc);
    const label = `RC:${String(divideRc).padStart(3, "0")}`;
    const intro = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: label,
      chart: r.frontNeckShoulderShapingChart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
      includeWorkflowSteps: true,
    });
    expect(intro).toContain("Divide the Neckline");
    expect(intro).toContain(`At RC ${String(divideRc).padStart(3, "0")}, divide the piece at the center`);
    expect(intro).not.toContain("Before Shaping");
    expect(intro).not.toContain("Knit until Armhole RC");
    expect(intro).not.toContain(
      `At RC ${String(r.debug.frontNecklineShapingBeginLocalRC).padStart(3, "0")}, divide`,
    );
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      r.frontNeckShoulderShapingChart,
      "ns-print-front",
      intro,
      {
        activeSideRcStart: armholeLocalRcActiveShoulderChecklistStart(
          r.frontNeckShoulderShapingChart,
          r.debug.armholeStartRow,
          { includeCenterNecklineSetupRow: true },
        ),
        includeCenterNecklineSetupRow: true,
        showSecondShoulderChecklist: true,
        sequentialShoulderHeadings: true,
      },
    );
    expect(printHtml).toContain(`At RC ${String(divideRc).padStart(3, "0")}, divide the piece at the center`);
    expect(printHtml).not.toContain("Before Shaping");
  });
});

describe("sleeveless Front V-neck written presentation — Case 2 during armhole (Amanda)", () => {
  const r = generateSleevelessBackPattern(amandaVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap!;

  it("announces V-neck at the divide after armhole-only steps, without finished B", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("during-armhole");
    expect(overlap.divideGarmentRc - armholeStart).toBe(7);
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
    const armhole = armholeBlocks(r.frontDisplayRows);
    expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
    expect(armhole.some((b) => b.paragraphs.some((p) => /Bind off OR hold/i.test(p)))).toBe(true);
    expect(armhole.some((b) => b.paragraphs.some((p) => /Decrease on rows: 2 - 4 - 6/.test(p)))).toBe(
      true,
    );
    expect(armhole.some((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE))).toBe(true);
    const divideLocal = overlap.divideGarmentRc - armholeStart;
    const beginBlock = armhole.find((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE));
    expect(beginBlock?.rc).toMatch(new RegExp(`RC:\\s*${String(divideLocal).padStart(3, "0")}`));
    expect(knitToTargetsInSection(r.frontDisplayRows, "ARMHOLE").every((t) => t <= divideLocal)).toBe(
      true,
    );
    expect(armhole.some((b) => b.stitchCount === r.debug.stitchesAfterArmhole)).toBe(false);
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras.some((p) => /Front neckline \(V-neck\) shaping begins at Armhole RC/i.test(p))).toBe(
      false,
    );
    expect(paras.filter((p) => /Use the checklist below/i.test(p))).toHaveLength(0);
    const first = firstShoulderRows(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup?.rc).toBe(overlap.divideGarmentRc - armholeStart);
    expect(first.some((row) => row.edge === "Armhole" && row.rc === 8)).toBe(true);
    expect(sleevelessFrontVNeckWrittenPathPresentation(overlap).visualGuidesAfterChecklist).toBe(
      true,
    );
    expect(sleevelessFrontVNeckWrittenPathPresentation(overlap).checklistDefaultOpen).toBe(true);
    expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("armhole-reset-first");
  });

  it("keeps required shaping actions on the written/checklist path", () => {
    const text = writtenPathText(r);
    expect(text).toMatch(/Bind off OR hold/i);
    expect(text).toMatch(/Decrease 1 stitch/i);
    expect(text).toMatch(/Divide at center|28 stitches on each side/i);
    expect(text).toContain(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE);
    expect(text).not.toMatch(/ns-visual-guides/);
  });

  it("keeps remaining armhole and V-neck setup in the text layer, not only the checklist", () => {
    const text = textLayer(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE);
    expect(text).toMatch(/Decrease 1 stitch at each armhole edge every other row/i);
    expect(text).toMatch(/Decrease 1 stitch at the armhole edge every other row, 4 more times/i);
    expect(text).toMatch(/more times, on rows/);
    expect(text).toMatch(/Divide the Front at center: 28 stitches each side/i);
    expect(text).toMatch(/at the same time/);
    expect(text).not.toMatch(/inside edge|outside edge/);
    expect(text).not.toMatch(/First Shoulder|Second Shoulder/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    const beginBlock = armholeBlocks(r.frontDisplayRows).find((b) =>
      b.paragraphs.includes(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE),
    );
    const beginText = beginBlock?.paragraphs.join("\n") ?? "";
    expect(beginText).toMatch(/more times, on rows/);
    expect(beginText).not.toMatch(/bind off or hold/i);
    expect(beginText).not.toMatch(/Decrease on rows: 2 - 4 - 6/);
    expect(text).not.toMatch(/^Begin V-neck shaping\. Continue the armhole shaping at the outside edge\.\s*$/);
  });
});

describe("sleeveless Front V-neck written presentation — Case 3 both begin together", () => {
  const r = generateSleevelessBackPattern(sameStartVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;

  it("resets at the shared start and says both systems begin", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("with-armhole");
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
    const armhole = armholeBlocks(r.frontDisplayRows);
    expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
    expect(armhole.some((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_WITH_ARMHOLE))).toBe(true);
    const beginBlock = armhole.find((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_WITH_ARMHOLE));
    expect(beginBlock?.rc).toMatch(/RC:\s*000/);
    expect(
      armhole.some((b) =>
        b.paragraphs.some((p) =>
          /Bind off OR hold \d+ stitches at the armhole edge \(carriage side\)/i.test(p),
        ),
      ),
    ).toBe(false);
    expect(collectParagraphs(r.frontDisplayRows).some((p) => /bind off OR hold/i.test(p))).toBe(true);
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras.some((p) => /begins at Armhole RC 001/i.test(p))).toBe(false);
    const first = firstShoulderRows(r);
    expect(first.find(isCenterNecklineSetupChecklistRow)?.rc).toBe(0);
    expect(first.some((row) => row.edge === "Armhole" && /Bind off/i.test(row.action))).toBe(true);
    expect(sleevelessFrontVNeckWrittenPathPresentation(r.debug.frontArmholeNecklineOverlap).checklistPrimary).toBe(
      true,
    );
  });

  it("keeps first combined actions on the written/checklist path", () => {
    const text = writtenPathText(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_WITH_ARMHOLE);
    expect(text).toMatch(/Bind off OR hold|Bind off/i);
    expect(text).toMatch(/51 stitches on each side/i);
  });

  it("text layer summarizes both systems after the shared begin line", () => {
    const text = textLayer(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_WITH_ARMHOLE);
    expect(text).toMatch(/Divide the Front at center: 51 stitches each side/i);
    expect(text).toMatch(/bind off or hold 4 stitches/i);
    expect(text).toMatch(/at the same time/);
    expect(text).not.toMatch(/Each side decreases/);
    expect(text).not.toMatch(/First Shoulder|Second Shoulder/);
    expect(text).not.toMatch(/inside edge|outside edge/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    expect(text.trim()).not.toBe(FRONT_VNECK_HANDOFF_WITH_ARMHOLE);
  });
});

describe("sleeveless Front V-neck equal armhole and neckline depth (10\"/10\")", () => {
  const r = generateSleevelessBackPattern(equalDepthVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap!;
  const first = firstShoulderRows(r);

  it("aligns the divide with the armhole start and classifies as with-armhole", () => {
    expect(r.debug.bustBodyStitches ?? r.debug.backStitches).toBe(102);
    expect(r.debug.armholeRows).toBe(70);
    expect(r.debug.frontNeckDepthRows).toBe(70);
    expect(r.debug.frontNecklineStartRC).toBe(armholeStart);
    expect(overlap.divideGarmentRc).toBe(armholeStart);
    expect(r.debug.frontVNeckShapingTimingCase).toBe("with-armhole");
    expect(overlap.necklineBeginsBeforeArmhole).toBe(false);
    const tl = [...(r.frontNeckShoulderTimeline ?? [])].sort((a, b) => a.row - b.row);
    const last = tl[tl.length - 1]!;
    const firstShoulder = tl.find(
      (e) =>
        e.row > armholeStart + 2 &&
        e.events.some((ev) => ev.edge === "outer" && ev.kind === "bindOff" && ev.amount > 0),
    );
    // Shoulder line stays at armholeStart + A. The extra before-armhole setup
    // row is gone; first shoulder stayed on the same RC (local 064) because
    // bind-offs are placed from the unchanged last row, not from the divide.
    expect(last.row).toBe(armholeStart + (r.debug.armholeRows ?? 0));
    expect(firstShoulder?.row).toBe(armholeStart + 64);
    expect(r.debug.stitchesAfterArmhole).toBe(88);
  });

  it("keeps BODY → ARMHOLE → shared RC 000 begin, not before-armhole routing", () => {
    expect(sectionTitles(r.frontDisplayRows)).toEqual(
      expect.arrayContaining(["BODY", "ARMHOLE", "FRONT NECKLINE & SHOULDERS"]),
    );
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
    const armhole = armholeBlocks(r.frontDisplayRows);
    expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
    expect(armhole.some((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_WITH_ARMHOLE))).toBe(true);
    const beginBlock = armhole.find((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_WITH_ARMHOLE));
    expect(beginBlock?.rc).toMatch(/RC:\s*000/);
    expect(collectParagraphs(r.frontDisplayRows)).not.toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
    expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("shared-reset");
  });

  it("text layer states both shaping systems after Begin V-neck and armhole shaping", () => {
    const text = textLayer(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_WITH_ARMHOLE);
    expect(text).toMatch(/Divide the Front at center: 51 stitches each side/i);
    expect(text).toMatch(/bind off or hold 4 stitches/i);
    expect(text).toMatch(/at the same time/);
    expect(text).not.toMatch(/Each side decreases/);
    expect(text).not.toMatch(/First Shoulder|Second Shoulder/);
    expect(text).not.toMatch(/inside edge|outside edge/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    expect(text.trim()).not.toBe(FRONT_VNECK_HANDOFF_WITH_ARMHOLE);
  });

  it("checklists divide and Armhole BO at RC 000; first Neck decrease stays on RC 001", () => {
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup?.rc).toBe(0);
    expect(setup?.action).toMatch(/51 stitches on each side/i);
    const armholeBo = first.filter(
      (row) => row.rc === 0 && row.edge === "Armhole" && /Bind off/i.test(row.action),
    );
    expect(armholeBo).toHaveLength(1);
    const neckDecs = first.filter((row) => row.edge === "Neck" && /Decrease/i.test(row.action));
    expect(neckDecs[0]?.rc).toBe(1);
    expect(neckDecs[0]?.rc).not.toBe(0);
    expect(r.debug.frontNecklineShapingBeginLocalRC).toBe(1);
    expect(first.filter((row) => isCenterNecklineSetupChecklistRow(row))).toHaveLength(1);
  });

  it("keeps both shoulders and print on the same divide RC", () => {
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, {
      includeCenterNecklineSetupRow: true,
    });
    const held = buildHeldSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const second = held.length
      ? held
      : buildSecondShoulderInstructionTableRows(first);
    expect(held.length).toBeGreaterThan(0);
    expect(second.find(isCenterNecklineSetupChecklistRow)?.rc).toBe(0);
    expect(first.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
    expect(second.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
    const label = "RC:000";
    const intro = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: label,
      chart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
      includeWorkflowSteps: true,
    });
    expect(intro).toContain("At RC 000, divide the piece at the center");
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      chart,
      "ns-print-equal-depth",
      intro,
      {
        activeSideRcStart: rcStart,
        includeCenterNecklineSetupRow: true,
        showSecondShoulderChecklist: true,
        sequentialShoulderHeadings: true,
      },
    );
    expect(printHtml).toContain("At RC 000, divide the piece at the center");
    expect(printHtml).toMatch(/FIRST SIDE|First Side/i);
    expect(printHtml).toMatch(/SECOND SIDE|Second Side/i);
    expect(printHtml).not.toMatch(/FIRST SHOULDER|First Shoulder/);
    expect(printHtml).not.toMatch(/SECOND SHOULDER|Second Shoulder/);
    expect(isSleevelessPulloverVNeckFrontChart(chart)).toBe(true);
  });
});

describe("sleeveless Front V-neck written presentation — Case 4 neckline before armhole", () => {
  const r = generateSleevelessBackPattern(vNeckBeforeArmholePattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap!;

  it("stops BODY at the divide garment RC and begins V-neck there", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
    expect(overlap.divideGarmentRc).toBeLessThan(armholeStart);
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(overlap.divideGarmentRc);
    expect(bodyKnitToTarget(r.frontDisplayRows)).not.toBe(armholeStart);
    expect(sectionTitles(r.frontDisplayRows)).toEqual(
      expect.arrayContaining(["BODY", "FRONT NECKLINE & SHOULDERS"]),
    );
    expect(sectionTitles(r.frontDisplayRows)).not.toContain("ARMHOLE");
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras).toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
    const beginBlock = r.frontDisplayRows.find(
      (row) =>
        row.kind === "block" && row.paragraphs.includes(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE),
    );
    expect(beginBlock && beginBlock.kind === "block" ? beginBlock.rc : undefined).toMatch(
      new RegExp(`RC:\\s*${String(overlap.divideGarmentRc).padStart(3, "0")}`),
    );
    expect(paras.some((p) => /begins at Armhole RC/i.test(p))).toBe(false);
    expect(
      paras.some((p) => /Bind off OR hold \d+ stitches at the armhole edge \(carriage side\)/i.test(p)),
    ).toBe(false);
  });

  it("keeps one continuous garment RC and does not reset at the armhole", () => {
    expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("continuous-garment-rc");
    const first = firstShoulderRows(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow)!;
    expect(setup.rc).toBe(overlap.divideGarmentRc);
    expect(setup.rc).not.toBe(0);
    expect(first.some((row) => row.rowCounterReset === true)).toBe(false);
    expect(collectParagraphs(r.frontDisplayRows).join("\n")).not.toMatch(RESET_ROW_COUNTER_TEXT);
    const armholeBo = first.find((row) => row.edge === "Armhole" && /Bind off/i.test(row.action));
    expect(armholeBo?.rc).toBe(armholeStart);
    expect(armholeBo?.rc).not.toBe(0);
    const armholeDecs = first.filter(
      (row) => row.edge === "Armhole" && /Decrease/i.test(row.action),
    );
    expect(armholeDecs.map((row) => row.rc)).toEqual(
      overlap.remainingDecreaseLocalRcs.map((local) => armholeStart + local),
    );
    const neckDecs = first.filter((row) => row.edge === "Neck" && /Decrease/i.test(row.action));
    expect(neckDecs[0]?.rc).toBe(overlap.divideGarmentRc + 1);
    expect(neckDecs.every((row) => row.rc !== 0)).toBe(true);
    expect(first.filter((row) => row.rc === 0)).toHaveLength(0);
    const rcsWithBoth = new Set(
      first.filter((row) => row.edge === "Neck").map((row) => row.rc),
    );
    for (const row of first.filter((row) => row.edge === "Armhole")) {
      if (rcsWithBoth.has(row.rc)) {
        expect(first.filter((x) => x.rc === row.rc).length).toBeGreaterThan(1);
      }
    }
  });

  it("keeps a continuous written path without Visual Guides", () => {
    const text = writtenPathText(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
    expect(text).toContain(FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES);
    expect(text).toMatch(/Bind off/i);
    expect(text).toMatch(/51 stitches each side|51 stitches on each side/i);
    expect(text).not.toMatch(/begins at Armhole RC 000/i);
    expect(text).not.toMatch(/begins at Armhole RC 001/i);
    expect(sleevelessFrontVNeckWrittenPathPresentation(overlap).visualGuidesAfterChecklist).toBe(true);
  });

  it("text layer gives V-neck setup now and simultaneous copy only when the armhole joins", () => {
    const beginBlock = r.frontDisplayRows.find(
      (row) =>
        row.kind === "block" && row.paragraphs.includes(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE),
    );
    const joinBlock = r.frontDisplayRows.find(
      (row) =>
        row.kind === "block" && row.paragraphs.includes(FRONT_VNECK_HANDOFF_ARMHOLE_JOINS),
    );
    const startText = beginBlock && beginBlock.kind === "block" ? beginBlock.paragraphs.join("\n") : "";
    const joinText = joinBlock && joinBlock.kind === "block" ? joinBlock.paragraphs.join("\n") : "";
    expect(startText).toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
    expect(startText).toMatch(/Divide the Front at center: 51 stitches each side/i);
    expect(startText).not.toMatch(/at the same time/);
    expect(startText).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    expect(joinBlock && joinBlock.kind === "block" ? joinBlock.rc : undefined).toMatch(
      new RegExp(`RC:\\s*${String(armholeStart).padStart(3, "0")}`),
    );
    expect(joinBlock && joinBlock.kind === "block" ? joinBlock.rc : undefined).not.toMatch(/RC:\s*000/);
    expect(joinText).toContain(FRONT_VNECK_HANDOFF_ARMHOLE_JOINS);
    expect(joinText).toContain(FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT);
    expect(joinText).toMatch(/bind off or hold 4 stitches/i);
    expect(sectionTitles(r.frontDisplayRows)).not.toContain("ARMHOLE");
  });

  it("uses the same continuous garment RCs on Second Side and in print", () => {
    const first = firstShoulderRows(r);
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, {
      includeCenterNecklineSetupRow: true,
    });
    const second = buildHeldSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    expect(second.some((row) => row.rowCounterReset === true)).toBe(false);
    expect(second.filter((row) => row.rc === 0)).toHaveLength(0);
    const firstArmhole = first.find((row) => row.edge === "Armhole" && /Bind off/i.test(row.action));
    const secondArmhole = second.find((row) => row.edge === "Armhole" && /Bind off/i.test(row.action));
    expect(firstArmhole?.rc).toBe(armholeStart);
    expect(secondArmhole?.rc).toBe(armholeStart + 1);
    const firstNeck = first.filter((row) => row.edge === "Neck" && /Decrease/i.test(row.action)).map((row) => row.rc);
    const secondNeck = second.filter((row) => row.edge === "Neck" && /Decrease/i.test(row.action)).map((row) => row.rc);
    expect(secondNeck).toEqual(firstNeck);
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      chart,
      "ns-print-case4",
      "",
      {
        activeSideRcStart: rcStart,
        includeCenterNecklineSetupRow: true,
        showSecondShoulderChecklist: true,
        sequentialShoulderHeadings: true,
      },
    );
    expect(printHtml).not.toContain(RESET_ROW_COUNTER_TEXT);
    expect(printHtml).toContain(String(overlap.divideGarmentRc).padStart(3, "0"));
    expect(printHtml).toContain(String(armholeStart).padStart(3, "0"));
    for (const local of overlap.remainingDecreaseLocalRcs) {
      expect(printHtml).toContain(String(armholeStart + local).padStart(3, "0"));
    }
  });
});

describe("sleeveless Front V-neck knit-to never skips the next shaping event", () => {
  it.each([
    ["Case 1 after armhole", shallowVNeckPattern()],
    ["Case 2 during armhole", amandaVNeckPattern()],
    ["Case 3 both begin", sameStartVNeckPattern()],
    ["equal 10/10 with-armhole", equalDepthVNeckPattern()],
    ["Case 4 before armhole", vNeckBeforeArmholePattern()],
  ] as const)("%s", (_label, pattern) => {
    const r = generateSleevelessBackPattern(pattern);
    const armholeStart = r.debug.armholeStartRow!;
    const neckStart = r.debug.frontNecklineStartRC;
    const neckLocal = r.debug.frontNecklineStartLocalRC;
    const bodyTargets = knitToTargetsInSection(r.frontDisplayRows, "BODY");
    if (neckStart < armholeStart) {
      expect(bodyTargets.every((t) => t <= neckStart)).toBe(true);
    } else {
      expect(bodyTargets.every((t) => t <= armholeStart)).toBe(true);
    }
    const armholeTargets = knitToTargetsInSection(r.frontDisplayRows, "ARMHOLE");
    if (neckLocal !== undefined && neckLocal > 0) {
      expect(armholeTargets.every((t) => t <= neckLocal)).toBe(true);
    }
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras.some((p) => /row counter was reset at the beginning of armhole shaping/i.test(p))).toBe(
      false,
    );
  });
});

describe("sleeveless Front V-neck text layer is complete without the checklist", () => {
  it.each([
    ["Case 1 after armhole", shallowVNeckPattern(), FRONT_VNECK_HANDOFF_AFTER_ARMHOLE],
    ["Case 2 during armhole", amandaVNeckPattern(), FRONT_VNECK_HANDOFF_AFTER_ARMHOLE],
    ["Case 3 both begin", sameStartVNeckPattern(), FRONT_VNECK_HANDOFF_WITH_ARMHOLE],
    ["equal 10/10 with-armhole", equalDepthVNeckPattern(), FRONT_VNECK_HANDOFF_WITH_ARMHOLE],
    ["Case 4 before armhole", vNeckBeforeArmholePattern(), FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE],
  ] as const)("%s", (label, pattern, beginLine) => {
    const r = generateSleevelessBackPattern(pattern);
    const text = textLayer(r);
    expect(text).toContain(beginLine);
    expect(text).toMatch(/Divide the Front at center/i);
    expect(text).not.toMatch(/neck \(inner\) edge/i);
    expect(text).not.toMatch(/First Shoulder|Second Shoulder/);
    expect(text).not.toMatch(/inside edge|outside edge/);
    expect(text).not.toMatch(/Each side decreases/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    expect(text).toMatch(/bind off or hold|bind off OR hold|Decrease 1 stitch at each armhole edge|Decrease 1 stitch at the armhole edge/i);
    if (label === "Case 1 after armhole") {
      expect(text).not.toMatch(/at the same time/);
    } else if (label !== "Case 4 before armhole") {
      expect(text).toMatch(/at the same time/);
    }
  });
});

describe("sleeveless Front V-neck written start and checklist divide share one event", () => {
  it.each([
    ["Case 1 after armhole", shallowVNeckPattern()],
    ["Case 2 during armhole", amandaVNeckPattern()],
    ["Case 3 both begin", sameStartVNeckPattern()],
    ["equal 10/10 with-armhole", equalDepthVNeckPattern()],
    ["Case 4 before armhole", vNeckBeforeArmholePattern()],
  ] as const)("%s", (_label, pattern) => {
    const r = generateSleevelessBackPattern(pattern);
    const divideRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap: r.debug.frontArmholeNecklineOverlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });
    expect(divideRc).toBeDefined();
    const first = firstShoulderRows(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup?.rc).toBe(divideRc);
    const begin = r.frontDisplayRows.find(
      (row) => row.kind === "block" && row.paragraphs.some((p) => /Begin V-neck/i.test(p)),
    );
    expect(begin && begin.kind === "block" ? begin.rc : undefined).toMatch(
      new RegExp(`RC:\\s*${String(divideRc).padStart(3, "0")}`),
    );
    const firstNeckDec = first.find((row) => row.edge === "Neck" && /Decrease/i.test(row.action));
    expect(firstNeckDec?.rc).toBe(r.debug.frontNecklineShapingBeginLocalRC);
    expect(firstNeckDec?.rc).not.toBe(divideRc);
    const label = `RC:${String(divideRc).padStart(3, "0")}`;
    const intro = renderActiveShoulderChartIntroHtml({
      localStartRcLabel: label,
      chart: r.frontNeckShoulderShapingChart,
      wrapperClass: "pattern-shaping-intro",
      layout: "labeled",
      includeWorkflowSteps: true,
    });
    expect(intro).toContain(`At RC ${String(divideRc).padStart(3, "0")}, divide the piece at the center`);
    expect(intro).not.toContain("Before Shaping");
    expect(intro).not.toContain("Knit until Armhole RC");
  });
});

describe("sleeveless Front V-neck Visual Guides remain available", () => {
  it("still renders the Visual Guides block", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      construction: "sleeveless",
    });
    expect(html).toContain("ns-visual-guides");
    expect(html).toContain("Shaping Notation");
    expect(RESET_ROW_COUNTER_TEXT).toMatch(/RESET ROW COUNTER/);
  });
});

function frontVNeckShoulderTabsHtml(r: ReturnType<typeof generateSleevelessBackPattern>): string {
  const chart = r.frontNeckShoulderShapingChart;
  expect(isSleevelessPulloverVNeckFrontChart(chart)).toBe(true);
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.debug.armholeStartRow, {
    includeCenterNecklineSetupRow: true,
  });
  return renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-shaping-chart-front", undefined, {
    activeSideOnly: true,
    activeSideRcStart: rcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: false,
    shoulderTabs: true,
    collapsible: false,
  });
}

describe("sleeveless Front V-neck First Side is immediately visible under tabs", () => {
  it("Case 1: no accordion after the First Side / Second Side handoff", () => {
    const r = generateSleevelessBackPattern(shallowVNeckPattern());
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras).toContain(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE);
    expect(paras.some((p) => p.includes(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST))).toBe(true);
    const html = frontVNeckShoulderTabsHtml(r);
    expect(html).toContain(NS_SHOULDER_TABS_ROOT_ATTR);
    expect(html).toContain(">First Side<");
    expect(html).toContain(">Second Side<");
    expect(html).not.toContain(">First Shoulder<");
    expect(html).not.toContain(">Second Shoulder<");
    expect(html).not.toContain("ns-shaping-chart--collapsible");
    expect(html).not.toContain("<details class=\"ns-shaping-chart");
    expect(html).not.toMatch(/id="ns-shaping-chart-front-panel-first"[^>]*\shidden/);
    expect(html).toMatch(/id="ns-shaping-chart-front-panel-second"[^>]*\shidden/);
  });

  it("overlap Cases 2–4 keep First visible and Second mounted", () => {
    for (const pattern of [
      amandaVNeckPattern(),
      sameStartVNeckPattern(),
      equalDepthVNeckPattern(),
      vNeckBeforeArmholePattern(),
    ]) {
      const r = generateSleevelessBackPattern(pattern);
      const html = frontVNeckShoulderTabsHtml(r);
      expect(html).toContain(NS_SHOULDER_TABS_ROOT_ATTR);
      expect(html).not.toContain("ns-shaping-chart--collapsible");
      expect(html).not.toMatch(/id="ns-shaping-chart-front-panel-first"[^>]*\shidden/);
      expect(html).toContain('data-chart-id="ns-shaping-chart-front-secondary"');
    }
  });

  it("keeps Visual Guides after the written checklist area", () => {
    const guides = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      construction: "sleeveless",
    });
    expect(guides).toContain("ns-visual-guides");
    expect(guides).toContain("Shaping Notation");
    expect(guides).not.toContain(NS_SHOULDER_TABS_ROOT_ATTR);
  });
});

describe("sleeveless Pullover V-neck Front user-facing copy avoids retired labels", () => {
  it.each([
    ["shallow after-armhole", shallowVNeckPattern()],
    ["Amanda during-armhole", amandaVNeckPattern()],
    ["equal-depth with-armhole", equalDepthVNeckPattern()],
    ["deep before-armhole", vNeckBeforeArmholePattern()],
  ] as const)("%s", (_label, pattern) => {
    const r = generateSleevelessBackPattern(pattern);
    const text = textLayer(r);
    const tabs = frontVNeckShoulderTabsHtml(r);
    const printHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      r.frontNeckShoulderShapingChart,
      "ns-print-banned-labels",
      "",
      {
        activeSideRcStart: armholeLocalRcActiveShoulderChecklistStart(
          r.frontNeckShoulderShapingChart,
          r.debug.armholeStartRow,
          { includeCenterNecklineSetupRow: true },
        ),
        includeCenterNecklineSetupRow: true,
        showSecondShoulderChecklist: true,
        sequentialShoulderHeadings: true,
      },
    );
    const actions = firstShoulderRows(r).map((row) => row.action).join("\n");
    const combined = `${text}\n${tabs}\n${printHtml}\n${actions}`;
    expect(combined).not.toMatch(/First Shoulder/);
    expect(combined).not.toMatch(/Second Shoulder/);
    expect(combined).not.toMatch(/inside edge/i);
    expect(combined).not.toMatch(/outside edge/i);
    expect(tabs).toContain(">First Side<");
    expect(tabs).toContain(">Second Side<");
  });
});

describe("sleeveless cardigan Front V-neck row-counter timing", () => {
  describe("before-armhole uses continuous garment RC like pullover Case 4", () => {
    const r = generateSleevelessBackPattern(asCardigan(vNeckBeforeArmholePattern()));
    const armholeStart = r.debug.armholeStartRow!;
    const overlap = r.debug.frontArmholeNecklineOverlap!;

    it("starts V-neck on garment RC, then joins the armhole later without a Front reset", () => {
      expect(r.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
      expect(overlap.divideGarmentRc).toBeLessThan(armholeStart);
      expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(overlap.divideGarmentRc);
      expect(sectionTitles(r.frontDisplayRows)).toEqual(
        expect.arrayContaining(["BODY", "FRONT NECKLINE & SHOULDERS"]),
      );
      expect(sectionTitles(r.frontDisplayRows)).not.toContain("ARMHOLE");
      const paras = collectParagraphs(r.frontDisplayRows);
      expect(paras).toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
      expect(paras).toContain(FRONT_VNECK_HANDOFF_ARMHOLE_JOINS);
      expect(paras.some((p) => /After the armhole reset, use Armhole RC/i.test(p))).toBe(false);
      expect(paras.some((p) => /begins at Armhole RC/i.test(p))).toBe(false);
      expect(paras.some((p) => /row counter was reset at the beginning of armhole shaping/i.test(p))).toBe(
        false,
      );
      expect(paras.join("\n")).not.toMatch(RESET_ROW_COUNTER_TEXT);
      expect(paras.some((p) => /Divide the Front at center/i.test(p))).toBe(false);
    });

    it("keeps one continuous garment RC through V-neck, armhole, and shoulder shaping", () => {
      expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("continuous-garment-rc");
      const first = firstShoulderRows(r);
      expect(first.some((row) => row.rowCounterReset === true)).toBe(false);
      expect(first.filter((row) => row.rc === 0)).toHaveLength(0);
      const setup = first.find((row) => /Divide at center/i.test(row.action));
      expect(setup?.rc).toBe(overlap.divideGarmentRc);
      const firstNeck = first.find((row) => row.edge === "Neck" && /Decrease/i.test(row.action));
      expect(firstNeck?.rc).toBeGreaterThanOrEqual(overlap.divideGarmentRc);
      expect(firstNeck?.rc).toBeLessThan(armholeStart);
      const armholeBo = first.find((row) => row.edge === "Armhole" && /Bind off/i.test(row.action));
      expect(armholeBo?.rc).toBe(armholeStart);
      const armholeDecs = first.filter(
        (row) => row.edge === "Armhole" && /Decrease/i.test(row.action),
      );
      expect(armholeDecs.length).toBeGreaterThan(0);
      expect(armholeDecs.every((row) => row.rc >= armholeStart)).toBe(true);
      const shoulder = first.filter(
        (row) => row.edge === "Shoulder" && /Bind off/i.test(row.action),
      );
      expect(shoulder.length).toBeGreaterThan(0);
      expect(shoulder.every((row) => row.rc > armholeStart)).toBe(true);
      expect(shoulder.every((row) => row.rc !== 0)).toBe(true);
    });
  });

  describe("after-armhole still resets and uses Armhole RC", () => {
    const r = generateSleevelessBackPattern(asCardigan(shallowVNeckPattern()));
    const armholeStart = r.debug.armholeStartRow!;

    it("keeps BODY → ARMHOLE reset → neckline on Armhole RC", () => {
      expect(r.debug.frontVNeckShapingTimingCase).toBe("after-armhole");
      expect(r.debug.frontArmholeNecklineOverlap).toBeUndefined();
      expect(sectionTitles(r.frontDisplayRows)).toEqual(
        expect.arrayContaining(["BODY", "ARMHOLE", "FRONT NECKLINE & SHOULDERS"]),
      );
      expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
      const armhole = armholeBlocks(r.frontDisplayRows);
      expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
      const paras = collectParagraphs(r.frontDisplayRows);
      expect(paras.some((p) => /After the armhole reset, use Armhole RC/i.test(p))).toBe(true);
      expect(
        paras.some((p) => /Front neckline \(V-neck\) shaping begins at Armhole RC/i.test(p)),
      ).toBe(true);
      const first = firstShoulderRows(r);
      const neck = first.find((row) => row.edge === "Neck" && /Decrease|Bind off/i.test(row.action));
      expect(neck).toBeDefined();
      expect(neck!.rc).toBeLessThan(armholeStart);
    });
  });

  describe("with-armhole and during-armhole keep the existing Front reset", () => {
    it.each([
      ["with-armhole", equalDepthVNeckPattern()],
      ["during-armhole", amandaVNeckPattern()],
    ] as const)("%s cardigan still resets at the armhole", (_label, pattern) => {
      const r = generateSleevelessBackPattern(asCardigan(pattern));
      expect(r.debug.frontVNeckShapingTimingCase).not.toBe("before-armhole");
      expect(sectionTitles(r.frontDisplayRows)).toContain("ARMHOLE");
      expect(armholeBlocks(r.frontDisplayRows).some((b) => b.rowCounterReset === true)).toBe(true);
      const paras = collectParagraphs(r.frontDisplayRows);
      expect(paras.some((p) => /After the armhole reset, use Armhole RC/i.test(p))).toBe(true);
    });
  });
});

describe("sleeveless checklist Edge column distinguishes Armhole vs Shoulder", () => {
  it("labels shoulder slope bind-offs Shoulder on a shallow V that has no overlap object", () => {
    const r = generateSleevelessBackPattern(shallowVNeckPattern());
    const first = firstShoulderRows(r);
    const shoulder = first.filter((row) => /Bind off/i.test(row.action) && row.edge === "Shoulder");
    const armholeBo = first.filter((row) => /Bind off/i.test(row.action) && row.edge === "Armhole");
    expect(shoulder.length).toBeGreaterThan(0);
    expect(armholeBo).toHaveLength(0);
    expect(first.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
  });

  it("keeps actual armhole decreases labeled Armhole on pullover Case 4", () => {
    const r = generateSleevelessBackPattern(vNeckBeforeArmholePattern());
    const first = firstShoulderRows(r);
    expect(first.some((row) => row.edge === "Armhole" && /Decrease/i.test(row.action))).toBe(true);
    expect(first.some((row) => row.edge === "Shoulder" && /Bind off/i.test(row.action))).toBe(true);
    expect(
      first.some((row) => row.edge === "Armhole" && /Decrease/i.test(row.action)),
    ).toBe(true);
    const lastArmhole = Math.max(
      ...first.filter((row) => row.edge === "Armhole").map((row) => row.rc),
    );
    const firstShoulder = Math.min(
      ...first.filter((row) => row.edge === "Shoulder").map((row) => row.rc),
    );
    expect(firstShoulder).toBeGreaterThan(lastArmhole);
  });
});
