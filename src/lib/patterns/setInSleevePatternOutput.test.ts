import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEMBERSHIPS } from "../../config/memberships";
import { getOpenPatternHrefForProject } from "./customPatternProjectNavigation";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import { buildDropShoulderSleeveShapingChartRows } from "./dropShoulderSleeveShapingChart";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  patternSystemDisplayName,
  resolvePatternSystemFromProject,
} from "./patternSystemId";
import { centerSeamHalfStitches } from "./centerSeamConstruction";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  buildSleevelessFinishingPrintListHtml,
  buildSleevelessFinishingStepsHtml,
} from "./sleevelessPatternFinishingHtml";
import { sleevelessFinishingFromPattern } from "./sleevelessPatternFinishing";
import {
  EWRAP_CAST_ON_GLOSSARY_ID,
  generateSleevelessBackPattern,
  LIFELINE_GLOSSARY_ID,
} from "./sleevelessPatternOutput";
import { ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID } from "./roundBackNecklineShapingVideoTip";
import {
  SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID,
  SET_IN_NECKLINE_ORIENTATION_TIP_ID,
} from "./setInSleeveLearningResources";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { RESET_ROW_COUNTER_TEXT, formatRowCounterResetGarmentRcLabel } from "./rowCounterReset";
import {
  canCreatePatternForSystem,
  canEditPatternSettingsForSystem,
  hasPatternSystemAccess,
  resolvePatternSystemAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import {
  generateSetInSleeveCenterSeamHalf,
  generateSetInSleevePattern,
} from "./setInSleevePatternOutput";
import {
  orientCenterSeamDiagramSvg,
  tryBuildLiveSleevelessFrontStsRowsDiagramSvg,
} from "./sleevelessFrontStsRowsDiagramSvg";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessBackNotationSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontCardiganRoundNotationSvg } from "./sleevelessFrontCardiganRoundShapingNotationDiagramSvg";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import {
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import {
  renderSleevelessFrontChartIntroHtml,
  renderSleevelessPatternTabFrontChartTableHtml,
} from "./sleevelessFrontChartIntroHtml";
import { centerBindOffStitchesFromNeckShoulderChart } from "./sleevelessPatternOutput";
import { buildSleevelessRoundNeckShapingMapData } from "./sleevelessRoundNeckShapingSchedule";
import {
  SET_IN_SLEEVE_CONSTRUCTION,
  SET_IN_SLEEVE_DIRECTION,
  withSetInSleeveConstructionAuthored,
  withSetInSleeveConstructionFamily,
} from "./setInSleeveConstructionIdentity";
import plusSizes from "../../../public/data/sizing_sweaters_plus.json";

const finishingDeps = {
  escapeHtml: (s: string) => s,
  glossaryTooltip: (_id: number, term: string) => term,
  neckFinishingVideoKey: "onePieceBand",
  neckFinishingButtonLabel: "One-piece neckband",
  neckFinishingLeadHtml: "",
};

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const MEN_4X: ChartRow = {
  bust_or_chest: 48,
  waist: 46,
  hip: 52.5,
  garment_back_length: 29,
  armhole_depth: 12,
  shoulder_width: 21,
  neck_opening: 8.25,
  front_neck_depth: 5.75,
  back_neck_depth: 1.5,
  upper_arm: 20,
  wrist: 8,
  sleeve_length: 19.75,
};

function pattern(options: {
  audience?: string;
  row?: ChartRow;
  fit?: string;
  bodyShape?: "straight" | "aline";
  garmentStyle?: "pullover" | "cardigan";
  neckline?: "round" | "v-neck";
  sleeveLength?: string;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  availableNeedles?: number;
}): Record<string, unknown> {
  const audience = options.audience ?? "misses";
  const row = options.row ?? MISSES_7;
  const fit = options.fit ?? "standard";
  const measurements = computeDefaultMeasurementsFromChartRow(row, fit, {
    bodyShape: options.bodyShape ?? "straight",
  });
  return {
    fit: {
      sizingChart: audience,
      easeChoice: fit,
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: audience,
        garmentStyle: options.garmentStyle ?? "pullover",
        neckline: options.neckline ?? "round",
        bodyShape: options.bodyShape ?? "straight",
      },
      options.sleeveLength ?? "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch ?? 5,
      gaugeRowsPerInch: options.rowsPerInch ?? 7,
      availableNeedles: options.availableNeedles ?? 200,
    },
  };
}

function sectionRows<T extends { kind: string; title?: string }>(rows: readonly T[], title: string): T[] {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === title);
  if (start < 0) return [];
  const out: T[] = [];
  for (const row of rows.slice(start + 1)) {
    if (row.kind === "section") break;
    out.push(row);
  }
  return out;
}

function textOf(rows: ReadonlyArray<{ kind: string; paragraphs?: string[]; title?: string }>): string {
  return rows
    .map((row) => (row.kind === "block" ? (row.paragraphs ?? []).join(" ") : row.title ?? ""))
    .join("\n");
}

function savedProject(
  construction: "set-in-sleeve" | "drop-shoulder" | "sleeveless",
): Pick<CustomPatternProject, "pattern" | "customOverrides"> {
  if (construction === "sleeveless") {
    return {
      pattern: { style: { patternMode: "express" } } as CustomPatternProject["pattern"],
      customOverrides: {},
    };
  }
  const style =
    construction === "set-in-sleeve"
      ? withSetInSleeveConstructionAuthored({ neckline: "round" }, "long")
      : withDropShoulderConstructionAuthored({ neckline: "round" }, "long");
  return {
    pattern: { style } as CustomPatternProject["pattern"],
    customOverrides:
      construction === "set-in-sleeve" ? withSetInSleeveConstructionFamily({}) : {},
  };
}

function notationTextLines(svg: string, role: string): string[] {
  const found: string[] = [];
  const re = new RegExp(`data-role="${role}"[^>]*>([^<]*)<`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(svg))) found.push(match[1] ?? "");
  return found;
}

describe("set-in sleeve pattern choices", () => {
  it("labels each front armhole bind-off per edge, matching the back", () => {
    const data = pattern({});
    const result = generateSetInSleevePattern(data);
    const plan = result.setInArmholePlan;
    expect(plan?.ok).toBe(true);
    if (!plan?.ok) return;
    expect(plan.stairStepBindOffsEachSide.length).toBeGreaterThan(0);
    const frontNotation = tryBuildLiveSleevelessFrontRoundNotationSvg(result, data);
    const backNotation = tryBuildLiveSleevelessBackNotationSvg(result, data);
    expect(frontNotation).toBeTruthy();
    expect(backNotation).toBeTruthy();
    const perEdge = [plan.initialBindOffStitchesEachSide, ...plan.stairStepBindOffsEachSide].map(
      (stitches) => `bo${stitches}`,
    );
    const frontArmhole = [
      ...notationTextLines(frontNotation!, "armhole-bo"),
      ...notationTextLines(frontNotation!, "armhole-shaping"),
    ];
    const backArmhole = [
      ...notationTextLines(backNotation!, "armhole-bo"),
      ...notationTextLines(backNotation!, "armhole-shaping"),
    ];
    expect(frontArmhole.filter((line) => line.startsWith("bo"))).toEqual(perEdge);
    expect(frontArmhole.filter((line) => line.startsWith("bo"))).toEqual(
      backArmhole.filter((line) => line.startsWith("bo")),
    );
    expect(frontArmhole).not.toContain(`bo${plan.matchedBindOffStitchesEachSide}`);
    expect(frontNotation).toContain(`data-bind-off-sts="${plan.matchedBindOffStitchesEachSide}"`);
    expect(result.debug.frontFinalRow! - result.debug.armholeStartRow!).toBe(result.debug.armholeRows);
  });

  it("builds a round-neck pullover with a cuff-up sleeve and matching cap", () => {
    const result = generateSetInSleevePattern(pattern({}));
    const overview = textOf(result.overviewRows);
    const back = textOf(result.displayRows);
    const sleeve = textOf(result.sleeveDisplayRows);
    expect(overview).toContain("pullover, round neckline");
    expect(overview).toContain("cuff-up");
    expect(overview).toMatch(/Finished bust 4\d/);
    expect(overview).toContain("separate from the cuff-to-upper-arm length");
    expect(back).toContain("Bind off");
    expect(back).toMatch(/Decrease 1 stitch at each armhole edge every other row, \d+ times \(RC:/);
    expect(back).not.toContain("Knit these rows even");
    expect(back).not.toMatch(/removed total/);
    expect(sleeve).toContain("Make 2 sleeves.");
    expect(sleeve).toContain("Increase 1 stitch at each side every");
    expect(sleeve).toMatch(/\(RC: \d{3}(?:, \d{3})+\)/);
    expect(sleeve).not.toMatch(/\(RC: \d{3}, RC:/);
    expect(sleeve).toContain("Sleeve-cap height");
    expect(result.sleeveDisplayRows.map((row) => (row.kind === "section" ? row.title : ""))).toEqual(
      expect.arrayContaining(["CUFF", "SLEEVE BODY", "SLEEVE SHAPING CHART", "SLEEVE CAP"]),
    );
    const sectionTitles = result.sleeveDisplayRows
      .filter((row) => row.kind === "section")
      .map((row) => (row.kind === "section" ? row.title : ""));
    expect(sectionTitles).toEqual([
      "CUFF",
      "SLEEVE BODY",
      "SLEEVE SHAPING CHART",
      "SLEEVE CAP",
      "SLEEVE CAP SHAPING CHART",
    ]);
    const chartBlock = result.sleeveDisplayRows.find(
      (row) => row.kind === "block" && row.sleeveShapingChartRows && row.sleeveShapingChartRows.length > 0,
    );
    expect(chartBlock && chartBlock.kind === "block" ? chartBlock.sleeveShapingChartRows : []).toEqual(
      buildDropShoulderSleeveShapingChartRows({
        topSts: result.sleevePiece!.topSts,
        wristSts: result.sleevePiece!.wristSts,
        cuffRows: result.sleevePiece!.cuffRows,
        sleeveBodyRows: result.sleevePiece!.sleeveBodyRows,
        sleeveTotalRows: result.sleevePiece!.sleeveTotalRows,
        direction: "cuff-up",
      }).filter((row) => row.stitchesRemaining > 0),
    );
    const cuffBlock = result.sleeveDisplayRows.find(
      (row, index) =>
        row.kind === "block" &&
        result.sleeveDisplayRows
          .slice(0, index)
          .some((earlier) => earlier.kind === "section" && earlier.title === "CUFF") &&
        !result.sleeveDisplayRows
          .slice(0, index)
          .some((earlier) => earlier.kind === "section" && earlier.title === "SLEEVE BODY"),
    );
    expect(cuffBlock && cuffBlock.kind === "block" ? cuffBlock.stitchCount : 0).toBe(
      result.sleevePiece?.wristSts,
    );
    const capStart = result.sleeveDisplayRows.findIndex(
      (row) => row.kind === "section" && row.title === "SLEEVE CAP",
    );
    const capStitchBlock = result.sleeveDisplayRows
      .slice(capStart + 1)
      .find((row) => row.kind === "block" && row.stitchCount !== undefined);
    expect(capStitchBlock && capStitchBlock.kind === "block" ? capStitchBlock.stitchCount : 0).toBe(
      result.sleevePiece?.topSts,
    );
    const html = renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" });
    expect(html).toContain("ns-shaping-chart__row-check");
    expect(html).toContain("SLEEVE SHAPING CHART");
    expect(html).toContain("SLEEVE CAP SHAPING CHART");
    expect(html).toContain('data-chart-id="drop-shoulder-sleeve-shaping-chart-sleeve"');
    expect(html).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    expect(html).toContain("data-chart-progress-show-completed");
    expect(html).toContain("data-chart-progress-reset");
    expect(html).not.toContain("Bind off loosely or scrap off");
    expect(html).not.toContain("Knit these rows even");
    expect(html).toMatch(/\(RC: \d{3}(?:, \d{3})+\)/);
    expect(html).not.toMatch(/\(RC: \d{3}, RC:/);
    const printHtml = renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve");
    expect(printHtml).toMatch(/\(RC: \d{3}(?:, \d{3})+\)/);
    expect(printHtml).not.toMatch(/\(RC: \d{3}, RC:/);
    expect(printHtml).toContain("ns-shaping-chart__row-check");
    expect(printHtml).toContain('data-chart-id="set-in-sleeve-cap-shaping-chart-sleeve"');
    expect(printHtml).toContain('type="checkbox"');
    const capChart = result.sleeveDisplayRows.find(
      (row) => row.kind === "block" && row.sleeveShapingChartId === "set-in-sleeve-cap-shaping-chart",
    );
    const capRows = capChart && capChart.kind === "block" ? capChart.sleeveShapingChartRows ?? [] : [];
    const cap = result.sleeveCap;
    expect(capRows.length).toBeGreaterThan(0);
    expect(cap).not.toBeNull();
    expect(capRows[capRows.length - 1]).toMatchObject({
      rc: (result.sleevePiece?.sleeveBodyRows ?? 0) + (cap?.totals.capRows ?? -1),
      stitchesRemaining: 0,
    });
    expect(capRows[capRows.length - 1]?.action).toBe(
      `Bind off the remaining ${cap?.totals.finalStitches ?? 0} stitches`,
    );
    expect(result.sleeveCap?.ok).toBe(true);
    expect(result.warnings.join(" ")).not.toMatch(/bind-off does not match/i);
    expect(result.setInArmholePlan?.appliesTo).toBe("front-and-back");
  });

  it("places the armhole reset marker, row counter, and stitch count on screen and in print", () => {
    const result = generateSetInSleevePattern(pattern({}));
    const armholeRows = sectionRows(result.displayRows, "ARMHOLE");
    const reset = armholeRows.find((row) => row.kind === "block" && row.rowCounterReset === true);
    const decrease = armholeRows.find(
      (row) =>
        row.kind === "block" &&
        row.paragraphs.some((paragraph) => /Decrease 1 stitch at each armhole edge every other row/.test(paragraph)),
    );
    expect(reset && reset.kind === "block" ? reset.rowCounterResetGarmentRc : undefined).toBe(
      result.debug.armholeStartRow,
    );
    expect(reset && reset.kind === "block" ? reset.stitchCount : 0).toBeUndefined();
    expect(reset && reset.kind === "block" ? reset.paragraphs : ["filled"]).toEqual([]);
    expect(decrease && decrease.kind === "block" ? decrease.rc : "").toMatch(/^RC: \d{3}$/);
    expect(decrease && decrease.kind === "block" ? decrease.stitchCount : 0).toBeGreaterThan(0);
    const decreaseText = decrease && decrease.kind === "block" ? decrease.paragraphs.join(" ") : "";
    expect(decreaseText).toMatch(/\(RC: \d{3}(?:, \d{3})+\)/);
    expect(decreaseText).not.toMatch(/RC: \d{3}, RC:/);
    expect(decreaseText).not.toMatch(/Knit these rows even|stitches remain/);

    const screen = renderPatternDisplayRowsHtml(armholeRows, { pieceSectionId: "back" });
    const printHtml = renderSleevelessPrintPieceHtml(armholeRows, "", "back");
    for (const html of [screen, printHtml]) {
      expect(html).toContain("row-counter-reset");
      expect(html).toContain(RESET_ROW_COUNTER_TEXT);
      expect(html).toContain(
        formatRowCounterResetGarmentRcLabel(
          reset && reset.kind === "block" ? (reset.rowCounterResetGarmentRc ?? 0) : 0,
        ),
      );
      expect(html).toContain("Decrease 1 stitch at each armhole edge every other row");
      expect(html).toMatch(/\(RC: \d{3}(?:, \d{3})+\)/);
      expect(html).not.toMatch(/RC: \d{3}, RC:/);
      expect(html).not.toContain("Knit these rows even");
      expect(html).not.toContain("Reset row counter to RC: 000.");
    }
    const decreaseSentence =
      decrease && decrease.kind === "block" ? decrease.paragraphs[0] ?? "" : "";
    const screenDecrease = screen.slice(Math.max(0, screen.indexOf(decreaseSentence) - 160));
    expect(screenDecrease).toContain(`class="sleeveless-pattern-rc">${decrease && decrease.kind === "block" ? decrease.rc : ""}`);
    expect(screen).toContain(
      `class="sleeveless-pattern-sts">${decrease && decrease.kind === "block" ? decrease.stitchCount : ""} sts`,
    );
    expect(printHtml).toContain(
      `class="print-inst-sts">${decrease && decrease.kind === "block" ? decrease.stitchCount : ""} sts`,
    );
    const resetScreen = screen.slice(0, screen.indexOf(RESET_ROW_COUNTER_TEXT) + RESET_ROW_COUNTER_TEXT.length);
    expect(resetScreen).not.toContain("sleeveless-pattern-sts");
  });

  it("writes cardigan armhole and finishing, not pullover sleeve hanging", () => {
    const data = pattern({ garmentStyle: "cardigan", neckline: "round" });
    const result = generateSetInSleevePattern(data);
    const front = textOf(result.frontDisplayRows);
    expect(textOf(result.overviewRows)).toContain("cardigan, round neckline");
    expect(front).toContain("at the armhole edge");
    expect(front).not.toContain("at each armhole edge");
    const finishing = sleevelessFinishingFromPattern(data, result.debug);
    expect(finishing.isSetInSleeve).toBe(true);
    expect(finishing.isCardigan).toBe(true);
    expect(finishing.steps.map((step) => step.id)).toContain("finishFrontEdges");
    expect(finishing.steps.map((step) => step.id)).not.toContain("finishArmholes");
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: true,
      isSetInSleeve: true,
      deps: finishingDeps,
    });
    expect(html).toContain("Lay the front and back flat with the shoulder seams joined and the side seams open.");
    expect(html).toContain("Match the center of the sleeve cap to the shoulder seam.");
    expect(html).toContain("Seam the sleeve cap into the armhole.");
    expect(html).toContain("5. Attach Sleeves");
    expect(html).toContain("6. Join Side and Sleeve Seams");
    expect(html).toContain(
      "Starting at the sleeve cuff, seam along the sleeve underarm to the body underarm, then continue down the body side seam to the hem.",
    );
    expect(html).not.toContain("Seam each sleeve.");
    expect(html).not.toContain("Seam from hem to underarm.");
    expect(html).not.toContain("Hang the live sleeve stitches.");
    expect(html).toContain("Finish Front Edges");
  });

  it("keeps V-neck instructions off the round-neck path", () => {
    const round = generateSetInSleevePattern(pattern({ neckline: "round" }));
    const vNeck = generateSetInSleevePattern(pattern({ neckline: "v-neck", garmentStyle: "cardigan" }));
    expect(textOf(vNeck.overviewRows)).toContain("cardigan, V-neck");
    expect(textOf(vNeck.frontDisplayRows)).toMatch(
      /Decrease 1 stitch at the armhole edge every other row, \d+ times \(RC:/,
    );
    expect(textOf(vNeck.frontDisplayRows)).not.toMatch(/removed total|Knit these rows even|bind off or hold/i);
    expect(textOf(round.frontDisplayRows)).not.toContain("V-neck");
    const vData = pattern({ neckline: "v-neck", garmentStyle: "pullover" });
    const finishing = sleevelessFinishingFromPattern(vData, vNeck.debug);
    const html = buildSleevelessFinishingStepsHtml({
      isCardigan: false,
      isSetInSleeve: true,
      deps: { ...finishingDeps, neckFinishingVideoKey: "vNeckBandFinishing" },
    });
    expect(finishing.isCardigan).toBe(false);
    expect(html).toContain("4. Attach Sleeves");
    expect(html).toContain("5. Join Side and Sleeve Seams");
    expect(html).toContain("Seam the sleeve cap into the armhole.");
    expect(html).not.toContain("Seam each sleeve.");
    expect(html).not.toContain("Finish Front Edges");
    const print = buildSleevelessFinishingPrintListHtml({
      isCardigan: true,
      isSetInSleeve: true,
    });
    expect(print).toContain("side seams open");
    expect(print).toContain("Join side and sleeve seams:");
    expect(print).not.toContain("seam each sleeve");
    expect(print).not.toContain("hang the live sleeve stitches");
  });

  it("uses straight and A-line hips from the existing body measurements", () => {
    const straight = generateSetInSleevePattern(pattern({ bodyShape: "straight" }));
    const aline = generateSetInSleevePattern(pattern({ bodyShape: "aline" }));
    const straightHip = textOf(straight.overviewRows).match(/Hip ([0-9.]+) in/)?.[1];
    const alineHip = textOf(aline.overviewRows).match(/Hip ([0-9.]+) in/)?.[1];
    expect(straightHip).toBeDefined();
    expect(alineHip).toBeDefined();
    expect(Number(alineHip)).toBeGreaterThan(Number(straightHip));
  });

  it("calculates Women's 6X and both armhole methods", () => {
    const plus6x = (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x");
    expect(plus6x).toBeDefined();
    const plus = generateSetInSleevePattern(
      pattern({
        audience: "plus",
        row: plus6x,
        stitchesPerInch: 5,
        rowsPerInch: 7,
      }),
    );
    expect(plus.sleeveCap?.ok).toBe(true);
    expect(textOf(plus.overviewRows)).toContain("Armhole method:");
    expect(plus.warnings.join(" ")).not.toMatch(/bind-off does not match/i);

    const alternate = generateSetInSleevePattern(
      pattern({ stitchesPerInch: 5, rowsPerInch: 7 }),
    );
    const standard = generateSetInSleevePattern(
      pattern({
        audience: "men",
        row: MEN_4X,
        stitchesPerInch: 4,
        rowsPerInch: 6,
      }),
    );
    expect(alternate.setInArmholePlan?.method).toBe("alternate");
    expect(standard.setInArmholePlan?.method).toBe("standard");
    expect(standard.sleeveCap?.armhole.method).toBe("standard");
    expect(standard.warnings.join(" ")).not.toMatch(/bind-off does not match/i);
    expect(textOf(standard.sleeveDisplayRows)).toContain("Bind off");
  });

  it("changes sleeve instructions when gauge or sleeve length changes", () => {
    const fine = generateSetInSleevePattern(pattern({ stitchesPerInch: 7, rowsPerInch: 10 }));
    const coarse = generateSetInSleevePattern(pattern({ stitchesPerInch: 4, rowsPerInch: 6 }));
    const longSleeve = textOf(
      generateSetInSleevePattern(pattern({ sleeveLength: "long" })).sleeveDisplayRows,
    );
    const shortSleeve = textOf(
      generateSetInSleevePattern(pattern({ sleeveLength: "short" })).sleeveDisplayRows,
    );
    expect(fine.sleeveCap?.sleeve.upperArmStitches).not.toBe(
      coarse.sleeveCap?.sleeve.upperArmStitches,
    );
    expect(longSleeve).not.toBe(shortSleeve);
  });

  it("explains needle capacity without hiding a valid larger size", () => {
    const result = generateSetInSleevePattern(pattern({ availableNeedles: 40 }));
    expect(result.sleeveCap?.ok).toBe(true);
    expect(textOf(result.overviewRows)).toContain("needles at the widest piece");
    expect(textOf(result.overviewRows)).toContain("Panel seams are not added.");
    expect(textOf(result.displayRows)).toContain("Bind off");
  });
});

describe("set-in sleeve saved patterns, print, and membership", () => {
  it("classifies saved projects separately from sleeveless and drop shoulder", () => {
    const setIn = savedProject("set-in-sleeve");
    const drop = savedProject("drop-shoulder");
    const sleeveless = savedProject("sleeveless");
    expect(resolvePatternSystemFromProject(setIn)).toBe("set-in-sleeve");
    expect(resolvePatternSystemFromProject(drop)).toBe("drop-shoulder");
    expect(resolvePatternSystemFromProject(sleeveless)).toBe("sleeveless");
    expect(patternSystemDisplayName("set-in-sleeve")).toBe("Set-In Sleeve");
    expect(getOpenPatternHrefForProject(setIn)).toBe("/patterns/set-in-sleeve/pattern/");
    expect(getOpenPatternHrefForProject(drop)).toBe("/patterns/drop-shoulder/pattern/");
    expect(getOpenPatternHrefForProject(sleeveless)).not.toContain("set-in-sleeve");
    const style = setIn.pattern?.style as Record<string, unknown>;
    expect(style.sleeveDirection).toBe(SET_IN_SLEEVE_DIRECTION);
    expect(style.construction).toBe(SET_IN_SLEEVE_CONSTRUCTION);
  });

  it("keeps the catalog coming soon and prints from the pattern workspace", () => {
    const catalog = readFileSync("src/pages/patterns/index.astro", "utf8");
    expect(catalog).toContain("title: 'Set-In Sleeve Sweater'");
    expect(catalog).toContain("const comingSoonPatterns");
    const patternPage = readFileSync("src/pages/patterns/set-in-sleeve/pattern/index.astro", "utf8");
    expect(patternPage).toContain("thumbnailSrc={SET_IN_SLEEVE_PATTERN_LANDING_IMAGE_SRC}");
    expect(patternPage).toContain("thumbnailWidth={1536}");
    expect(patternPage).toContain("thumbnailHeight={1024}");
    expect(patternPage).not.toContain("drop_shoulder.webp");
    expect(patternPage).toContain('data-express-construction="set-in-sleeve"');
    expect(patternPage).toContain("data-pattern-print-skip-modal");
    expect(patternPage).toContain("PatternPrintFooter");
    expect(patternPage).toContain("KnitItNow.com/set-in-sleeve");
    expect(readFileSync("src/pages/patterns/set-in-sleeve/builder.astro", "utf8")).toContain(
      'data-express-review-href="/patterns/set-in-sleeve/pattern/?generated=1"',
    );
    expect(catalog).toContain("'/images/patterns/set-in.png'");
    expect(catalog).toContain("'/images/patterns/raglan.png'");
    expect(catalog).not.toContain("set-in.webp");
    expect(catalog).not.toContain("raglan.webp");
    const landing = readFileSync("src/lib/patterns/setInSleevePatternLanding.ts", "utf8");
    expect(landing).toContain("/images/patterns/set-in.png");
    expect(landing).not.toContain("set-in.webp");
    expect(readFileSync("src/pages/patterns/set-in-sleeve/index.astro", "utf8")).toContain(
      "SET_IN_SLEEVE_PATTERN_BUILDER_LANDING",
    );
  });

  it("follows membership access and does not treat a free claim as create access", () => {
    const member: SleevelessUserAccess = {
      loggedIn: true,
      memberId: "ms_member",
      activePlanIds: [MEMBERSHIPS.membership.memberstackPlanId],
      hasSystemAccess: true,
    };
    const loggedOut: SleevelessUserAccess = {
      loggedIn: false,
      hasSystemAccess: false,
    };
    expect(
      resolvePatternSystemAccess({
        activePlanIds: member.activePlanIds ?? [],
        patternSystemId: "set-in-sleeve",
      }).hasSystemAccess,
    ).toBe(true);
    expect(canCreatePatternForSystem(member, "set-in-sleeve")).toBe(true);
    expect(canEditPatternSettingsForSystem(member, "set-in-sleeve")).toBe(true);
    expect(hasPatternSystemAccess(loggedOut, "set-in-sleeve")).toBe(false);
    expect(canCreatePatternForSystem(loggedOut, "set-in-sleeve")).toBe(false);
    expect(
      resolvePatternSystemAccess({
        activePlanIds: [],
        patternSystemId: "set-in-sleeve",
        sleevelessUnlockedViaJson: true,
      }).hasSystemAccess,
    ).toBe(false);
  });
});

describe("existing sleeveless and drop-shoulder generation", () => {
  it("leaves sleeveless armhole wording unchanged when set-in mode is off", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    const back = textOf(sleeveless.displayRows);
    expect(sleeveless.setInArmholePlan).toBeUndefined();
    expect(back).toMatch(/armhole/i);
    expect(back).not.toContain("Sleeve-cap height");
  });

  it("still generates a drop-shoulder pattern from drop-shoulder construction", () => {
    const data = pattern({});
    data.style = withDropShoulderConstructionAuthored(
      { ...(data.style as Record<string, unknown>) },
      "long",
    );
    const result = generateDropShoulderPattern(data);
    expect(result.isDropShoulder).toBe(true);
    expect((result as { isSetInSleeve?: boolean }).isSetInSleeve).not.toBe(true);
  });
});

function sectionPlainText(
  rows: ReturnType<typeof generateSetInSleevePattern>["displayRows"],
  title: string,
): string {
  let inSection = false;
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind === "section" && row.title === title) {
      inSection = true;
      continue;
    }
    if (inSection && row.kind === "section") break;
    if (inSection && row.kind === "block") {
      const paras = row.trustedParagraphs ?? row.paragraphs ?? [];
      parts.push(...paras);
    }
  }
  return parts.join("\n").replace(/<[^>]+>/g, "");
}

function backNeckSummaryPlainText(result: ReturnType<typeof generateSetInSleevePattern>): string {
  return sectionPlainText(result.displayRows, "BACK NECKLINE & SHOULDERS");
}

function frontNeckSummaryPlainText(result: ReturnType<typeof generateSetInSleevePattern>): string {
  return sectionPlainText(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function backChecklistHtml(result: ReturnType<typeof generateSetInSleevePattern>): string {
  const chart = result.neckShoulderShapingChart;
  if (!chart) return "";
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.debug.armholeStartRow, {
    includeCenterNecklineSetupRow: true,
  });
  return renderNeckShoulderShapingChartTableOnlyHtml(chart, "ns-shaping-chart-back", "", {
    activeSideOnly: true,
    activeSideRcStart: rcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: true,
    tableHeading: "First Shoulder Checklist",
    collapsibleDefaultOpen: false,
    resetRowCounterForSecondShoulder: true,
    finishHeldNecklineAfterSecondShoulder: true,
  });
}

function firstChecklistCounter(html: string, marker: string): { rc: string; side: string } {
  const start = html.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const match = html
    .slice(start)
    .match(
      /ns-shaping-chart__row-counter-number">([^<]+)<\/span>(?:\s*<span class="ns-shaping-chart__row-counter-side">\(([^)]+)\)<\/span>)?/,
    );
  expect(match?.[1]).toBeTruthy();
  const rc = match![1].split(/\u2013|-/)[0] ?? "";
  return { rc, side: match?.[2] ?? "" };
}

describe("set-in back neckline and shoulder checklist", () => {
  const cases = [
    { label: "misses 7 round", options: { row: MISSES_7, neckline: "round" as const } },
    { label: "misses 7 v-neck", options: { row: MISSES_7, neckline: "v-neck" as const } },
    {
      label: "men 4x finer gauge",
      options: { row: MEN_4X, audience: "men", stitchesPerInch: 4, rowsPerInch: 6, neckline: "round" as const },
    },
    {
      label: "plus size high row gauge",
      options: {
        row: (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x"),
        audience: "plus",
        stitchesPerInch: 6,
        rowsPerInch: 8,
        neckline: "round" as const,
      },
    },
  ];

  it.each(cases)("renders both shoulder checklists for $label", ({ options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    const summary = backNeckSummaryPlainText(result);
    expect(summary).toMatch(/Place center neckline needles L\d+ through R\d+ in hold/i);
    expect(summary).toMatch(/Put the Second Shoulder needles L\d+ through L\d+ into hold/i);
    expect(summary).toMatch(/Work the First Shoulder on needles R\d+ through R\d+/i);
    expect(summary).not.toMatch(/Scrap off or bind off all remaining held neckline stitches/i);
    expect(summary).toMatch(/Use the checklist below for row-by-row neckline and shoulder shaping/i);
    expect(summary).not.toMatch(/Put needles L\d+ through R\d+ into hold/i);
    expect(summary).not.toMatch(/right shoulder|left shoulder|Stage [123]/i);
    const backLabel = `RC:${String(Math.max(0, Math.floor(result.debug.backNecklineStartLocalRC ?? 0))).padStart(3, "0")}`;
    const introOptions = {
      localStartRcLabel: backLabel,
      centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.neckShoulderShapingChart),
      chart: result.neckShoulderShapingChart,
      omitRepeatedNecklineSetup: true,
    };
    const backIntro = stripTags(
      renderActiveShoulderChartIntroHtml({
        ...introOptions,
        wrapperClass: "pattern-shaping-intro",
        layout: "labeled",
        includeWorkflowSteps: true,
      }),
    );
    const backPrint = stripTags(
      renderActiveShoulderChartIntroHtml({
        ...introOptions,
        wrapperClass: "print-chart-intro",
        layout: "compact",
      }),
    );
    for (const intro of [backIntro, backPrint]) {
      expect(intro).toContain("First Shoulder");
      expect(intro).toContain("Second Shoulder");
      expect(intro).toContain("neck edge");
      expect(intro).toContain("shoulder edge");
      expect(intro).toMatch(/Knit until the armhole row counter reads RC: \d{3}/);
      expect(intro).not.toMatch(/right shoulder|left shoulder|Stage [123]|three stages/i);
      expect(intro).not.toMatch(/place the center \d+ neckline stitches in hold/i);
    }
    expect(result.displayRows.some((row) => row.kind === "neckShoulderChartTableMount")).toBe(true);
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);

    const html = backChecklistHtml(result);
    expect(html).toContain("First Shoulder Checklist");
    expect(html).toContain("Second Shoulder Checklist");
    expect(html).toContain("Show Completed Rows");
    expect(html).toContain("Reset Checklist");
    expect(html).toContain("Done");
    expect(html).toContain(">RC");
    expect(html).not.toMatch(/ns-shaping-chart__row-counter-number">RC/);
    expect(html).toContain("Action");
    expect(html).toContain("Edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("ns-shaping-chart--second-shoulder");
    expect(html).toContain("data-second-shoulder-content");
    const secondHeading = html.indexOf("Second Shoulder Checklist");
    const finish = html.indexOf("Scrap off or bind off all remaining held neckline stitches.");
    expect(secondHeading).toBeGreaterThanOrEqual(0);
    expect(finish).toBeGreaterThan(secondHeading);
    expect(html.slice(0, secondHeading)).not.toContain(
      "Scrap off or bind off all remaining held neckline stitches.",
    );
    expect(html).not.toMatch(/right shoulder|left shoulder|Stage [123]/i);

    const rows = buildActiveSideInstructionTableRows(result.neckShoulderShapingChart!, 0, {
      includeCenterNecklineSetupRow: true,
      hideCenterNecklineSetupRow: true,
    });
    expect(rows.some((row) => row.edge === "Neck" && /Hold|Decrease|Bind off/.test(row.action))).toBe(true);
    expect(rows.some((row) => row.edge === "Shoulder" && /Bind off/.test(row.action))).toBe(true);
  });

  it("keeps checklist neckline and shoulder rows on the timeline rows", () => {
    for (const { options } of cases) {
      const result = generateSetInSleevePattern(pattern(options));
      const armholeStart = result.debug.armholeStartRow ?? 0;
      const timeline = result.neckShoulderShapingChart?.timeline ?? [];
      const rcStart = armholeLocalRcActiveShoulderChecklistStart(
        result.neckShoulderShapingChart!,
        armholeStart,
        { includeCenterNecklineSetupRow: true },
      );
      const rows = buildActiveSideInstructionTableRows(result.neckShoulderShapingChart!, rcStart, {
        includeCenterNecklineSetupRow: true,
      }).filter((row) => row.edge === "Neck" || row.edge === "Shoulder");
      const expected: { rc: number; edge: "Neck" | "Shoulder" }[] = [];
      for (const entry of timeline) {
        for (const event of entry.events) {
          if (event.side !== "right" || event.amount <= 0) continue;
          if (event.edge === "inner") expected.push({ rc: entry.row - armholeStart, edge: "Neck" });
          else if (event.edge === "outer" && event.kind !== "decrease") {
            expected.push({ rc: entry.row - armholeStart, edge: "Shoulder" });
          }
        }
      }
      expect(expected.length).toBeGreaterThan(0);
      const actual = rows.map((row) => `${row.edge}@${row.rc}`);
      for (const event of expected) {
        expect(actual).toContain(`${event.edge}@${event.rc}`);
      }
      const lastTimelineRc = Math.max(...timeline.map((entry) => entry.row - armholeStart));
      for (const row of rows) {
        expect(row.rc).toBeLessThanOrEqual(lastTimelineRc);
      }
    }
  });

  it("tells the knitter to reset the row counter to the second shoulder's first row", () => {
    const startRcs = cases.map(({ options }) => {
      const result = generateSetInSleevePattern(pattern(options));
      const html = backChecklistHtml(result);
      const first = firstChecklistCounter(html, "First Shoulder Checklist");
      const second = firstChecklistCounter(html, "ns-shaping-chart--second-shoulder");
      expect(second.rc).toBe(first.rc);
      expect(second.side).not.toBe(first.side);
      expect(html).toContain(
        `Set the row counter to RC: ${second.rc} before beginning the Second Shoulder.`,
      );
      expect(html).toContain("cut yarn and return the");
      expect(html).toContain("held stitches for the second shoulder to working position");
      expect(html).toContain(
        "neckline shaping remains on the neck edge and shoulder shaping remains on the shoulder edge",
      );
      expect(html).toContain("Follow the second shoulder checklist below.");
      return second.rc;
    });
    expect(new Set(startRcs).size).toBeGreaterThan(1);
  });

  it("leaves the sleeveless transition without a row-counter reset", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      sleeveless.neckShoulderShapingChart!,
      "ns-shaping-chart-back",
      "",
      {
        activeSideOnly: true,
        includeCenterNecklineSetupRow: true,
        hideCenterNecklineSetupRow: true,
        tableHeading: "First Shoulder Checklist",
      },
    );
    expect(html).toContain("cut yarn and return the");
    expect(html).not.toContain("Set the row counter");
  });

  it("keeps the sleeveless back summary on separate center and shoulder ranges", () => {
    const data = pattern({});
    const style = { ...(data.style as Record<string, unknown>) };
    delete style.construction;
    delete style.constructionAuthored;
    delete style.sleeveDirection;
    const sleeveless = generateSleevelessBackPattern({ ...data, style });
    const summary = backNeckSummaryPlainText(sleeveless);
    expect(summary).toMatch(/Put the Second Shoulder needles L\d+ through L\d+ into hold/i);
    expect(summary).toMatch(/Work the First Shoulder on needles R\d+ through R\d+/i);
    expect(summary).not.toMatch(/Put needles L\d+ through R\d+ into hold/i);
  });

  it("connects the shared checklist renderer on the set-in pattern page", () => {
    const source = readFileSync("src/scripts/sleevelessPatternPageShared.ts", "utf8");
    const setIn = source.slice(
      source.indexOf("async function renderSetInSleeveMount"),
      source.indexOf("async function renderMount"),
    );
    expect(setIn).not.toContain("sg-overview");
    expect(setIn).not.toContain('"Overview"');
    expect(setIn).toContain('wrapPatternSection("sg-back", centerSeamApplied ? "BACK HALVES" : "BACK"');
    expect(setIn).toContain('mount.querySelector("#sg-neck-shoulder-chart-table-back")');
    expect(setIn).toContain("renderNeckShoulderShapingChartTableOnlyHtml");
    expect(setIn).toContain('tableHeading: "First Shoulder Checklist"');
    expect(setIn).toContain("window.kbmNeckShoulderChartPrintContext");
    expect(setIn).toContain("bindSecondShoulderChecklistToggles(mount)");
    expect(setIn).toContain("initChartProgressTracking");
    expect(setIn).toContain('mount.querySelector("#sg-neck-shoulder-chart-table-front")');
    expect(setIn).toContain("renderSleevelessPatternTabFrontChartTableHtml");
    expect(setIn).toContain("buildSleevelessRoundNeckShapingMapData");
    expect(setIn).toContain("buildSleevelessRoundNeckBackShapingMapData");
    expect(setIn).toContain("shapingMapData: backShapingMapData");
    expect(setIn).toContain("shapingMapNote: frontShapingMapNote");
    expect(setIn).toContain("front-neckline-shoulder-chart-print-btn");
    expect(setIn).toContain("resetRowCounterForSecondShoulder: true");
    expect(setIn).toMatch(/false,\s+true,\s+true,\s+setInBackNeckHelpCard/);
    expect(setIn).toContain("const frontHelpCardHtml = setInFrontNeckHelpCard;");
    expect(source).toContain("omitRepeatedNecklineSetup");
    const printCss = readFileSync("src/styles/ns-shaping-chart.css", "utf8");
    expect(printCss).toContain(".ns-shaping-chart__tabpanel[hidden]");
    expect(printCss).toContain(".ns-shaping-chart--second-shoulder[hidden]");
    expect(printCss).toContain("display: none !important;");
    expect(printCss).toContain("display: block !important;");
  });
});

describe("set-in front neckline and shoulder checklist", () => {
  const cases = [
    { label: "misses 7 round", options: { row: MISSES_7, neckline: "round" as const } },
    { label: "misses 7 v-neck", options: { row: MISSES_7, neckline: "v-neck" as const } },
    {
      label: "men 4x finer gauge",
      options: { row: MEN_4X, audience: "men", stitchesPerInch: 4, rowsPerInch: 6, neckline: "round" as const },
    },
    {
      label: "plus 6x high row gauge",
      options: {
        row: (plusSizes as ChartRow[]).find((row) => String(row.size) === "6x"),
        audience: "plus",
        stitchesPerInch: 6,
        rowsPerInch: 8,
        neckline: "v-neck" as const,
      },
    },
  ];

  it.each(cases)("renders the shared front checklist for $label", ({ options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    expect(result.frontDisplayRows.some((row) => row.kind === "section" && row.title === "FRONT NECKLINE & SHOULDERS")).toBe(true);
    expect(result.frontDisplayRows.some((row) => row.kind === "neckShoulderChartTableMount")).toBe(true);
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    const html = renderSleevelessPatternTabFrontChartTableHtml(result, {
      relocateIntro: options.neckline === "round",
      resetRowCounterForSecondShoulder: true,
      finishHeldNecklineAfterSecondShoulder: options.neckline === "round",
    });
    expect(html).toContain("Show Completed Rows");
    expect(html).toContain("Reset Checklist");
    expect(html).toContain("Done");
    expect(html).toContain(">RC");
    expect(html).not.toMatch(/ns-shaping-chart__row-counter-number">RC/);
    expect(html).toContain("Action");
    expect(html).toContain("Edge");
    expect(html).toContain("Sts Remaining");
    expect(html).toContain('type="checkbox"');
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    });
    const frontSummary = frontNeckSummaryPlainText(result);
    if (options.neckline === "round") {
      expect(frontSummary).toMatch(/Remove center neckline needles L\d+ through R\d+ from work|Place center neckline needles L\d+ through R\d+ in hold/i);
      expect(frontSummary).toMatch(/Put the Second Shoulder needles L\d+ through L\d+ into hold/i);
      expect(frontSummary).toMatch(/Work the First Shoulder on needles R\d+ through R\d+/i);
      expect(frontSummary).not.toMatch(/right shoulder|left shoulder|Stage [123]/i);
      const frontPage = stripTags(renderSleevelessFrontChartIntroHtml(result, "page"));
      const frontPrint = stripTags(renderSleevelessFrontChartIntroHtml(result, "print"));
      for (const intro of [frontPage, frontPrint]) {
        expect(intro).toContain("First Shoulder");
        expect(intro).toContain("Second Shoulder");
        expect(intro).toContain("neck edge");
        expect(intro).toContain("shoulder edge");
        expect(intro).not.toMatch(/right shoulder|left shoulder|Stage [123]|First Side|Second Side/i);
        expect(intro).not.toMatch(/removing the center \d+ neckline stitches/i);
      }
      expect(html).toContain("First Shoulder Checklist");
      expect(html).toContain("Second Shoulder Checklist");
      expect(html).toContain("ns-shaping-chart--second-shoulder");
      const secondHeading = html.indexOf("Second Shoulder Checklist");
      const finish = html.indexOf("Scrap off or bind off all remaining held neckline stitches.");
      expect(finish).toBeGreaterThan(secondHeading);
      expect(frontSummary).not.toMatch(/Scrap off or bind off all remaining held neckline stitches/i);
      const first = firstChecklistCounter(html, "First Shoulder Checklist");
      const second = firstChecklistCounter(html, "ns-shaping-chart--second-shoulder");
      expect(second.rc).toBe(first.rc);
      expect(second.side).not.toBe(first.side);
      expect(html).toContain(
        `Set the row counter to RC: ${second.rc} before beginning the Second Shoulder.`,
      );
      expect(html).toContain("cut yarn and return the");
      expect(html).toContain(
        "neckline shaping remains on the neck edge and shoulder shaping remains on the shoulder edge",
      );
      expect(map).not.toBeNull();
    } else {
      expect(html).toContain("First Side");
      expect(html).toContain("Second Side");
      expect(html).toContain('data-ns-shoulder-panel="first"');
      expect(html).toContain('data-ns-shoulder-panel="second"');
      const first = firstChecklistCounter(html, 'data-ns-shoulder-panel="first"');
      const second = firstChecklistCounter(html, 'data-ns-shoulder-panel="second"');
      expect(second.rc).toBe(first.rc);
      expect(html).toContain(`Set the row counter to RC: ${second.rc} before beginning the Second Side.`);
      expect(html).toContain(
        "Neckline shaping remains at the neck edge and shoulder shaping remains at the shoulder edge.",
      );
      const secondPanel = html.slice(html.indexOf('data-ns-shoulder-panel="second"'));
      expect(secondPanel).not.toContain("cut yarn");
      expect(map).toBeNull();
      expect(frontSummary).not.toMatch(/First Shoulder|Second Shoulder|right shoulder|left shoulder|Stage [123]/i);
      const vPage = stripTags(renderSleevelessFrontChartIntroHtml(result, "page"));
      const vPrint = stripTags(renderSleevelessFrontChartIntroHtml(result, "print"));
      for (const intro of [vPage, vPrint]) {
        expect(intro).toContain("First Side");
        expect(intro).toContain("Second Side");
        expect(intro).toContain("neck edge");
        expect(intro).toMatch(/At RC: \d{3},/);
        expect(intro).not.toMatch(/At RC \d{3},/);
        expect(intro).not.toMatch(/First Shoulder|Second Shoulder|right shoulder|left shoulder|Stage [123]/i);
      }
    }
    const rows = buildActiveSideInstructionTableRows(result.frontNeckShoulderShapingChart, 0, {
      includeCenterNecklineSetupRow: true,
    });
    expect(rows.some((row) => row.edge === "Neck")).toBe(true);
    expect(rows.some((row) => row.edge === "Shoulder" || row.edge === "Armhole")).toBe(true);
  });
});

describe("set-in learning resources", () => {
  function tipCount(
    rows: ReadonlyArray<{ kind: string; tipId?: string }>,
    tipId: string,
  ): number {
    return rows.filter((row) => row.kind === "block" && row.tipId === tipId).length;
  }

  function armholeBindOffHosts(rows: ReturnType<typeof generateSetInSleevePattern>["displayRows"]) {
    let inArmhole = false;
    const hosts: typeof rows = [];
    for (const row of rows) {
      if (row.kind === "section" && row.title === "ARMHOLE") {
        inArmhole = true;
        continue;
      }
      if (inArmhole && row.kind === "section") break;
      if (inArmhole && row.kind === "block" && row.tipId === SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID) {
        hosts.push(row);
      }
    }
    return hosts;
  }

  const variations = [
    { label: "misses round pullover", options: { row: MISSES_7, neckline: "round" as const, garmentStyle: "pullover" as const } },
    { label: "misses round cardigan", options: { row: MISSES_7, neckline: "round" as const, garmentStyle: "cardigan" as const } },
    { label: "misses v-neck pullover", options: { row: MISSES_7, neckline: "v-neck" as const, garmentStyle: "pullover" as const } },
    { label: "misses v-neck cardigan", options: { row: MISSES_7, neckline: "v-neck" as const, garmentStyle: "cardigan" as const } },
    { label: "men round pullover", options: { row: MEN_4X, audience: "men", neckline: "round" as const, garmentStyle: "pullover" as const } },
    { label: "men round cardigan", options: { row: MEN_4X, audience: "men", neckline: "round" as const, garmentStyle: "cardigan" as const } },
    { label: "men v-neck pullover", options: { row: MEN_4X, audience: "men", neckline: "v-neck" as const, garmentStyle: "pullover" as const } },
    { label: "men v-neck cardigan", options: { row: MEN_4X, audience: "men", neckline: "v-neck" as const, garmentStyle: "cardigan" as const } },
  ];

  it.each(variations)("places the bind-off tip once on the back armhole for $label", ({ options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    const hosts = armholeBindOffHosts(result.displayRows);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]?.paragraphs?.[0]).toMatch(/\bbind off\b/i);
    expect(tipCount(result.displayRows, SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID)).toBe(1);
    expect(tipCount(result.frontDisplayRows, SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID)).toBe(0);
    expect(tipCount(result.sleeveDisplayRows, SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID)).toBe(0);
    expect(tipCount(result.displayRows, ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID)).toBe(1);
    expect(tipCount(result.frontDisplayRows, ROUND_BACK_NECKLINE_SHAPING_VIDEO_TIP_ID)).toBe(0);

    const backHtml = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    const printHtml = renderSleevelessPrintPieceHtml(result.displayRows, "", "back");
    expect(backHtml).toContain(`data-tip-id="${SET_IN_BACK_ARMHOLE_BIND_OFF_TIP_ID}"`);
    expect(backHtml).toContain('data-content-id="5002"');
    expect(printHtml).toContain("Bind Off Trick");
    expect(printHtml).toContain("optional transfer trick");
    expect(printHtml).toContain('class="pattern-finishing-video-help pattern-help-link no-print"');
    expect(printHtml).toContain("<details open ");
    expect(backHtml).toContain(`data-glossary-id="${EWRAP_CAST_ON_GLOSSARY_ID}"`);
    expect(backHtml).toContain(`data-glossary-id="${LIFELINE_GLOSSARY_ID}"`);
    expect(backHtml).not.toContain("hold stitches or use short-row shaping");
  });

  it.each(variations)("keeps one orientation card on the front for $label", ({ label, options }) => {
    const result = generateSetInSleevePattern(pattern(options));
    expect(tipCount(result.frontDisplayRows, SET_IN_NECKLINE_ORIENTATION_TIP_ID), label).toBe(1);
    const html = renderPatternDisplayRowsHtml(result.frontDisplayRows, { pieceSectionId: "front" });
    expect(html).toContain("Understanding Left, Right & Diagram Orientation");
    expect(html).toContain(`data-tip-id="${SET_IN_NECKLINE_ORIENTATION_TIP_ID}"`);
  });

  it("does not add the orientation card to a sleeveless V-neck pullover", () => {
    const sleeveless = generateSleevelessBackPattern(
      pattern({ row: MISSES_7, neckline: "v-neck", garmentStyle: "pullover" }),
    );
    expect(tipCount(sleeveless.frontDisplayRows, SET_IN_NECKLINE_ORIENTATION_TIP_ID)).toBe(0);
  });
});

describe("set-in sleeve center seams", () => {
  function withCenterSeams(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, style: { ...(data.style as object), centerSeams: true } };
  }

  function castOnNumbers(rows: ReadonlyArray<{ kind: string; paragraphs?: string[] }>): number[] {
    return rows
      .flatMap((row) => row.paragraphs ?? [])
      .map((line) => line.match(/Cast on (\d+) stitches/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => Number(match[1]));
  }

  it("keeps a fitting pattern as one full back and one full front", () => {
    const result = generateSetInSleevePattern(pattern({}));
    expect(result.centerSeams).toBeUndefined();
    expect(textOf(result.displayRows)).not.toContain("LEFT BACK");
    expect(textOf(result.displayRows)).toContain("Bind off");
    expect(result.needleCapacity?.fitsAsWritten).toBe(true);
    expect(result.needleCapacity?.offerSeams).toBe(false);
  });

  it("offers seams when the body is too wide and the halves fit", () => {
    const result = generateSetInSleevePattern(pattern({ availableNeedles: 80 }));
    expect(result.needleCapacity?.shouldBlock).toBe(true);
    expect(result.needleCapacity?.offerSeams).toBe(true);
    expect(textOf(result.displayRows)).toContain("Bind off");
  });

  it("splits a round pullover into four halves and keeps the sleeve", () => {
    const full = generateSetInSleevePattern(pattern({ availableNeedles: 80 }));
    const seamed = generateSetInSleevePattern(withCenterSeams(pattern({ availableNeedles: 80 })));
    expect(seamed.centerSeams?.applied).toBe(true);
    expect(seamed.centerSeams?.splitFront).toBe(true);
    const back = textOf(seamed.displayRows);
    const front = textOf(seamed.frontDisplayRows);
    expect(back).toContain("First Back Half");
    expect(back).toContain("Second Back Half");
    expect(front).toContain("First Front Half");
    expect(front).toContain("Second Front Half");
    expect(back).not.toContain("LEFT BACK");
    expect(back).not.toContain("RIGHT BACK");
    expect(front).not.toContain("LEFT FRONT");
    expect(back).toContain("seam stitch");
    const rightBack = back.slice(back.indexOf("Second Back Half"));
    const leftBack = back.slice(0, back.indexOf("Second Back Half"));
    expect(leftBack).toContain("Center back edge: right");
    expect(leftBack).toContain("Side seam / armhole edge: left");
    expect(leftBack).toContain("Center back neckline: carriage on the right");
    expect(leftBack).toContain("Armhole: carriage on the left");
    expect(rightBack).toContain("Center back edge: left");
    expect(rightBack).toContain("Side seam / armhole edge: right");
    expect(rightBack).toContain("Center back neckline: carriage on the left");
    expect(rightBack).toContain("Armhole: carriage on the right");
    expect(back).not.toMatch(/reverse shaping/i);
    expect(back).toContain("BACK NECKLINE");
    expect(back).not.toContain("FRONT NECKLINE");
    const rightFront = front.slice(front.indexOf("Second Front Half"));
    const leftFront = front.slice(0, front.indexOf("Second Front Half"));
    expect(leftFront).toContain("Center front edge: right");
    expect(leftFront).toContain("Center front neckline: carriage on the right");
    expect(rightFront).toContain("Center front edge: left");
    expect(rightFront).toContain("Center front neckline: carriage on the left");
    expect(front).not.toContain("Center back neckline");
    const stitchPatternNote =
      "If using automatic patterning, check the position of your stitch pattern on each garment piece so the repeats match across the seams.";
    for (const half of [leftBack, rightBack, leftFront, rightFront]) {
      expect(half).toContain("Reset the row counter to 000. From this point, follow the Armhole RC numbers.");
      expect(half).not.toContain("After the armhole reset");
    }
    for (const half of [leftBack, leftFront]) {
      expect(half).toContain("Position on the needle bed");
      expect(half).not.toContain(stitchPatternNote);
      expect(half).not.toContain("Stitch pattern placement");
    }
    for (const half of [rightBack, rightFront]) {
      expect(half).not.toContain(stitchPatternNote);
      expect(half).not.toContain("Stitch pattern placement");
    }
    for (const [rows, title, piece] of [
      [seamed.displayRows, "First Back Half", "back"],
      [seamed.frontDisplayRows, "First Front Half", "front"],
    ] as const) {
      const start = rows.findIndex((row) => row.kind === "section" && row.title === title);
      const next = rows.findIndex(
        (row, index) => index > start && row.kind === "section" && row.title.endsWith(" Half"),
      );
      const halfRows = rows.slice(start, next);
      const tipIndex = halfRows.findIndex(
        (row) => row.kind === "block" && row.tipId === `set-in-center-seam-stitch-pattern-${piece}`,
      );
      const positionIndex = halfRows.findIndex(
        (row) => row.kind === "block" && row.paragraphs?.includes("Position on the needle bed"),
      );
      expect(tipIndex).toBeGreaterThan(0);
      expect(positionIndex).toBe(tipIndex + 1);
      const tip = halfRows[tipIndex];
      expect(tip?.kind).toBe("block");
      if (tip?.kind !== "block") continue;
      expect(tip.tipPresentation).toBe("quick-tip");
      expect(tip.tipHtmlIsFull).toBe(true);
      expect(tip.paragraphs).toEqual([]);
      expect(tip.tipHtml).toContain(stitchPatternNote);
      expect(tip.tipHtml).toContain("fa-lightbulb");
      expect(tip.tipHtml).toContain('class="pattern-quick-tip__details"');
      expect(tip.tipHtml).not.toContain("<details open");
    }
    expect(textOf(full.displayRows)).not.toContain("Stitch pattern placement");
    expect(textOf(seamed.sleeveDisplayRows)).not.toContain("Stitch pattern placement");
    expect(textOf(seamed.sleeveDisplayRows)).toContain("Bind off");
    const fullHem = full.debug.hemCastOnStitches ?? 0;
    const halves = castOnNumbers(seamed.displayRows);
    expect(halves).toHaveLength(2);
    expect(halves[0]! + halves[1]! - 2).toBe(fullHem);
    expect(halves[0]!).toBeGreaterThanOrEqual(halves[1]!);
    const print = renderSleevelessPrintPieceHtml(seamed.displayRows, "", "back");
    expect(print).toContain("First Back Half");
    expect(print).toContain("Second Back Half");
    expect(print).toContain("Center back edge: right");
    expect(print).toContain("Center back edge: left");
    expect(print).toContain('data-glossary-id="605"');
    expect(print.match(/data-glossary-id="605"/g)).toHaveLength(2);
    expect(print).toContain(">seaming stitch<");
    expect(print.match(/Stitch pattern placement/g)).toHaveLength(1);
    expect(print).toContain(stitchPatternNote);
    expect(print).toContain('data-tip-id="set-in-center-seam-stitch-pattern-back"');
    expect(print).toContain('class="pattern-tip pattern-quick-tip"');
    expect(print).toContain("fa-lightbulb");
    expect(print).toContain("<details open ");
    const secondBackPrint = print.slice(print.indexOf("Second Back Half"));
    expect(secondBackPrint).not.toContain("Stitch pattern placement");
    expect(secondBackPrint).not.toContain(stitchPatternNote);
    const backScreen = renderPatternDisplayRowsHtml(seamed.displayRows, { pieceSectionId: "back" });
    const backTipAt = backScreen.indexOf('data-tip-id="set-in-center-seam-stitch-pattern-back"');
    const backPositionAt = backScreen.indexOf("Position on the needle bed");
    expect(backScreen.indexOf("Knit the back in two pieces")).toBeLessThan(backTipAt);
    expect(backTipAt).toBeGreaterThan(-1);
    expect(backPositionAt).toBeGreaterThan(backTipAt);
    expect(backScreen.slice(backTipAt, backPositionAt)).not.toContain("Cast on");
    expect(backScreen.match(/set-in-center-seam-stitch-pattern-back/g)).toHaveLength(1);
    expect(backScreen).not.toContain("set-in-center-seam-stitch-pattern-front");
    const frontPrint = renderSleevelessPrintPieceHtml(seamed.frontDisplayRows, "", "front");
    expect(frontPrint.match(/data-glossary-id="605"/g)).toHaveLength(2);
    expect(frontPrint.match(/Stitch pattern placement/g)).toHaveLength(1);
    expect(frontPrint).toContain(stitchPatternNote);
    expect(frontPrint).toContain('data-tip-id="set-in-center-seam-stitch-pattern-front"');
    expect(frontPrint).toContain('class="pattern-tip pattern-quick-tip"');
    expect(frontPrint).toContain("<details open ");
    const secondFrontPrint = frontPrint.slice(frontPrint.indexOf("Second Front Half"));
    expect(secondFrontPrint).not.toContain("Stitch pattern placement");
    const frontScreen = renderPatternDisplayRowsHtml(seamed.frontDisplayRows, { pieceSectionId: "front" });
    const frontTipAt = frontScreen.indexOf('data-tip-id="set-in-center-seam-stitch-pattern-front"');
    const frontPositionAt = frontScreen.indexOf("Position on the needle bed");
    expect(frontScreen.indexOf("Knit the front in two pieces")).toBeLessThan(frontTipAt);
    expect(frontPositionAt).toBeGreaterThan(frontTipAt);
    expect(frontScreen.match(/set-in-center-seam-stitch-pattern-front/g)).toHaveLength(1);
    const finishing = sleevelessFinishingFromPattern(withCenterSeams(pattern({})), seamed.debug);
    const html = buildSleevelessFinishingStepsHtml({ ...finishing, deps: finishingDeps });
    expect(html).toContain("First Front Half");
    expect(html).toContain("Second Front Half");
    expect(html).toContain("center front edge");
    expect(html).toContain("First Back Half");
    expect(html).toContain("center back edge");
  });

  it("keeps cardigan fronts and splits only the back", () => {
    const full = generateSetInSleevePattern(pattern({ garmentStyle: "cardigan", availableNeedles: 80 }));
    const seamed = generateSetInSleevePattern(
      withCenterSeams(pattern({ garmentStyle: "cardigan", availableNeedles: 80 })),
    );
    expect(seamed.centerSeams?.splitFront).toBe(false);
    expect(textOf(seamed.frontDisplayRows)).toBe(textOf(full.frontDisplayRows));
    expect(textOf(seamed.displayRows)).toContain("First Back Half");
    expect(textOf(seamed.displayRows)).toContain("Second Back Half");
    expect(textOf(seamed.frontDisplayRows)).toContain("LEFT FRONT");
    expect(textOf(seamed.displayRows)).toContain("seam stitch");
    const secondStart = seamed.displayRows.findIndex(
      (row) => row.kind === "section" && row.title === "Second Back Half",
    );
    const firstBackRows = seamed.displayRows.slice(0, secondStart);
    const tipIndex = firstBackRows.findIndex(
      (row) => row.kind === "block" && row.tipId === "set-in-center-seam-stitch-pattern-back",
    );
    const positionIndex = firstBackRows.findIndex(
      (row) => row.kind === "block" && row.paragraphs?.includes("Position on the needle bed"),
    );
    expect(tipIndex).toBeGreaterThan(0);
    expect(positionIndex).toBe(tipIndex + 1);
    expect(
      seamed.displayRows.slice(secondStart).some(
        (row) => row.kind === "block" && row.tipId === "set-in-center-seam-stitch-pattern-back",
      ),
    ).toBe(false);
    expect(textOf(seamed.displayRows.slice(secondStart))).not.toContain("Stitch pattern placement");
    expect(seamed.frontDisplayRows.some((row) => row.kind === "block" && row.tipHtml?.includes("Stitch pattern placement"))).toBe(
      false,
    );
    expect(textOf(seamed.frontDisplayRows)).not.toContain("Stitch pattern placement");
    expect(textOf(seamed.sleeveDisplayRows)).not.toContain("Stitch pattern placement");
    const finishing = sleevelessFinishingFromPattern(
      withCenterSeams(pattern({ garmentStyle: "cardigan" })),
      seamed.debug,
    );
    expect(buildSleevelessFinishingPrintListHtml(finishing)).toContain("First Back Half");
    expect(buildSleevelessFinishingPrintListHtml(finishing)).toContain("center back edge");
    expect(buildSleevelessFinishingPrintListHtml(finishing)).not.toContain("First Front Half");
    expect(buildSleevelessFinishingPrintListHtml(finishing)).not.toContain("center front edge");
  });

  it("writes a V-neck pullover half from the center edge", () => {
    const full = generateSetInSleevePattern(pattern({ neckline: "v-neck", availableNeedles: 200 }));
    const seamed = generateSetInSleevePattern(
      withCenterSeams(pattern({ neckline: "v-neck", availableNeedles: 80 })),
    );
    const front = textOf(seamed.frontDisplayRows);
    expect(front).toContain("First Front Half");
    expect(front).toContain("Second Front Half");
    expect(front).toContain("The first decrease at the center front edge removes that seam stitch.");
    expect(front).not.toContain("Center back neckline");
    expect(front).not.toContain("could not be scheduled");
    expect(front).not.toMatch(/exceed/i);
    const shoulders = [...front.matchAll(/(\d+) shoulder stitches remain/g)].map((match) => Number(match[1]));
    expect(shoulders).toEqual([full.debug.shoulderStitches, full.debug.shoulderStitches]);
    const expectedDecreases = Math.round((full.debug.necklineStitches ?? 0) / 2) + 1;
    const left = front.slice(0, front.indexOf("Second Front Half"));
    const right = front.slice(front.indexOf("Second Front Half"));
    expect(left).toContain("Center front edge decreases: carriage on the right");
    expect(right).toContain("Center front edge decreases: carriage on the left");
    for (const half of [left, right]) {
      const line = half.match(/Decrease 1 stitch at the center front edge on row ([^.]+)\./);
      expect(line?.[1]?.split(",").filter((part) => part.trim()).length).toBe(expectedDecreases);
    }
  });

  it("keeps A-line shaping on the armhole edge of each half", () => {
    const seamed = generateSetInSleevePattern(
      withCenterSeams(pattern({ bodyShape: "aline", availableNeedles: 90 })),
    );
    expect(seamed.centerSeams?.applied).toBe(true);
    expect(textOf(seamed.displayRows)).toContain("at the side seam edge");
    expect(textOf(seamed.displayRows)).toContain("armhole edge");
    expect(textOf(seamed.displayRows)).not.toContain("at each side edge");
  });

  it("does not render a pattern when the sleeve is wider than the machine", () => {
    const row = { ...MISSES_7, upper_arm: 40 };
    const seamed = generateSetInSleevePattern(
      withCenterSeams(pattern({ row, availableNeedles: 80 })),
    );
    expect(seamed.centerSeams?.applied).toBe(false);
    expect(textOf(seamed.displayRows)).not.toContain("Cast on");
    expect(seamed.sleeveDisplayRows).toEqual([]);
  });

  it("uses the Women's 6X garment length from the chart", () => {
    const row = (plusSizes as ChartRow[]).find((item) => String(item.size) === "6x");
    const result = generateSetInSleevePattern(pattern({ audience: "plus", row, availableNeedles: 400 }));
    expect(result.debug.backNeckToHem).toBe(28);
    expect(result.centerSeams).toBeUndefined();
  });

  it("splits an even body into equal halves and keeps an odd width's extra stitch on the left", () => {
    const full = generateSetInSleevePattern(pattern({ availableNeedles: 400 }));
    const hem = full.debug.hemCastOnStitches ?? 0;
    expect(hem % 2).toBe(0);
    const seamed = generateSetInSleevePattern(withCenterSeams(pattern({ availableNeedles: 80 })));
    expect(castOnNumbers(seamed.displayRows)).toEqual([hem / 2 + 1, hem / 2 + 1]);
    expect(centerSeamHalfStitches(101, "left", true)).toBe(52);
    expect(centerSeamHalfStitches(101, "right", true)).toBe(51);
  });

  it("fits at the written needle count and blocks one needle below a seamed half", () => {
    const wide = generateSetInSleevePattern(pattern({ availableNeedles: 400 }));
    const backNeed = wide.needleCapacity?.pieces.find((piece) => piece.id === "back")?.requiredNeedles ?? 0;
    const exact = generateSetInSleevePattern(pattern({ availableNeedles: backNeed }));
    expect(exact.needleCapacity?.fitsAsWritten).toBe(true);
    expect(exact.needleCapacity?.offerSeams).toBe(false);
    const oneUnder = generateSetInSleevePattern(pattern({ availableNeedles: backNeed - 1 }));
    expect(oneUnder.needleCapacity?.fitsAsWritten).toBe(false);
    expect(oneUnder.needleCapacity?.offerSeams).toBe(true);
    const seamedNeed = Math.max(
      ...(oneUnder.needleCapacity?.seamedPieces ?? []).map((piece) => piece.requiredNeedles),
    );
    expect(seamedNeed).toBeGreaterThan(0);
    expect(seamedNeed).toBeLessThan(backNeed);
    const atHalf = generateSetInSleevePattern(withCenterSeams(pattern({ availableNeedles: seamedNeed })));
    expect(atHalf.centerSeams?.applied).toBe(true);
    const belowHalf = generateSetInSleevePattern(
      withCenterSeams(pattern({ availableNeedles: seamedNeed - 1 })),
    );
    expect(belowHalf.centerSeams?.applied).toBe(false);
    expect(belowHalf.needleCapacity?.offerSeams).toBe(false);
  });

  it("repeats the same halves when the saved center-seam choice is reopened", () => {
    const saved = withCenterSeams(pattern({ availableNeedles: 80 }));
    const first = textOf(generateSetInSleevePattern(saved).displayRows);
    const second = textOf(generateSetInSleevePattern(saved).displayRows);
    expect(second).toBe(first);
    expect(first).toContain("First Back Half");
  });

  it("writes matching first and second halves for a 68-inch bust at 28 stitches and 44 rows per 4 inches on 200 needles", () => {
    const row = (plusSizes as ChartRow[]).find((item) => String(item.size) === "6x");
    const input = pattern({
      audience: "plus",
      row,
      fit: "relaxed",
      stitchesPerInch: 7,
      rowsPerInch: 11,
      availableNeedles: 200,
    });
    const plain = generateSetInSleevePattern(input);
    expect(plain.debug.finishedBustChest).toBe(68);
    expect(plain.needleCapacity?.fitsAsWritten).toBe(false);
    expect(plain.needleCapacity?.seamsFit).toBe(true);
    const result = generateSetInSleevePattern(withCenterSeams(input));
    expect(result.centerSeams?.applied).toBe(true);
    expect(result.centerSeams?.splitFront).toBe(true);
    const back = textOf(result.displayRows);
    const front = textOf(result.frontDisplayRows);
    const firstBack = back.slice(0, back.indexOf("Second Back Half"));
    const secondBack = back.slice(back.indexOf("Second Back Half"));
    const firstFront = front.slice(0, front.indexOf("Second Front Half"));
    const secondFront = front.slice(front.indexOf("Second Front Half"));
    expect(firstBack).toContain("Center back edge: right");
    expect(firstBack).toContain("Side seam / armhole edge: left");
    expect(firstBack).toContain("Armhole: carriage on the left");
    expect(secondBack).toContain("Center back edge: left");
    expect(secondBack).toContain("Side seam / armhole edge: right");
    expect(secondBack).toContain("Armhole: carriage on the right");
    expect(firstFront).toContain("Center front edge: right");
    expect(secondFront).toContain("Center front edge: left");
    expect(front).not.toContain("Center back neckline");
    expect(back).not.toMatch(/reverse shaping/i);
    for (const half of [firstBack, secondBack, firstFront, secondFront]) {
      expect(half.match(/Reset the row counter to 000/g)).toHaveLength(1);
    }
    const print = renderSleevelessPrintPieceHtml(result.displayRows, "", "back");
    expect(print).toContain("First Back Half");
    expect(print).toContain("Second Back Half");
    expect(print).toContain("Center back edge: right");
    expect(print).toContain("Center back edge: left");
    const halves = castOnNumbers(result.displayRows);
    expect(halves).toHaveLength(2);
    expect(Math.max(...halves)).toBeLessThanOrEqual(200);
  });

  it("draws each center-seam half from that half's own shaping", () => {
    const row = (plusSizes as ChartRow[]).find((item) => String(item.size) === "6x");
    const input = withCenterSeams(
      pattern({
        audience: "plus",
        row,
        fit: "relaxed",
        stitchesPerInch: 7,
        rowsPerInch: 11,
        availableNeedles: 200,
      }),
    );
    const asHalf = (piece: "back" | "front") => {
      const style = {
        ...(input.style as object),
        garmentStyle: "cardigan",
        frontStyle: "open",
        ...(piece === "back" ? { neckline: "round" } : {}),
      };
      const fit = { ...(input.fit as object) } as { selectedMeasurements?: Record<string, unknown> };
      const measurements = { ...(fit.selectedMeasurements ?? {}) };
      if (piece === "back") {
        const depth = measurements.back_neck_depth ?? measurements.backNeckDepth;
        measurements.front_neck_depth = depth;
        measurements.frontNeckDepth = depth;
      }
      return { ...input, style, fit: { ...fit, selectedMeasurements: measurements } };
    };
    const outline = (svg: string | null) => svg?.match(/ d="([^"]+)"/)?.[1];
    const leftBack = generateSetInSleeveCenterSeamHalf(input, "back", "left");
    const rightBack = generateSetInSleeveCenterSeamHalf(input, "back", "right");
    const leftFront = generateSetInSleeveCenterSeamHalf(input, "front", "left");
    const rightFront = generateSetInSleeveCenterSeamHalf(input, "front", "right");
    const backData = asHalf("back");
    const frontData = asHalf("front");
    const firstBack = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(leftBack, backData, "in", {
      pieceLabel: "First Back Half",
      centerEdge: "right",
      centerEdgeName: "center back edge",
    });
    const secondBack = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(rightBack, backData, "in", {
      pieceLabel: "Second Back Half",
      centerEdge: "left",
      centerEdgeName: "center back edge",
    });
    const firstFront = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(leftFront, frontData, "in", {
      pieceLabel: "First Front Half",
      centerEdge: "right",
      centerEdgeName: "center front edge",
    });
    const secondFront = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(rightFront, frontData, "in", {
      pieceLabel: "Second Front Half",
      centerEdge: "left",
      centerEdgeName: "center front edge",
    });
    for (const svg of [firstBack, secondBack, firstFront, secondFront]) {
      expect(svg).toContain('data-hem-sts="120"');
      expect(svg).toContain('data-after-armhole-sts="68"');
      expect(svg).toContain('data-bind-off-sts="34"');
      expect(svg).toContain('data-decrease-sts="18"');
      expect(svg).toContain('data-total-rows="308"');
    }
    for (const svg of [firstBack, secondBack]) {
      expect(svg).toContain('data-neck-sts="31"');
      expect(svg).toContain('data-shoulder-sts="37"');
      expect(svg).toContain('data-neck-depth-rows="12"');
    }
    for (const svg of [firstFront, secondFront]) {
      expect(svg).toContain('data-neck-sts="31"');
      expect(svg).toContain('data-shoulder-sts="37"');
      expect(svg).toContain('data-neck-depth-rows="78"');
    }
    expect(firstBack).toContain("Center back edge: right");
    expect(firstBack).toContain("Side seam / armhole edge: left");
    expect(secondBack).toContain("Center back edge: left");
    expect(secondBack).toContain("Side seam / armhole edge: right");
    expect(firstFront).toContain("Center front edge: right");
    expect(secondFront).toContain("Center front edge: left");
    expect(outline(firstBack)).not.toBe(outline(secondBack));
    expect(outline(firstFront)).not.toBe(outline(secondFront));

    const backNotation = tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(leftBack, backData);
    const frontNotation = tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(leftFront, frontData);
    const mirroredBack = backNotation ? orientCenterSeamDiagramSvg(backNotation, "right") : null;
    const mirroredFront = frontNotation ? orientCenterSeamDiagramSvg(frontNotation, "right") : null;
    const innerAmounts = (half: { frontNeckShoulderTimeline?: { events: { edge: string; amount: number }[] }[] }) => {
      const amounts: number[] = [];
      for (const row of half.frontNeckShoulderTimeline ?? []) {
        let amount = 0;
        for (const event of row.events) {
          if (event.edge === "outer" || event.amount <= 0) continue;
          amount += event.amount;
        }
        if (amount > 0) amounts.push(amount);
      }
      return amounts;
    };
    const outerSum = (half: { frontNeckShoulderTimeline?: { events: { edge: string; amount: number }[] }[] }) =>
      (half.frontNeckShoulderTimeline ?? []).reduce(
        (sum, row) =>
          sum +
          row.events.reduce(
            (rowSum, event) => rowSum + (event.edge === "outer" && event.amount > 0 ? event.amount : 0),
            0,
          ),
        0,
      );
    expect(innerAmounts(leftBack)).toEqual([16, 3, 3, 3, 2, 2, 2]);
    expect(innerAmounts(rightBack)).toEqual([16, 3, 3, 3, 2, 2, 2]);
    expect(outerSum(leftBack)).toBe(37);
    expect(outerSum(rightBack)).toBe(37);
    expect(outerSum(leftFront)).toBe(37);
    expect(outerSum(rightFront)).toBe(37);
    expect(backNotation).toContain('data-neck-sts="31"');
    expect(backNotation).toContain('data-shoulder-sts="37"');
    expect(backNotation).toContain('data-neck-bo="bo16"');
    expect(backNotation).toContain(">3s-2r-3x<");
    expect(backNotation).toContain(">2s-2r-3x<");
    expect(backNotation).not.toContain(">2s-2r-4x<");
    expect(backNotation).not.toContain(">bo15<");
    expect(frontNotation).toContain('data-neck-sts="31"');
    expect(frontNotation).toContain('data-shoulder-sts="37"');
    expect(frontNotation).toContain('data-neck-bo="bo11"');
    expect(frontNotation).toContain(">2s-2r-5x<");
    expect(frontNotation).not.toContain(">bo10<");
    expect(outline(mirroredBack)).not.toBe(outline(backNotation));
    expect(outline(mirroredFront)).not.toBe(outline(frontNotation));
  });
});
