import { describe, expect, it } from "vitest";
import {
  FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES,
  FRONT_VNECK_HANDOFF_AFTER_ARMHOLE,
  FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE,
  FRONT_VNECK_HANDOFF_DURING_ARMHOLE,
  FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST,
  FRONT_VNECK_HANDOFF_WITH_ARMHOLE,
  sleevelessFrontVNeckWrittenPathPresentation,
} from "./frontArmholeNecklineComposition";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import {
  isSleevelessPulloverVNeckFrontChart,
  NS_SHOULDER_TABS_ROOT_ATTR,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { RESET_ROW_COUNTER_TEXT } from "./rowCounterReset";
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
    expect(paras).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
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
  });
});

describe("sleeveless Front V-neck written presentation — Case 2 during armhole (Amanda)", () => {
  const r = generateSleevelessBackPattern(amandaVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap!;

  it("announces V-neck at the divide after armhole-only steps, without finished B", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("during-armhole");
    expect(bodyKnitToTarget(r.frontDisplayRows)).toBe(armholeStart);
    const armhole = armholeBlocks(r.frontDisplayRows);
    expect(armhole.some((b) => b.rowCounterReset === true)).toBe(true);
    expect(armhole.some((b) => b.paragraphs.some((p) => /Bind off OR hold/i.test(p)))).toBe(true);
    expect(armhole.some((b) => b.paragraphs.some((p) => /Decrease on rows: 2 - 4 - 6/.test(p)))).toBe(
      true,
    );
    expect(armhole.some((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_DURING_ARMHOLE))).toBe(true);
    const divideLocal = overlap.divideGarmentRc - armholeStart;
    const beginBlock = armhole.find((b) => b.paragraphs.includes(FRONT_VNECK_HANDOFF_DURING_ARMHOLE));
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
  });

  it("keeps required shaping actions on the written/checklist path", () => {
    const text = writtenPathText(r);
    expect(text).toMatch(/Bind off OR hold/i);
    expect(text).toMatch(/Decrease 1 stitch/i);
    expect(text).toMatch(/Divide at center|28 stitches on each side/i);
    expect(text).toContain(FRONT_VNECK_HANDOFF_DURING_ARMHOLE);
    expect(text).not.toMatch(/ns-visual-guides/);
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
    expect(armhole.some((b) => b.paragraphs.some((p) => /Bind off OR hold/i.test(p)))).toBe(false);
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
    expect(paras.some((p) => /Bind off OR hold/i.test(p))).toBe(false);
  });

  it("inserts the armhole reset in the checklist at the armhole garment RC", () => {
    const first = firstShoulderRows(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow)!;
    expect(setup.rc).toBe(overlap.divideGarmentRc);
    expect(setup.rc).not.toBe(0);
    const resetIdx = first.findIndex((row) => row.rowCounterReset === true);
    expect(resetIdx).toBeGreaterThan(0);
    const reset = first[resetIdx]!;
    expect(reset.rowCounterResetGarmentRc).toBe(armholeStart);
    expect(reset.rc).toBe(0);
    expect(reset.action).toBe(FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES);
    const boIdx = first.findIndex(
      (row) => row.rc === 0 && row.edge === "Armhole" && /Bind off/i.test(row.action),
    );
    expect(boIdx).toBeGreaterThan(resetIdx);
    expect(first.slice(0, resetIdx).every((row) => row.rc !== 0 || isCenterNecklineSetupChecklistRow(row))).toBe(
      true,
    );
    expect(first.some((row) => row.rc === overlap.divideGarmentRc)).toBe(true);
  });

  it("keeps a continuous written path through the reset without Visual Guides", () => {
    const text = writtenPathText(r);
    expect(text).toContain(FRONT_VNECK_HANDOFF_BEFORE_ARMHOLE);
    expect(text).toContain(FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES);
    expect(text).toMatch(/Bind off/i);
    expect(text).toMatch(/51 stitches on each side/i);
    expect(text).not.toMatch(/begins at Armhole RC 000/i);
    expect(text).not.toMatch(/begins at Armhole RC 001/i);
    expect(sleevelessFrontVNeckWrittenPathPresentation(overlap).visualGuidesAfterChecklist).toBe(true);
  });
});

describe("sleeveless Front V-neck knit-to never skips the next shaping event", () => {
  it.each([
    ["Case 1 after armhole", shallowVNeckPattern()],
    ["Case 2 during armhole", amandaVNeckPattern()],
    ["Case 3 both begin", sameStartVNeckPattern()],
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

describe("sleeveless Front V-neck First Shoulder is immediately visible under tabs", () => {
  it("Case 1: no accordion after Follow the row-by-row instructions below", () => {
    const r = generateSleevelessBackPattern(shallowVNeckPattern());
    const paras = collectParagraphs(r.frontDisplayRows);
    expect(paras).toContain(FRONT_VNECK_HANDOFF_AFTER_ARMHOLE);
    expect(paras).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    const html = frontVNeckShoulderTabsHtml(r);
    expect(html).toContain(NS_SHOULDER_TABS_ROOT_ATTR);
    expect(html).toContain(">First Shoulder<");
    expect(html).toContain(">Second Shoulder<");
    expect(html).not.toContain("ns-shaping-chart--collapsible");
    expect(html).not.toContain("<details class=\"ns-shaping-chart");
    expect(html).not.toMatch(/id="ns-shaping-chart-front-panel-first"[^>]*\shidden/);
    expect(html).toMatch(/id="ns-shaping-chart-front-panel-second"[^>]*\shidden/);
  });

  it("overlap Cases 2–4 keep First visible and Second mounted", () => {
    for (const pattern of [amandaVNeckPattern(), sameStartVNeckPattern(), vNeckBeforeArmholePattern()]) {
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
