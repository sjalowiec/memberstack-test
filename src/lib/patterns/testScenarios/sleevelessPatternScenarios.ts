/**
 * Canned sleeveless pattern builder inputs for automated QA.
 * Uses the same `generateSleevelessBackPattern` payload shape as production — no parallel model.
 */

export type SleevelessPatternScenarioId =
  | "pullover-round-neck"
  | "pullover-v-neck"
  | "cardigan-round-neck"
  | "cardigan-v-neck"
  | "pullover-aline";

export type SleevelessScenarioPiece = "back" | "front";

/** Which automated shoulder-shaping checks apply to a scenario. */
export type SleevelessScenarioShoulderQa = {
  /** Timeline/chart shoulder stitch totals should reconcile to `debug.shoulderStitches`. */
  shoulderReconciliation: boolean;
  pieces: SleevelessScenarioPiece[];
  /** `jp-shoulder-shaping` garment overview tokens are expected to be live on supported diagram pieces. */
  garmentOverviewNotation: boolean;
  /** Front and back must match via `shoulderShapingNotationLinesFromTimeline` (and JP tokens when supported). */
  frontBackCanonicalRule: boolean;
  /** Active-side chart HTML must not duplicate final "Bind off remaining N stitches." prose. */
  noDuplicateBindOffRemainingProse: boolean;
};

export type SleevelessPatternScenario = {
  id: SleevelessPatternScenarioId;
  label: string;
  patternData: Record<string, unknown>;
  shoulderQa: SleevelessScenarioShoulderQa;
  /** Human-readable note when `garmentOverviewNotation` is false. */
  garmentOverviewUnsupportedReason?: string;
};

export function sleevelessScenarioBaseMeasurements(): Record<string, number> {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

export function sleevelessScenarioAlineMeasurements(): Record<string, number> {
  return {
    ...sleevelessScenarioBaseMeasurements(),
    finished_hip: 48,
  };
}

export function sleevelessScenarioGauge(): Record<string, number> {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function fitBlock(measurements: Record<string, number>): Record<string, unknown> {
  return {
    sizingChart: "misses",
    selectedMeasurements: measurements,
  };
}

function pulloverStyle(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { recipientCategory: "misses", ...extra };
}

/** All canned scenarios — extend this list to grow QA coverage. */
export const SLEEVELESS_PATTERN_SCENARIOS: readonly SleevelessPatternScenario[] = [
  {
    id: "pullover-round-neck",
    label: "Pullover round neck",
    patternData: {
      fit: fitBlock(sleevelessScenarioBaseMeasurements()),
      style: pulloverStyle({ neckline: "round" }),
      yarnGaugeMachine: sleevelessScenarioGauge(),
    },
    shoulderQa: {
      shoulderReconciliation: true,
      pieces: ["back", "front"],
      garmentOverviewNotation: true,
      frontBackCanonicalRule: true,
      noDuplicateBindOffRemainingProse: true,
    },
  },
  {
    id: "pullover-v-neck",
    label: "Pullover V-neck",
    patternData: {
      fit: fitBlock(sleevelessScenarioBaseMeasurements()),
      style: pulloverStyle({ neckline: "v-neck" }),
      yarnGaugeMachine: sleevelessScenarioGauge(),
    },
    shoulderQa: {
      shoulderReconciliation: true,
      pieces: ["back", "front"],
      garmentOverviewNotation: true,
      frontBackCanonicalRule: true,
      noDuplicateBindOffRemainingProse: true,
    },
  },
  {
    id: "pullover-aline",
    label: "Pullover A-line body",
    patternData: {
      fit: fitBlock(sleevelessScenarioAlineMeasurements()),
      style: pulloverStyle({ neckline: "round", bodyShape: "aline" }),
      yarnGaugeMachine: sleevelessScenarioGauge(),
    },
    shoulderQa: {
      shoulderReconciliation: true,
      pieces: ["back", "front"],
      garmentOverviewNotation: true,
      frontBackCanonicalRule: true,
      noDuplicateBindOffRemainingProse: true,
    },
  },
  {
    id: "cardigan-round-neck",
    label: "Cardigan round neck (open front)",
    patternData: {
      fit: fitBlock(sleevelessScenarioBaseMeasurements()),
      style: pulloverStyle({ neckline: "round", garmentStyle: "cardigan", frontStyle: "open" }),
      yarnGaugeMachine: sleevelessScenarioGauge(),
    },
    shoulderQa: {
      shoulderReconciliation: true,
      pieces: ["back", "front"],
      garmentOverviewNotation: true,
      frontBackCanonicalRule: false,
      noDuplicateBindOffRemainingProse: true,
    },
  },
  {
    id: "cardigan-v-neck",
    label: "Cardigan V-neck",
    patternData: {
      fit: fitBlock(sleevelessScenarioBaseMeasurements()),
      style: pulloverStyle({ neckline: "v-neck", garmentStyle: "cardigan" }),
      yarnGaugeMachine: sleevelessScenarioGauge(),
    },
    shoulderQa: {
      shoulderReconciliation: true,
      pieces: ["back", "front"],
      garmentOverviewNotation: true,
      frontBackCanonicalRule: true,
      noDuplicateBindOffRemainingProse: true,
    },
  },
];

export function getSleevelessPatternScenario(
  id: SleevelessPatternScenarioId,
): SleevelessPatternScenario {
  const scenario = SLEEVELESS_PATTERN_SCENARIOS.find((s) => s.id === id);
  if (!scenario) {
    throw new Error(`Unknown sleeveless pattern scenario: ${id}`);
  }
  return scenario;
}

export const SLEEVELESS_SCENARIOS_WITH_GARMENT_OVERVIEW_NOTATION = SLEEVELESS_PATTERN_SCENARIOS.filter(
  (s) => s.shoulderQa.garmentOverviewNotation,
);

export const SLEEVELESS_SCENARIOS_WITHOUT_GARMENT_OVERVIEW_NOTATION = SLEEVELESS_PATTERN_SCENARIOS.filter(
  (s) => !s.shoulderQa.garmentOverviewNotation,
);
