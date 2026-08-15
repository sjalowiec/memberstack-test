/**
 * Representative Drop Shoulder pattern inputs for local diagram visual QA.
 *
 * Pattern math is the live generator. Diagram SVGs are the live Back/Front renderers.
 * This module does not invent stitch/row values or configuration options.
 */

import { buildDropShoulderBackStitchesRowsSvg } from "./dropShoulderBackPatternDiagramSvg";
import { buildDropShoulderFrontStitchesRowsSvg } from "./dropShoulderFrontPatternDiagramSvg";
import {
  buildDropShoulderBackStitchesRowsModel,
  buildDropShoulderFrontStitchesRowsModel,
  type DropShoulderBackStitchesRowsModel,
  type DropShoulderFrontStitchesRowsModel,
} from "./dropShoulderPatternDiagramModel";
import {
  generateDropShoulderPattern,
  type DropShoulderPatternResult,
} from "./dropShoulderPatternOutput";
import {
  buildDropShoulderBodyDiagramReplacements,
  resolveDropShoulderBackDiagramSrc,
  resolveDropShoulderFrontDiagramSrc,
} from "./dropShoulderBodyNotationSvg";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import kidsChart from "../../../public/data/sizing_sweaters_kids.json";
import missesChart from "../../../public/data/sizing_sweaters_misses.json";

/**
 * Import diagram SVGs as modules. Do not `readFileSync(public/…)` here: the
 * Netlify adapter traces dynamic `public/` paths with @vercel/nft and copies
 * the entire public tree into the SSR function.
 */
const DROP_SHOULDER_SVG_MODULES = import.meta.glob(
  "../../../public/images/patterns/drop-shoulder/**/*.svg",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const KIDS_ROWS = kidsChart as ChartRow[];
const MISSES_ROWS = missesChart as ChartRow[];

const KIDS_10 = KIDS_ROWS.find((r) => String(r.size).includes("10"));
if (!KIDS_10) throw new Error("kids sizing chart missing size 10 yr");

const MISSES_8 = MISSES_ROWS.find((r) => String(r.size) === "8");
if (!MISSES_8) throw new Error("misses sizing chart missing size 8");

function readPublicSvg(src: string): string {
  const relative = src.replace(/^\/images\/patterns\/drop-shoulder\//, "");
  const match = Object.entries(DROP_SHOULDER_SVG_MODULES).find(([key]) =>
    key.replace(/\\/g, "/").endsWith(`/drop-shoulder/${relative}`),
  );
  if (!match) {
    throw new Error(`Missing drop-shoulder diagram SVG: ${src}`);
  }
  return match[1];
}

function dropShoulderStyle(
  recipientCategory: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    construction: "drop-shoulder",
    constructionAuthored: "drop-shoulder",
    recipientCategory,
    neckline: "round",
    bodyShape: "straight",
    frontStyle: "closed",
    garmentStyle: "pullover",
    ...overrides,
  };
}

function kids10Fit(bodyShape: string, extraMeasurements?: Record<string, number>) {
  return {
    sizingChart: "kids",
    selectedSize: undefined as undefined,
    easeChoice: "relaxed",
    selectedMeasurements: {
      ...computeDefaultMeasurementsFromChartRow(KIDS_10!, "relaxed", { bodyShape }),
      upper_arm: 9,
      ...extraMeasurements,
    },
  };
}

function misses8Fit(bodyShape: string, extraMeasurements?: Record<string, number>) {
  return {
    sizingChart: "misses",
    selectedSize: "8",
    easeChoice: "relaxed",
    selectedMeasurements: {
      ...computeDefaultMeasurementsFromChartRow(MISSES_8!, "relaxed", { bodyShape }),
      ...extraMeasurements,
    },
  };
}

const KIDS_GAUGE = {
  gaugeStitchesPerInch: 5.25,
  gaugeRowsPerInch: 8,
  availableNeedles: 200,
};

const MISSES_COARSE_GAUGE = {
  gaugeStitchesPerInch: 4.5,
  gaugeRowsPerInch: 6,
  availableNeedles: 200,
};

/** Kids 10 yr · relaxed · 21 sts / 32 rows over 4 in. */
export function kids10YrRelaxedDropShoulderPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "kids",
      selectedSize: "10 yr",
      easeChoice: "relaxed",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(KIDS_10!, "relaxed", {
        bodyShape: "straight",
      }),
    },
    style: dropShoulderStyle("kids"),
    yarnGaugeMachine: KIDS_GAUGE,
  };
}

/**
 * Same kids 10 / relaxed / gauge identity, with upper arm pinned to 9" so the
 * generator's armhole depth is 4.5" → 36 rows at 8 rpi (the review example).
 */
export function kids10YrRelaxedArmhole36Pattern(): Record<string, unknown> {
  const base = kids10YrRelaxedDropShoulderPattern();
  const fit = base.fit as Record<string, unknown>;
  return {
    ...base,
    fit: {
      ...fit,
      selectedSize: undefined,
      selectedMeasurements: {
        ...(fit.selectedMeasurements as Record<string, number>),
        upper_arm: 9,
      },
    },
  };
}

function kids10Armhole36WithStyle(styleOverrides: Record<string, unknown>): Record<string, unknown> {
  return {
    fit: kids10Fit(String(styleOverrides.bodyShape ?? "straight")),
    style: dropShoulderStyle("kids", styleOverrides),
    yarnGaugeMachine: KIDS_GAUGE,
  };
}

export type DropShoulderDiagramReviewPieceView = {
  piece: "back" | "front";
  generatedSvg: string;
  legacySvg: string;
  values: Record<string, string | number>;
};

export type DropShoulderDiagramReviewCase = {
  id: string;
  title: string;
  summary: string;
  pattern: Record<string, unknown>;
  result: DropShoulderPatternResult;
  backModel: DropShoulderBackStitchesRowsModel;
  frontModel: DropShoulderFrontStitchesRowsModel;
  pieces: DropShoulderDiagramReviewPieceView[];
  values: Record<string, string | number>;
};

function gaugeOverFourInches(pattern: Record<string, unknown>): string {
  const yarn = pattern.yarnGaugeMachine as Record<string, number> | undefined;
  const spi = Number(yarn?.gaugeStitchesPerInch) || 0;
  const rpi = Number(yarn?.gaugeRowsPerInch) || 0;
  const sts = Math.round(spi * 4 * 100) / 100;
  const rows = Math.round(rpi * 4 * 100) / 100;
  return `${sts} sts / ${rows} rows over 4 in`;
}

function debugValues(
  pattern: Record<string, unknown>,
  result: DropShoulderPatternResult,
  back: DropShoulderBackStitchesRowsModel,
  front: DropShoulderFrontStitchesRowsModel,
): Record<string, string | number> {
  const style = (pattern.style ?? {}) as Record<string, unknown>;
  return {
    gauge: gaugeOverFourInches(pattern),
    garment: front.garment,
    neckline: front.neckline,
    bodyShape: front.bodyShape,
    armholeRows: back.armholeRows,
    armholeDepthLabel: back.armholeDepthLabel,
    backNeckRows: back.necklineRowsInsideArmhole,
    frontNeckRows: front.necklineRowsInsideArmhole,
    backWidthSts: back.bodyWidthStitches,
    frontWidthSts: front.bodyWidthStitches,
    hemStsBack: back.hemStitches,
    hemStsFront: front.hemStitches,
    necklineStsBack: back.necklineStitches,
    necklineStsFront: front.necklineStitches,
    shoulderSts: back.shoulderStitchesEach,
    hemRows: back.hemRows,
    bodyRows: back.bodyRowsToArmhole,
    frontStyle: String(style.frontStyle ?? ""),
  };
}

function hydrateLegacySvg(
  src: string,
  result: DropShoulderPatternResult,
  pattern: Record<string, unknown>,
  piece: "back" | "front",
): string {
  const isCardigan = isSleevelessCardiganGarmentStyle(pattern);
  return applyGarmentDiagramSvgReplacements(
    readPublicSvg(src),
    buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData: pattern,
      measurementPiece: piece,
      cardiganHalfSide: piece === "front" && isCardigan ? "left" : undefined,
    }),
  );
}

function toReviewCase(input: {
  id: string;
  title: string;
  summary: string;
  pattern: Record<string, unknown>;
}): DropShoulderDiagramReviewCase {
  const result = generateDropShoulderPattern(input.pattern);
  const backModel = buildDropShoulderBackStitchesRowsModel(result, "in");
  const frontModel = buildDropShoulderFrontStitchesRowsModel(result, input.pattern, "in");
  if (!backModel || !frontModel) {
    throw new Error(`Drop Shoulder diagram adapter returned null for ${input.id}`);
  }
  const backLegacySrc = resolveDropShoulderBackDiagramSrc("sts-rows", input.pattern);
  const frontLegacySrc = resolveDropShoulderFrontDiagramSrc("sts-rows", input.pattern);
  const values = debugValues(input.pattern, result, backModel, frontModel);
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    pattern: input.pattern,
    result,
    backModel,
    frontModel,
    values,
    pieces: [
      {
        piece: "back",
        generatedSvg: buildDropShoulderBackStitchesRowsSvg(backModel),
        legacySvg: hydrateLegacySvg(backLegacySrc, result, input.pattern, "back"),
        values,
      },
      {
        piece: "front",
        generatedSvg: buildDropShoulderFrontStitchesRowsSvg(frontModel),
        legacySvg: hydrateLegacySvg(frontLegacySrc, result, input.pattern, "front"),
        values,
      },
    ],
  };
}

/** Build the visual-QA fixtures using the live generator + Back/Front SVG renderers. */
export function buildDropShoulderDiagramReviewCases(): DropShoulderDiagramReviewCase[] {
  return [
    {
      id: "pullover-round-kids10",
      title: "Pullover, round neck, Kids 10",
      summary: "Straight body. 21 sts / 32 rows over 4 in. Armhole 36 rows / 4.5 in.",
      pattern: kids10Armhole36WithStyle({
        neckline: "round",
        frontStyle: "closed",
        garmentStyle: "pullover",
        bodyShape: "straight",
      }),
    },
    {
      id: "pullover-vneck-kids10",
      title: "Pullover, V-neck, Kids 10",
      summary: "Same size and gauge as the round pullover. Front neck is a V.",
      pattern: kids10Armhole36WithStyle({
        neckline: "v-neck",
        frontStyle: "closed",
        garmentStyle: "pullover",
        bodyShape: "straight",
      }),
    },
    {
      id: "cardigan-round-kids10",
      title: "Cardigan, round neck, Kids 10",
      summary: "Left front half-panel with center-front edge. Round neckline.",
      pattern: kids10Armhole36WithStyle({
        neckline: "round",
        frontStyle: "open",
        garmentStyle: "cardigan",
        bodyShape: "straight",
      }),
    },
    {
      id: "cardigan-vneck-kids10",
      title: "Cardigan, V-neck, Kids 10",
      summary: "Left front half-panel. V-neck to the center-front edge.",
      pattern: kids10Armhole36WithStyle({
        neckline: "v-neck",
        frontStyle: "open",
        garmentStyle: "cardigan",
        bodyShape: "straight",
      }),
    },
    {
      id: "pullover-round-misses8",
      title: "Pullover, round neck, Misses 8",
      summary: "Different size and gauge: 18 sts / 24 rows over 4 in.",
      pattern: {
        fit: misses8Fit("straight"),
        style: dropShoulderStyle("misses"),
        yarnGaugeMachine: MISSES_COARSE_GAUGE,
      },
    },
    {
      id: "pullover-aline-misses8",
      title: "Pullover, A-line, Misses 8",
      summary: "A-line body: hem wider than bust. Round neck.",
      pattern: {
        fit: misses8Fit("aline"),
        style: dropShoulderStyle("misses", { bodyShape: "aline" }),
        yarnGaugeMachine: MISSES_COARSE_GAUGE,
      },
    },
  ].map(toReviewCase);
}
