/**
 * Dev-only QA matrix for drop-shoulder pattern math (body, sleeves, notation, finishing).
 * Uses production `generateDropShoulderPattern` — no parallel math model.
 */

import { resolveEffectiveCuffDepthInches } from "../customBuildEffectiveCuffDepth";
import { resolveEffectiveHemDepthInches } from "../customBuildEffectiveHemDepth";
import { calculateCuffRowsFromInches, calculateHemRowsFromInches, roundUpToEvenRows } from "../hemDefaults";
import { computeDropShoulderArmholeDepthInches } from "../dropShoulderArmholeDepth";
import {
  buildDropShoulderBackJapaneseNotationReplacements,
  buildDropShoulderFrontJapaneseNotationReplacements,
  isDropShoulderBodyJapaneseNotationSupported,
} from "../dropShoulderBodyJapaneseNotation";
import { buildDropShoulderBodyDiagramReplacements } from "../dropShoulderBodyNotationSvg";
import type { DropShoulderSleeveDirection } from "../dropShoulderSleeveConstruction";
import {
  generateDropShoulderPattern,
  type DropShoulderPatternResult,
} from "../dropShoulderPatternOutput";
import { resolveEffectiveFinishedBustInches } from "../customBuildEffectiveFinishedBust";
import { sleeveEvenShapingSchedule } from "../evenShapingSchedule";
import { buildDropShoulderSleeveJapaneseNotationReplacements } from "../sleevelessGarmentDiagramReplacements";
import type { SleevelessPatternDisplayRow } from "../sleevelessPatternOutput";
import { sleevelessFinishingFromPattern } from "../sleevelessPatternFinishing";
import {
  buildRowAccountingInputFromDebug,
  validateRowAccounting,
  type RowAccountingSeverity,
} from "../sleevelessRowAccounting";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { extractCastOnFromRows } from "./sleevelessPatternQaMatrix";

export type DropShoulderQaGaugeProfile = {
  id: string;
  label: string;
  gaugeStitchesPerInch: number;
  gaugeRowsPerInch: number;
};

export type DropShoulderQaScenarioId =
  | "mens-med-16-24-pullover-round"
  | "mens-med-16-24-pullover-v"
  | "mens-med-16-24-cardigan-round"
  | "mens-med-16-24-cardigan-v"
  | "mens-med-5-7-pullover-round"
  | "mens-med-5-7-pullover-round-top-down"
  | "misses-8-5-7-pullover-round"
  | "misses-8-5-7-pullover-v"
  | "misses-8-5-7-cardigan-round"
  | "misses-8-7-7-pullover-round"
  | "mens-med-16-24-cardigan-round-top-down";

export type DropShoulderQaScenario = {
  id: DropShoulderQaScenarioId;
  label: string;
  profileLabel: string;
  patternData: Record<string, unknown>;
  sleeveDirection?: DropShoulderSleeveDirection;
};

/** Men's Med — matches `public/data/sizing_sweaters_men.json`. */
const MENS_MED_CHART_ROW: ChartRow = {
  size: "Med",
  bust_or_chest: 36,
  waist: 30,
  hip: 19.25,
  garment_back_length: 26,
  armhole_depth: 9,
  shoulder_width: 16.5,
  neck_opening: 6.5,
  front_neck_depth: 4.25,
  back_neck_depth: 1,
  upper_arm: 13,
  wrist: 6.5,
  sleeve_length: 18.25,
};

/** Misses size 8 — matches `public/data/sizing_sweaters_misses.json`. */
const MISSES_8_CHART_ROW: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  waist: 33,
  hip: 44,
  garment_back_length: 25,
  armhole_depth: 8,
  shoulder_width: 14.25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12.5,
  wrist: 6.25,
  sleeve_length: 17,
};

export const DROP_SHOULDER_QA_GAUGE_16_24: DropShoulderQaGaugeProfile = {
  id: "16-24",
  label: '16 sts / 24 rows over 4" (4 spi, 6 rpi)',
  gaugeStitchesPerInch: 4,
  gaugeRowsPerInch: 6,
};

export const DROP_SHOULDER_QA_GAUGE_5_7: DropShoulderQaGaugeProfile = {
  id: "5-7",
  label: "5 spi, 7 rpi",
  gaugeStitchesPerInch: 5,
  gaugeRowsPerInch: 7,
};

export const DROP_SHOULDER_QA_GAUGE_7_7: DropShoulderQaGaugeProfile = {
  id: "7-7",
  label: "7 spi, 7 rpi",
  gaugeStitchesPerInch: 7,
  gaugeRowsPerInch: 7,
};

function forceEven(n: number): number {
  const r = Math.max(0, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}

function buildDropShoulderQaPatternData(args: {
  chartRow: ChartRow;
  sizingChart: string;
  selectedSize: string | number;
  easeChoice: string;
  gauge: DropShoulderQaGaugeProfile;
  neckline: "round" | "v";
  garmentStyle?: "cardigan";
}): Record<string, unknown> {
  const style: Record<string, unknown> = {
    construction: "drop-shoulder",
    constructionAuthored: "drop-shoulder",
    recipientCategory: args.sizingChart,
    neckline: args.neckline === "v" ? "v" : "round",
    bodyShape: "straight",
    frontStyle: args.garmentStyle === "cardigan" ? "open" : "closed",
    ...(args.garmentStyle === "cardigan" ? { garmentStyle: "cardigan" } : {}),
  };
  return {
    fit: {
      sizingChart: args.sizingChart,
      selectedSize: args.selectedSize,
      easeChoice: args.easeChoice,
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(args.chartRow, args.easeChoice, {
        bodyShape: "straight",
      }),
    },
    style,
    yarnGaugeMachine: {
      gaugeStitchesPerInch: args.gauge.gaugeStitchesPerInch,
      gaugeRowsPerInch: args.gauge.gaugeRowsPerInch,
      availableNeedles: 200,
    },
  };
}

function scenario(
  id: DropShoulderQaScenarioId,
  label: string,
  profileLabel: string,
  patternData: Record<string, unknown>,
  sleeveDirection?: DropShoulderSleeveDirection,
): DropShoulderQaScenario {
  return { id, label, profileLabel, patternData, sleeveDirection };
}

/** All canned drop-shoulder QA scenarios — extend to grow coverage. */
export const DROP_SHOULDER_QA_SCENARIOS: readonly DropShoulderQaScenario[] = [
  scenario(
    "mens-med-16-24-pullover-round",
    "Men's Med close · 16/24 · pullover round · cuff-up",
    "Men's Med, close fit, 16/24 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_16_24,
      neckline: "round",
    }),
  ),
  scenario(
    "mens-med-16-24-pullover-v",
    "Men's Med close · 16/24 · pullover V · cuff-up",
    "Men's Med, close fit, 16/24 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_16_24,
      neckline: "v",
    }),
  ),
  scenario(
    "mens-med-16-24-cardigan-round",
    "Men's Med close · 16/24 · cardigan round · cuff-up",
    "Men's Med, close fit, 16/24 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_16_24,
      neckline: "round",
      garmentStyle: "cardigan",
    }),
  ),
  scenario(
    "mens-med-16-24-cardigan-v",
    "Men's Med close · 16/24 · cardigan V · cuff-up",
    "Men's Med, close fit, 16/24 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_16_24,
      neckline: "v",
      garmentStyle: "cardigan",
    }),
  ),
  scenario(
    "mens-med-5-7-pullover-round",
    "Men's Med close · 5/7 · pullover round · cuff-up",
    "Men's Med, close fit, 5/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_5_7,
      neckline: "round",
    }),
  ),
  scenario(
    "mens-med-5-7-pullover-round-top-down",
    "Men's Med close · 5/7 · pullover round · top-down sleeve",
    "Men's Med, close fit, 5/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_5_7,
      neckline: "round",
    }),
    "top-down",
  ),
  scenario(
    "misses-8-5-7-pullover-round",
    "Misses 8 standard · 5/7 · pullover round · cuff-up",
    "Misses size 8, standard fit, 5/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MISSES_8_CHART_ROW,
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "standard",
      gauge: DROP_SHOULDER_QA_GAUGE_5_7,
      neckline: "round",
    }),
  ),
  scenario(
    "misses-8-5-7-pullover-v",
    "Misses 8 standard · 5/7 · pullover V · cuff-up",
    "Misses size 8, standard fit, 5/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MISSES_8_CHART_ROW,
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "standard",
      gauge: DROP_SHOULDER_QA_GAUGE_5_7,
      neckline: "v",
    }),
  ),
  scenario(
    "misses-8-5-7-cardigan-round",
    "Misses 8 standard · 5/7 · cardigan round · cuff-up",
    "Misses size 8, standard fit, 5/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MISSES_8_CHART_ROW,
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "standard",
      gauge: DROP_SHOULDER_QA_GAUGE_5_7,
      neckline: "round",
      garmentStyle: "cardigan",
    }),
  ),
  scenario(
    "misses-8-7-7-pullover-round",
    "Misses 8 standard · 7/7 · pullover round · cuff-up",
    "Misses size 8, standard fit, 7/7 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MISSES_8_CHART_ROW,
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "standard",
      gauge: DROP_SHOULDER_QA_GAUGE_7_7,
      neckline: "round",
    }),
  ),
  scenario(
    "mens-med-16-24-cardigan-round-top-down",
    "Men's Med close · 16/24 · cardigan round · top-down sleeve",
    "Men's Med, close fit, 16/24 gauge",
    buildDropShoulderQaPatternData({
      chartRow: MENS_MED_CHART_ROW,
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      gauge: DROP_SHOULDER_QA_GAUGE_16_24,
      neckline: "round",
      garmentStyle: "cardigan",
    }),
    "top-down",
  ),
];

function castOnFromJpNotation(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const m = token.match(/^co(\d+)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function chartAudienceFromPatternData(patternData: Record<string, unknown>): string | undefined {
  const fit = patternData.fit;
  if (!fit || typeof fit !== "object" || Array.isArray(fit)) return undefined;
  const chart = (fit as Record<string, unknown>).sizingChart;
  return typeof chart === "string" && chart.trim() ? chart.trim() : undefined;
}

function isCardiganScenario(scenarioId: DropShoulderQaScenarioId): boolean {
  return scenarioId.includes("cardigan");
}

/** Documented generator bug: cardigan front written cast-on uses forceEven(half) but JP/diagram use round(half). */
export const DROP_SHOULDER_KNOWN_CARDIGAN_FRONT_CAST_ON_DRIFT =
  "front cast-on (written/diagram/jp) mismatch";

function isVNeckScenario(scenarioId: DropShoulderQaScenarioId): boolean {
  return scenarioId.endsWith("-v") || scenarioId.includes("-pullover-v") || scenarioId.includes("-cardigan-v");
}

function collectDisplayText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind !== "block") continue;
    parts.push(...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? []));
  }
  return parts.join("\n");
}

export function extractSleeveCastOnFromRows(
  rows: readonly SleevelessPatternDisplayRow[],
  direction: DropShoulderSleeveDirection = "cuff-up",
): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block") continue;
    const src = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
    for (const p of src) {
      if (direction === "top-down") {
        const m = p.match(/Cast on or pick up (\d+) stitches/i);
        if (m) return Number(m[1]);
      } else {
        const m = p.match(/Cast on (\d+) stitches/i);
        if (m) return Number(m[1]);
      }
    }
  }
  return undefined;
}

/** Drop-shoulder must not instruct sleeveless-style armhole/shoulder finishing or shaping. */
export function findForbiddenDropShoulderInstructionViolations(allText: string): string[] {
  const violations: string[] = [];
  if (/\bfinish(?:ing)?\s+(?:the\s+)?armholes?\b/i.test(allText)) {
    violations.push("instructions mention finishing armholes");
  }
  if (/\bbind off\b[^.\n]{0,80}\beach side\b[^.\n]{0,40}\barmhole\b/i.test(allText)) {
    violations.push("sleeveless-style armhole bind-off at each side");
  }
  if (/\bshoulder\s+shaping\b/i.test(allText) && !/\bno shoulder shaping\b/i.test(allText)) {
    violations.push("positive shoulder-shaping instruction (expected straight shoulders only)");
  }
  const armholeShapingHits = allText.match(/[^\n.]{0,40}armhole shaping[^\n.]*/gi) ?? [];
  for (const hit of armholeShapingHits) {
    if (!/\bno armhole shaping\b/i.test(hit)) {
      violations.push(`positive armhole-shaping instruction: "${hit.trim()}"`);
    }
  }
  return violations;
}

export type DropShoulderQaMatrixRow = {
  scenarioId: DropShoulderQaScenarioId;
  scenario: string;
  profileLabel: string;
  sleeveDirection: DropShoulderSleeveDirection;
  finishedBustIn: number | undefined;
  upperArmIn: number | undefined;
  armholeDepthIn: number | undefined;
  bodyWidthSts: number | undefined;
  writtenBackCastOn: number | undefined;
  writtenFrontCastOn: number | undefined;
  diagramBackCastOn: number | undefined;
  diagramFrontCastOn: number | undefined;
  jpBackCastOn: number | undefined;
  jpFrontCastOn: number | undefined;
  sleeveTopSts: number | undefined;
  sleeveWristSts: number | undefined;
  writtenSleeveCastOn: number | undefined;
  sleeveTotalRows: number | undefined;
  sleeveCuffRows: number | undefined;
  rowAccountingSeverity: RowAccountingSeverity | "missing";
  finishingStepIds: string[];
  necklineSummary: string;
  flags: string[];
};

function agree(
  flags: string[],
  label: string,
  ...values: (number | undefined)[]
): void {
  const vals = values.filter((v): v is number => v !== undefined);
  if (vals.length < 2) return;
  const first = vals[0];
  if (!vals.every((v) => v === first)) {
    flags.push(`${label} mismatch (${vals.join(" ≠ ")})`);
  }
}

export function generateDropShoulderQaPatternResult(
  scenarioDef: DropShoulderQaScenario,
): DropShoulderPatternResult {
  return generateDropShoulderPattern(scenarioDef.patternData, {
    sleeveDirection: scenarioDef.sleeveDirection ?? "cuff-up",
  });
}

export function collectDropShoulderQaMatrixRow(
  scenarioDef: DropShoulderQaScenario,
  result: DropShoulderPatternResult,
): DropShoulderQaMatrixRow {
  const flags: string[] = [];
  const cardigan = isCardiganScenario(scenarioDef.id);
  const vNeck = isVNeckScenario(scenarioDef.id);
  const sleeveDirection = scenarioDef.sleeveDirection ?? "cuff-up";
  const patternData = scenarioDef.patternData;
  const d = result.debug;

  if (!result.isDropShoulder) flags.push("generator result missing isDropShoulder flag");
  if (result.neckShoulderShapingChart.rows.length > 0) {
    flags.push("neck/shoulder shaping chart should be empty for drop shoulder");
  }

  const finishedBust = resolveEffectiveFinishedBustInches(patternData);
  const spi = d.stitchesPerInch;
  const rpi = d.rowsPerInch;
  const upperArmIn = d.dropShoulderUpperArmInches;
  const expectedArmholeDepth = computeDropShoulderArmholeDepthInches(upperArmIn);
  const bodyWidthSts = d.backStitches;
  const expectedBodySts =
    finishedBust !== undefined && spi > 0 ? forceEven((finishedBust / 2) * spi) : undefined;
  const expectedTopSts = upperArmIn !== undefined && spi > 0 ? forceEven(upperArmIn * spi) : undefined;
  const wristIn = d.dropShoulderWristInches;
  const expectedWristSts = wristIn !== undefined && spi > 0 ? forceEven(wristIn * spi) : undefined;

  const writtenBack = extractCastOnFromRows(result.displayRows);
  const writtenFront = extractCastOnFromRows(result.frontDisplayRows);
  const writtenSleeveCastOn = extractSleeveCastOnFromRows(result.sleeveDisplayRows, sleeveDirection);

  const backDiagram = buildDropShoulderBodyDiagramReplacements(result, "in", {
    patternData,
    measurementPiece: "back",
  });
  const frontDiagram = buildDropShoulderBodyDiagramReplacements(result, "in", {
    patternData,
    measurementPiece: "front",
    ...(cardigan ? { cardiganHalfSide: "left" as const } : {}),
  });
  const diagramBackCastOn = Number(backDiagram.HIP_STS);
  const diagramFrontCastOn = Number(frontDiagram.HIP_STS);

  let jpBackCastOn: number | undefined;
  let jpFrontCastOn: number | undefined;
  let necklineSummary = "—";
  if (isDropShoulderBodyJapaneseNotationSupported(result)) {
    const backJp = buildDropShoulderBackJapaneseNotationReplacements(result, patternData);
    const frontJp = buildDropShoulderFrontJapaneseNotationReplacements(result, patternData);
    jpBackCastOn = castOnFromJpNotation(backJp["jp-caston"]);
    jpFrontCastOn = castOnFromJpNotation(frontJp["jp-caston"]);
    if (backJp["jp-armhole-shaping"]?.trim()) {
      flags.push(`back JP has armhole shaping tokens: "${backJp["jp-armhole-shaping"]}"`);
    }
    if (frontJp["jp-armhole-shaping"]?.trim()) {
      flags.push(`front JP has armhole shaping tokens: "${frontJp["jp-armhole-shaping"]}"`);
    }
    if (backJp["jp-shoulder-shaping"]?.trim()) {
      flags.push(`back JP has shoulder shaping tokens: "${backJp["jp-shoulder-shaping"]}"`);
    }
    if (frontJp["jp-shoulder-shaping"]?.trim()) {
      flags.push(`front JP has shoulder shaping tokens: "${frontJp["jp-shoulder-shaping"]}"`);
    }
    necklineSummary = [
      `back bo: ${backJp["jp-neckline-bo"] || "—"}`,
      `front bo: ${frontJp["jp-neckline-bo"] || "—"}`,
      `front shaping: ${frontJp["jp-neckline-shaping"] || "—"}`,
    ].join(" | ");
  } else {
    flags.push("drop-shoulder body Japanese notation not supported for this result");
  }

  const sleeveJp = buildDropShoulderSleeveJapaneseNotationReplacements(result, sleeveDirection);
  if (!sleeveJp["jp-caston"]?.trim()) {
    flags.push("sleeve Japanese notation missing jp-caston");
  }

  agree(flags, "back cast-on (written/diagram/jp/debug)", writtenBack, diagramBackCastOn, jpBackCastOn, bodyWidthSts);
  agree(
    flags,
    "front cast-on (written/diagram/jp)",
    writtenFront,
    diagramFrontCastOn,
    jpFrontCastOn,
  );

  if (expectedBodySts !== undefined && bodyWidthSts !== undefined && bodyWidthSts !== expectedBodySts) {
    flags.push(`body width sts (${bodyWidthSts}) ≠ half-bust×gauge (${expectedBodySts})`);
  }

  if (d.stitchesAfterArmhole !== undefined && bodyWidthSts !== undefined && d.stitchesAfterArmhole !== bodyWidthSts) {
    flags.push(
      `stitchesAfterArmhole (${d.stitchesAfterArmhole}) should equal straight body width (${bodyWidthSts}) — no armhole shaping`,
    );
  }

  if (expectedArmholeDepth !== undefined && d.armholeDepth !== undefined) {
    if (Math.abs(d.armholeDepth - expectedArmholeDepth) > 0.001) {
      flags.push(`armhole depth (${d.armholeDepth}) ≠ upper arm ÷ 2 (${expectedArmholeDepth})`);
    }
    if (upperArmIn !== undefined && rpi > 0) {
      const expectedArmholeRows = Math.max(2, roundUpToEvenRows(expectedArmholeDepth * rpi));
      if (d.armholeRows !== expectedArmholeRows) {
        flags.push(`armhole rows (${d.armholeRows}) ≠ expected from depth×gauge (${expectedArmholeRows})`);
      }
    }
  }

  const sleeveTopSts = d.dropShoulderSleeveTopStitches;
  const sleeveWristSts = d.dropShoulderSleeveWristStitches;
  if (expectedTopSts !== undefined && sleeveTopSts !== undefined && sleeveTopSts !== expectedTopSts) {
    flags.push(`sleeve top sts (${sleeveTopSts}) ≠ upper arm×gauge (${expectedTopSts})`);
  }
  if (expectedWristSts !== undefined && sleeveWristSts !== undefined && sleeveWristSts !== expectedWristSts) {
    flags.push(`sleeve wrist sts (${sleeveWristSts}) ≠ wrist×gauge (${expectedWristSts})`);
  }

  if (sleeveDirection === "cuff-up") {
    agree(flags, "cuff-up sleeve cast-on (written/wrist/debug)", writtenSleeveCastOn, sleeveWristSts);
  } else {
    agree(flags, "top-down sleeve cast-on (written/top/debug)", writtenSleeveCastOn, sleeveTopSts);
  }

  const sleeveLengthIn = d.dropShoulderSleeveLengthInches;
  const cuffDepthIn = d.dropShoulderCuffDepthInches;
  const audience = chartAudienceFromPatternData(patternData);
  const hemDepthIn = resolveEffectiveHemDepthInches(patternData, audience);
  const resolvedCuffDepthIn = resolveEffectiveCuffDepthInches(patternData, audience);

  if (sleeveLengthIn !== undefined && rpi > 0 && d.dropShoulderSleeveTotalRows !== undefined) {
    const cuffRowsExpected = calculateCuffRowsFromInches(rpi, resolvedCuffDepthIn);
    const totalExpected = Math.max(cuffRowsExpected + 2, Math.round(sleeveLengthIn * rpi));
    if (d.dropShoulderSleeveCuffRows !== cuffRowsExpected) {
      flags.push(`sleeve cuff rows (${d.dropShoulderSleeveCuffRows}) ≠ hem/cuff default (${cuffRowsExpected})`);
    }
    if (d.dropShoulderSleeveTotalRows !== totalExpected) {
      flags.push(`sleeve total rows (${d.dropShoulderSleeveTotalRows}) ≠ length×gauge (${totalExpected})`);
    }
    if (
      sleeveTopSts !== undefined &&
      sleeveWristSts !== undefined &&
      d.dropShoulderSleeveBodyRows !== undefined
    ) {
      const sched = sleeveEvenShapingSchedule(sleeveTopSts, sleeveWristSts, d.dropShoulderSleeveBodyRows);
      const expectedBodyRows = Math.max(0, totalExpected - cuffRowsExpected);
      if (d.dropShoulderSleeveBodyRows !== expectedBodyRows) {
        flags.push(`sleeve body rows (${d.dropShoulderSleeveBodyRows}) ≠ total−cuff (${expectedBodyRows})`);
      }
      if (sched.remainderRows < 0) {
        flags.push("sleeve shaping schedule has negative remainder rows");
      }
    }
  }

  if (cardigan) {
    const backTorso = writtenBack ?? bodyWidthSts;
    if (backTorso !== undefined && writtenFront !== undefined) {
      const expectedHalf = forceEven(backTorso / 2);
      if (writtenFront !== expectedHalf) {
        flags.push(`cardigan front cast-on (${writtenFront}) ≠ half back (${expectedHalf})`);
      }
      if (backTorso === writtenFront) {
        flags.push("cardigan front cast-on should be half width, not full back width");
      }
    }
  } else if (writtenBack !== undefined && writtenFront !== undefined && writtenBack !== writtenFront) {
    flags.push(`pullover front cast-on (${writtenFront}) should match back (${writtenBack})`);
  }

  const allInstructionText = [
    collectDisplayText(result.displayRows),
    collectDisplayText(result.frontDisplayRows),
    collectDisplayText(result.sleeveDisplayRows),
  ].join("\n");
  for (const v of findForbiddenDropShoulderInstructionViolations(allInstructionText)) {
    flags.push(v);
  }

  if (vNeck) {
    const frontText = collectDisplayText(result.frontDisplayRows);
    if (!/V-neck/i.test(frontText)) {
      flags.push("V-neck scenario front instructions missing V-neck wording");
    }
  } else {
    const frontText = collectDisplayText(result.frontDisplayRows);
    if (!/bind off the center/i.test(frontText) && !/center-front \(neck\) edge/i.test(frontText)) {
      flags.push("round-neck scenario front missing center neck bind-off wording");
    }
  }

  const finishing = sleevelessFinishingFromPattern(patternData, d);
  const finishingStepIds = finishing.steps.map((s) => s.id);
  if (!finishing.isDropShoulder) {
    flags.push("finishing helper did not detect drop-shoulder construction");
  }
  if (finishingStepIds.includes("finishArmholes")) {
    flags.push("finishing steps include finishArmholes (drop shoulder must omit armhole finishing)");
  }
  if (cardigan && !finishingStepIds.includes("finishFrontEdges")) {
    flags.push("cardigan finishing missing finishFrontEdges");
  }
  if (!cardigan && finishingStepIds.includes("finishFrontEdges")) {
    flags.push("pullover finishing should not include finishFrontEdges");
  }

  const rowInput = buildRowAccountingInputFromDebug({ ...d, rowsPerInch: rpi });
  let rowAccountingSeverity: RowAccountingSeverity | "missing" = "missing";
  if (rowInput) {
    const rowResult = validateRowAccounting(rowInput);
    rowAccountingSeverity = rowResult.severity;
    if (rowResult.severity === "warning") {
      flags.push(
        `row accounting warning: instruction rows differ from length×gauge by ${rowResult.rowDifference}`,
      );
    }
  } else {
    flags.push("row accounting input could not be built from debug");
  }

  if (d.hemRows !== undefined && rpi > 0 && hemDepthIn > 0) {
    const hemExpected = calculateHemRowsFromInches(rpi, hemDepthIn);
    if (d.hemRows !== hemExpected) {
      flags.push(`hem rows (${d.hemRows}) ≠ hem depth×gauge (${hemExpected})`);
    }
  }

  return {
    scenarioId: scenarioDef.id,
    scenario: scenarioDef.label,
    profileLabel: scenarioDef.profileLabel,
    sleeveDirection,
    finishedBustIn: finishedBust,
    upperArmIn,
    armholeDepthIn: d.armholeDepth,
    bodyWidthSts,
    writtenBackCastOn: writtenBack,
    writtenFrontCastOn: writtenFront,
    diagramBackCastOn: Number.isFinite(diagramBackCastOn) ? diagramBackCastOn : undefined,
    diagramFrontCastOn: Number.isFinite(diagramFrontCastOn) ? diagramFrontCastOn : undefined,
    jpBackCastOn,
    jpFrontCastOn,
    sleeveTopSts,
    sleeveWristSts,
    writtenSleeveCastOn,
    sleeveTotalRows: d.dropShoulderSleeveTotalRows,
    sleeveCuffRows: d.dropShoulderSleeveCuffRows,
    rowAccountingSeverity,
    finishingStepIds,
    necklineSummary,
    flags,
  };
}

export function buildDropShoulderQaMatrix(): DropShoulderQaMatrixRow[] {
  return DROP_SHOULDER_QA_SCENARIOS.map((scenarioDef) => {
    const result = generateDropShoulderQaPatternResult(scenarioDef);
    return collectDropShoulderQaMatrixRow(scenarioDef, result);
  });
}

export type DropShoulderCrossScenarioFlag = {
  profileLabel: string;
  message: string;
};

export function collectDropShoulderCrossScenarioFlags(
  rows: DropShoulderQaMatrixRow[],
): DropShoulderCrossScenarioFlag[] {
  const flags: DropShoulderCrossScenarioFlag[] = [];
  const byId = Object.fromEntries(
    DROP_SHOULDER_QA_SCENARIOS.map((s, i) => [s.id, rows[i]]),
  ) as Record<DropShoulderQaScenarioId, DropShoulderQaMatrixRow | undefined>;

  const comparePair = (
    profileLabel: string,
    aId: DropShoulderQaScenarioId,
    bId: DropShoulderQaScenarioId,
    label: string,
  ) => {
    const a = byId[aId];
    const b = byId[bId];
    if (!a || !b) return;
    const aBack = a.writtenBackCastOn ?? a.bodyWidthSts;
    const bBack = b.writtenBackCastOn ?? b.bodyWidthSts;
    if (aBack !== bBack) {
      flags.push({
        profileLabel,
        message: `${label}: back cast-on differs (${aBack} vs ${bBack})`,
      });
    }
  };

  comparePair(
    "Men's Med, close fit, 16/24 gauge",
    "mens-med-16-24-pullover-round",
    "mens-med-16-24-pullover-v",
    "pullover round vs V-neck",
  );
  comparePair(
    "Men's Med, close fit, 16/24 gauge",
    "mens-med-16-24-cardigan-round",
    "mens-med-16-24-cardigan-v",
    "cardigan round vs V-neck",
  );
  comparePair(
    "Misses size 8, standard fit, 5/7 gauge",
    "misses-8-5-7-pullover-round",
    "misses-8-5-7-pullover-v",
    "pullover round vs V-neck",
  );

  return flags;
}

export function compactDropShoulderQaMatrixForConsole(rows: DropShoulderQaMatrixRow[]) {
  return rows.map((r) => ({
    id: r.scenarioId,
    scenario: r.scenario,
    sleeve: r.sleeveDirection,
    bustIn: r.finishedBustIn,
    upperArm: r.upperArmIn,
    armholeIn: r.armholeDepthIn,
    bodySts: r.bodyWidthSts,
    sleeveTop: r.sleeveTopSts,
    sleeveCO: r.writtenSleeveCastOn,
    rowAcct: r.rowAccountingSeverity,
    flags: r.flags.length ? r.flags.join("; ") : "ok",
  }));
}

export function formatDropShoulderQaFailureReport(rows: DropShoulderQaMatrixRow[]): string {
  const failing = rows.filter((r) => r.flags.length > 0);
  if (failing.length === 0) return "";
  return failing
    .map(
      (r) =>
        `[${r.scenarioId}] ${r.scenario}\n  ${r.flags.map((f) => `• ${f}`).join("\n  ")}`,
    )
    .join("\n\n");
}

export function printDropShoulderQaMatrixReport(rows: DropShoulderQaMatrixRow[]): void {
  console.log("\n=== Drop-shoulder pattern QA matrix ===");
  console.table(compactDropShoulderQaMatrixForConsole(rows));
  for (const row of rows) {
    console.log(`\n--- ${row.scenario} ---`);
    console.log(`  neckline JP: ${row.necklineSummary}`);
    console.log(`  finishing:   ${row.finishingStepIds.join(" → ")}`);
    if (row.flags.length) console.log(`  FLAGS: ${row.flags.join("; ")}`);
  }
  const cross = collectDropShoulderCrossScenarioFlags(rows);
  if (cross.length) {
    console.log("\nCross-scenario flags:");
    cross.forEach((f) => console.log(`  [${f.profileLabel}] ${f.message}`));
  }
  const report = formatDropShoulderQaFailureReport(rows);
  if (report) {
    console.log("\n--- Failure summary ---\n" + report);
  }
}
