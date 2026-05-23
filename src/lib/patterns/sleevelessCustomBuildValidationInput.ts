import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { readCustomBuildBodyFinishedMeasurements } from "./sleevelessCustomBuildBodyMeasurements";
import type { SleevelessCustomBuildMeasurements } from "./sleevelessPatternValidation";
import { getCurrentPattern, getSleevelessChartAudience } from "./patternStorage";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  readCustomBuildExpressValues,
} from "./syncCustomBuildToPatternStorage";
import { expressWhoToChartAudience } from "./syncSleevelessExpressDesignToStorage";

const MEASUREMENT_OVERRIDE_KEYS = [
  "armholeDepth",
  "finishedLength",
  "hemDepth",
  "neckDepth",
  "shoulderWidth",
  "finishedNeckOpeningWidth",
  "chestBust",
  "hip",
] as const;

function resolveCustomBuildAudience(): string {
  const pattern = getCurrentPattern();
  const expressValues = readCustomBuildExpressValues();
  return (
    expressWhoToChartAudience(expressValues.who) ||
    getSleevelessChartAudience(pattern) ||
    ""
  );
}

/**
 * Builds the measurement payload used by {@link validateSleevelessPatternInputs},
 * matching custom-build override keys and chart audience for pattern generation.
 */
export function buildSleevelessCustomBuildValidationInput(
  overrides: Partial<Record<string, string | number | undefined>> = {},
): SleevelessCustomBuildMeasurements {
  const saved = loadMeasurementOverrides();
  const pattern = getCurrentPattern();
  const body = readCustomBuildBodyFinishedMeasurements(pattern);
  const input: SleevelessCustomBuildMeasurements = {
    audience: resolveCustomBuildAudience(),
    ...body,
  };

  for (const key of MEASUREMENT_OVERRIDE_KEYS) {
    const fromArg = overrides[key];
    const fromSaved = saved[key];
    const value = fromArg !== undefined && fromArg !== null && String(fromArg).trim() !== ""
      ? fromArg
      : fromSaved;
    if (value !== undefined && String(value).trim() !== "") {
      input[key] = value;
    }
  }

  // Diagram “Finished bust (ease)” is flat width; keep finishedBustOrChest aligned for validation.
  const diagramBust = positiveMeasurementInches(input.chestBust);
  if (diagramBust !== undefined) {
    input.finishedBustOrChest = diagramBust;
  }

  const diagramHip = positiveMeasurementInches(input.hip);
  if (diagramHip !== undefined) {
    input.finishedHip = diagramHip;
  }

  return input;
}
