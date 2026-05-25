/**
 * Dev-only QA matrix for sleeveless pattern math (cast-on, armhole, neckline, shoulder).
 * Uses production `generateSleevelessBackPattern` — no parallel math model.
 */

import { resolveEffectiveFinishedBustInches } from "../customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedHipInches } from "../customBuildEffectiveFinishedHip";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { buildBackJapaneseNotationReplacements } from "../sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "../sleevelessFrontJapaneseNotation";
import { buildSleevelessGarmentDiagramReplacements } from "../sleevelessGarmentDiagramReplacements";
import {
  buildGeneratorPatternDataFromSources,
  mergedPatternForDisplayFromSources,
} from "../sleevelessPatternBuilderMerge";
import {
  generateSleevelessBackPattern,
  type SleevelessBackPatternResult,
  type SleevelessPatternDisplayRow,
} from "../sleevelessPatternOutput";
import { mapExpressNecklineToStorage } from "../syncSleevelessExpressDesignToStorage";

export type SleevelessQaScenarioId =
  | "pullover-round"
  | "pullover-v-neck"
  | "cardigan-round"
  | "cardigan-v-neck";

export type SleevelessQaScenario = {
  id: SleevelessQaScenarioId;
  label: string;
  patternData: Record<string, unknown>;
};

/** Men's Med chart row — matches `public/data/sizing_sweaters_men.json`. */
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
};

/** Men's Med, close fit, straight body (production chart + ease rules). */
export const MENS_MED_CLOSE_FIT_MEASUREMENTS = computeDefaultMeasurementsFromChartRow(
  MENS_MED_CHART_ROW,
  "close",
  { bodyShape: "straight" },
);

/** 16 sts / 24 rows over 4" → 4 spi, 6 rpi. */
export const QA_GAUGE_16_24 = {
  gaugeStitchesPerInch: 4,
  gaugeRowsPerInch: 6,
  availableNeedles: 200,
} as const;

export const QA_MATRIX_PROFILE_LABEL =
  "Men's Med, close fit, straight body, 16 sts / 24 rows over 4\"";

function buildQaPatternData(
  neckline: "round" | "v-neck",
  garmentStyle?: "cardigan",
): Record<string, unknown> {
  const style: Record<string, unknown> = {
    recipientCategory: "men",
    neckline,
    bodyShape: "straight",
  };
  if (garmentStyle === "cardigan") {
    style.garmentStyle = "cardigan";
    style.frontStyle = "open";
  } else {
    style.frontStyle = "closed";
  }
  return {
    fit: {
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      selectedMeasurements: MENS_MED_CLOSE_FIT_MEASUREMENTS,
    },
    style,
    yarnGaugeMachine: { ...QA_GAUGE_16_24 },
  };
}

export const SLEEVELESS_QA_SCENARIOS: readonly SleevelessQaScenario[] = [
  {
    id: "pullover-round",
    label: "Pullover + round",
    patternData: buildQaPatternData("round"),
  },
  {
    id: "pullover-v-neck",
    label: "Pullover + V-neck",
    patternData: buildQaPatternData("v-neck"),
  },
  {
    id: "cardigan-round",
    label: "Cardigan front + round",
    patternData: buildQaPatternData("round", "cardigan"),
  },
  {
    id: "cardigan-v-neck",
    label: "Cardigan front + V-neck",
    patternData: buildQaPatternData("v-neck", "cardigan"),
  },
];

export function extractCastOnFromRows(
  rows: readonly SleevelessPatternDisplayRow[],
): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs) continue;
    for (const p of row.paragraphs) {
      const m = p.match(/Cast on (\d+) stitches/i);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function castOnFromJpNotation(token: string): number | undefined {
  const m = token.match(/^co(\d+)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function shapingSummary(bindOff: string, shaping: string): string {
  const parts = [bindOff, shaping].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
}

export type SleevelessQaGeneratorPath = "raw" | "production";

export type SleevelessQaMatrixRow = {
  scenario: string;
  generatorPath: SleevelessQaGeneratorPath;
  finishedBustIn: number | undefined;
  effectiveHipIn: number | undefined;
  bustBodySts: number | undefined;
  hemCastOnSts: number | undefined;
  backCastOn: number | undefined;
  frontCastOn: number | undefined;
  diagramBackHipSts: number | undefined;
  diagramFrontHipSts: number | undefined;
  jpBackCastOn: number | undefined;
  jpFrontCastOn: number | undefined;
  writtenBackCastOn: number | undefined;
  writtenFrontCastOn: number | undefined;
  armholeSummary: string;
  necklineSummary: string;
  shoulderSummary: string;
  stitchesAfterArmhole: number | undefined;
  neckStitches: number | undefined;
  shoulderStitchesPerSide: number | undefined;
  flags: string[];
};

function collectPieceCastOns(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  cardigan: boolean,
): Pick<
  SleevelessQaMatrixRow,
  | "backCastOn"
  | "frontCastOn"
  | "diagramBackHipSts"
  | "diagramFrontHipSts"
  | "jpBackCastOn"
  | "jpFrontCastOn"
  | "writtenBackCastOn"
  | "writtenFrontCastOn"
  | "armholeSummary"
  | "necklineSummary"
  | "shoulderSummary"
> {
  const backJp = buildBackJapaneseNotationReplacements(result, patternData);
  const frontJp = buildFrontJapaneseNotationReplacements(result, patternData);
  const backDiagram = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData,
    measurementPiece: "back",
  });
  const frontDiagram = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData,
    measurementPiece: "front",
    ...(cardigan ? { cardiganHalfSide: "left" as const } : {}),
  });

  const writtenBack = extractCastOnFromRows(result.displayRows);
  const writtenFront = extractCastOnFromRows(result.frontDisplayRows);
  const diagramBackHip = Number(backDiagram.HIP_STS);
  const diagramFrontHip = Number(frontDiagram.HIP_STS);
  const jpBackCastOn = castOnFromJpNotation(backJp["jp-caston"]);
  const jpFrontCastOn = castOnFromJpNotation(frontJp["jp-caston"]);

  const armholeSummary = [
    `back: ${shapingSummary(backJp["jp-armhole-bo"], backJp["jp-armhole-shaping"])}`,
    `front: ${shapingSummary(frontJp["jp-armhole-bo"], frontJp["jp-armhole-shaping"])}`,
  ].join(" | ");

  const necklineSummary = [
    `back: ${shapingSummary(backJp["jp-neckline-bo"], backJp["jp-neckline-shaping"])}`,
    `front: ${shapingSummary(frontJp["jp-neckline-bo"], frontJp["jp-neckline-shaping"])}`,
  ].join(" | ");

  const shoulderSummary = [
    `back: ${backJp["jp-shoulder-shaping"] || "—"}`,
    `front: ${frontJp["jp-shoulder-shaping"] || "—"}`,
  ].join(" | ");

  return {
    backCastOn: result.debug.backStitches,
    frontCastOn:
      result.debug.cardiganHalfLeftCastOnSts ?? writtenFront ?? jpFrontCastOn,
    diagramBackHipSts: Number.isFinite(diagramBackHip) ? diagramBackHip : undefined,
    diagramFrontHipSts: Number.isFinite(diagramFrontHip) ? diagramFrontHip : undefined,
    jpBackCastOn,
    jpFrontCastOn,
    writtenBackCastOn: writtenBack,
    writtenFrontCastOn: writtenFront,
    armholeSummary,
    necklineSummary,
    shoulderSummary,
  };
}

function isCardiganScenario(id: SleevelessQaScenarioId): boolean {
  return id.startsWith("cardigan-");
}

/** Same merge path as the pattern tab (`buildGeneratorPatternData` in `sleevelessPatternPageShared.ts`). */
export function buildProductionQaGeneratorInput(
  scenario: SleevelessQaScenario,
  options?: { cbMeasurementOverrides?: Record<string, string> },
): Record<string, unknown> {
  const pd = scenario.patternData;
  const styleIn = pd.style && typeof pd.style === "object" ? (pd.style as Record<string, unknown>) : {};
  const neckline = styleIn.neckline;
  const canonical = {
    style: {
      ...styleIn,
      patternMode: styleIn.patternMode ?? "express",
      neckline:
        typeof neckline === "string"
          ? mapExpressNecklineToStorage(neckline === "v-neck" ? "v-neck" : String(neckline))
          : neckline,
    },
    fit: {
      ...(pd.fit && typeof pd.fit === "object" ? (pd.fit as Record<string, unknown>) : {}),
      ...(options?.cbMeasurementOverrides
        ? { cbMeasurementOverrides: options.cbMeasurementOverrides }
        : {}),
    },
    yarnGaugeMachine: pd.yarnGaugeMachine,
  };
  const patternBuilderData = { ...pd, ...canonical };
  const merged = mergedPatternForDisplayFromSources(canonical, patternBuilderData);
  return buildGeneratorPatternDataFromSources(merged, patternBuilderData, canonical);
}

export function generateSleevelessQaPatternResult(
  scenario: SleevelessQaScenario,
  generatorPath: SleevelessQaGeneratorPath = "raw",
  options?: { cbMeasurementOverrides?: Record<string, string> },
): SleevelessBackPatternResult {
  const patternData =
    generatorPath === "production"
      ? buildProductionQaGeneratorInput(scenario, options)
      : scenario.patternData;
  return generateSleevelessBackPattern(patternData);
}

export function collectSleevelessQaMatrixRow(
  scenario: SleevelessQaScenario,
  result: SleevelessBackPatternResult,
  generatorPath: SleevelessQaGeneratorPath = "raw",
  /** Pattern payload passed to {@link generateSleevelessBackPattern} (production merge when applicable). */
  generatorPatternData: Record<string, unknown> = scenario.patternData,
): SleevelessQaMatrixRow {
  const flags: string[] = [];
  const cardigan = isCardiganScenario(scenario.id);
  const piece = collectPieceCastOns(result, generatorPatternData, cardigan);
  const d = result.debug;

  const writtenBack = piece.writtenBackCastOn;
  const bustBody = d.bustBodyStitches ?? d.backStitches;
  const hemCastOn = d.hemCastOnStitches;
  const finishedBust = resolveEffectiveFinishedBustInches(generatorPatternData);
  const effectiveHip = resolveEffectiveFinishedHipInches(generatorPatternData);

  const agree = (label: string, a: number | undefined, b: number | undefined, c?: number) => {
    const vals = [a, b, c].filter((v): v is number => v !== undefined);
    if (vals.length < 2) return;
    const first = vals[0];
    if (!vals.every((v) => v === first)) {
      flags.push(`${label} mismatch (${vals.join(" ≠ ")})`);
    }
  };

  agree(
    "back cast-on (written/diagram/jp)",
    writtenBack,
    piece.diagramBackHipSts,
    piece.jpBackCastOn,
  );
  agree("front cast-on (written/diagram/jp)", piece.writtenFrontCastOn, piece.diagramFrontHipSts, piece.jpFrontCastOn);

  if (
    writtenBack !== undefined &&
    bustBody !== undefined &&
    writtenBack !== bustBody &&
    hemCastOn !== undefined &&
    writtenBack === hemCastOn
  ) {
    flags.push(
      `straight torso: written cast-on uses hem (${writtenBack}) not bust body (${bustBody}) — check hip override vs chart bust`,
    );
  }

  if (bustBody !== undefined && writtenBack !== undefined && writtenBack !== bustBody && writtenBack !== hemCastOn) {
    flags.push(`back written (${writtenBack}) ≠ bust body (${bustBody})`);
  }

  if (cardigan) {
    const backTorso = writtenBack ?? bustBody;
    if (backTorso !== undefined && piece.frontCastOn !== undefined) {
      const expectedHalf = Math.ceil(backTorso / 2);
      if (piece.frontCastOn !== expectedHalf) {
        flags.push(`cardigan front cast-on (${piece.frontCastOn}) ≠ half back (${expectedHalf})`);
      }
      if (backTorso === piece.frontCastOn) {
        flags.push("cardigan back cast-on should stay full width (not equal to front)");
      }
    }
    if (
      d.stitchesAfterArmhole !== undefined &&
      d.cardiganHalfLeftStitchesAfterArmhole !== undefined &&
      d.stitchesAfterArmhole !== d.cardiganHalfLeftStitchesAfterArmhole * 2
    ) {
      flags.push(
        `cardigan post-armhole back (${d.stitchesAfterArmhole}) ≠ 2× front (${d.cardiganHalfLeftStitchesAfterArmhole})`,
      );
    }
  } else {
    const backTorso = writtenBack ?? bustBody;
    if (
      backTorso !== undefined &&
      piece.frontCastOn !== undefined &&
      backTorso !== piece.frontCastOn
    ) {
      flags.push(`pullover front cast-on (${piece.frontCastOn}) should match back (${backTorso})`);
    }
  }

  return {
    scenario: scenario.label,
    generatorPath,
    finishedBustIn: finishedBust,
    effectiveHipIn: effectiveHip,
    bustBodySts: bustBody,
    hemCastOnSts: hemCastOn,
    backCastOn: bustBody,
    frontCastOn: piece.frontCastOn,
    diagramBackHipSts: piece.diagramBackHipSts,
    diagramFrontHipSts: piece.diagramFrontHipSts,
    jpBackCastOn: piece.jpBackCastOn,
    jpFrontCastOn: piece.jpFrontCastOn,
    writtenBackCastOn: piece.writtenBackCastOn,
    writtenFrontCastOn: piece.writtenFrontCastOn,
    armholeSummary: piece.armholeSummary,
    necklineSummary: piece.necklineSummary,
    shoulderSummary: piece.shoulderSummary,
    stitchesAfterArmhole: d.stitchesAfterArmhole,
    neckStitches: d.necklineStitches,
    shoulderStitchesPerSide: d.shoulderStitches,
    flags,
  };
}

export function buildSleevelessQaMatrix(
  generatorPath: SleevelessQaGeneratorPath = "raw",
  options?: { cbMeasurementOverrides?: Record<string, string> },
): SleevelessQaMatrixRow[] {
  return SLEEVELESS_QA_SCENARIOS.map((scenario) => {
    const generatorPatternData =
      generatorPath === "production"
        ? buildProductionQaGeneratorInput(scenario, options)
        : scenario.patternData;
    const result = generateSleevelessBackPattern(generatorPatternData);
    return collectSleevelessQaMatrixRow(scenario, result, generatorPath, generatorPatternData);
  });
}

export function collectCrossScenarioFlags(rows: SleevelessQaMatrixRow[]): string[] {
  const flags: string[] = [];
  const byId = Object.fromEntries(
    SLEEVELESS_QA_SCENARIOS.map((s, i) => [s.id, rows[i]]),
  ) as Record<SleevelessQaScenarioId, SleevelessQaMatrixRow | undefined>;

  const pulloverRound = byId["pullover-round"];
  const pulloverV = byId["pullover-v-neck"];
  const cardiganRound = byId["cardigan-round"];
  const cardiganV = byId["cardigan-v-neck"];

  const compareCastOns = (
    a: SleevelessQaMatrixRow | undefined,
    b: SleevelessQaMatrixRow | undefined,
    label: string,
  ) => {
    if (!a || !b) return;
    const aBack = a.writtenBackCastOn ?? a.backCastOn;
    const bBack = b.writtenBackCastOn ?? b.backCastOn;
    if (aBack !== bBack) {
      flags.push(`${label}: back cast-on differs (${aBack} vs ${bBack})`);
    }
    if (a.frontCastOn !== b.frontCastOn) {
      flags.push(`${label}: front cast-on differs (${a.frontCastOn} vs ${b.frontCastOn})`);
    }
  };

  compareCastOns(pulloverRound, pulloverV, "pullover round vs V-neck");
  compareCastOns(cardiganRound, cardiganV, "cardigan round vs V-neck");

  return flags;
}

/** Compact rows for `console.table` (omit long shaping strings). */
export function compactQaMatrixForConsole(rows: SleevelessQaMatrixRow[]) {
  return rows.map((r) => ({
    scenario: r.scenario,
    path: r.generatorPath,
    bustIn: r.finishedBustIn,
    hipIn: r.effectiveHipIn,
    bustBody: r.bustBodySts,
    hemCO: r.hemCastOnSts,
    writtenBack: r.writtenBackCastOn,
    frontCO: r.frontCastOn,
    flags: r.flags.length ? r.flags.join("; ") : "ok",
  }));
}

export function printSleevelessQaMatrixReport(rows: SleevelessQaMatrixRow[]): void {
  console.log(`\n=== Sleeveless pattern QA matrix ===`);
  console.log(QA_MATRIX_PROFILE_LABEL);
  console.table(compactQaMatrixForConsole(rows));
  for (const row of rows) {
    console.log(`\n--- ${row.scenario} shaping ---`);
    console.log(`  armhole:   ${row.armholeSummary}`);
    console.log(`  neckline:  ${row.necklineSummary}`);
    console.log(`  shoulder:  ${row.shoulderSummary}`);
    if (row.flags.length) console.log(`  FLAGS: ${row.flags.join("; ")}`);
  }
  const cross = collectCrossScenarioFlags(rows);
  if (cross.length) {
    console.log("\nCross-scenario flags:");
    cross.forEach((f) => console.log(`  • ${f}`));
  }
}
