/**
 * Fixed, published sleeveless beta pattern — canonical inputs for the locked viewer + beta print route.
 * Replace this object when the beta garment specification is finalized (same pipeline as the builder).
 */

import type { SleevelessPatternRecord } from "./patternStorage.ts";

/** Audience labels for intro copy (mirrors builder pattern tab). */
export const SLEEVELESS_CHART_AUDIENCE_LABELS: Record<string, string> = {
  misses: "Women's (Misses)",
  plus: "Plus size",
  men: "Men",
  kids: "Kids",
  baby: "Baby",
};

const iso = "2026-05-01T12:00:00.000Z";

/**
 * Full pattern record shape — matches stored builder output enough for display merge + print summary.
 * Numeric gauges mirror regression tests in sleevelessPatternOutput.test.ts (extended with garment choices).
 */
export const SLEEVELESS_BETA_PATTERN_RECORD = {
  id: "sleeveless-beta-published",
  patternType: "sleeveless" as const,
  status: "draft" as const,
  version: 1,
  createdAt: iso,
  updatedAt: iso,
  style: {
    recipientCategory: "misses",
    patternMode: "",
    bodyShape: "straight",
    length: "top",
    neckline: "round",
    frontStyle: "closed",
  },
  fit: {
    sizingChart: "misses",
    selectedSize: "M",
    easeChoice: "standard",
    fitChoice: "standard",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 22,
      armhole_depth: 8,
      neck_opening: 2,
      shoulder_width: 4.25,
      back_neck_depth: 1,
      front_neck_depth: 3,
    },
  },
  yarnGauge: {
    yarnName: "DK wool blend (beta reference yarn)",
    yarnWeight: "DK",
    stitchGauge: "5",
    rowGauge: "7",
    gaugeUnits: "per_inch",
    gaugeStitchRaw: "20",
    gaugeRowRaw: "28",
    gaugeRawUnit: "in",
    gaugeDisplayText: "",
  },
  measurements: {},
  machine: {
    availableNeedles: "200",
  },
  calculations: {},
  instructions: {},
} satisfies SleevelessPatternRecord;

/** Merged display record for {@link buildPatternIntroSentence} / diagrams — same shape as mergedPatternForDisplay output. */
export const SLEEVELESS_BETA_PATTERN_MERGED: Record<string, unknown> = {
  ...SLEEVELESS_BETA_PATTERN_RECORD,
};

/**
 * Argument to {@link generateSleevelessBackPattern} — equivalent to buildGeneratorPatternData when builder state matches the fixture.
 */
export const SLEEVELESS_BETA_GENERATOR_INPUT: Record<string, unknown> = {
  fit: {
    ...SLEEVELESS_BETA_PATTERN_RECORD.fit,
    selectedMeasurements: {
      ...(SLEEVELESS_BETA_PATTERN_RECORD.fit.selectedMeasurements as Record<string, unknown>),
    },
  },
  style: { ...SLEEVELESS_BETA_PATTERN_RECORD.style },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
    yarnNotes: SLEEVELESS_BETA_PATTERN_RECORD.yarnGauge.yarnName,
    gaugeStitchRaw: SLEEVELESS_BETA_PATTERN_RECORD.yarnGauge.gaugeStitchRaw,
    gaugeRowRaw: SLEEVELESS_BETA_PATTERN_RECORD.yarnGauge.gaugeRowRaw,
    gaugeRawUnit: SLEEVELESS_BETA_PATTERN_RECORD.yarnGauge.gaugeRawUnit,
  },
};
