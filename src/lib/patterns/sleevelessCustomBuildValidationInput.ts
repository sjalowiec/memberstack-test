import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { isDropShoulderPatternRecord } from "./patternConstructionIdentity";
import { readCustomBuildBodyFinishedMeasurements } from "./sleevelessCustomBuildBodyMeasurements";
import { readCustomBuildWizardNeckline } from "./sleevelessCustomBuildWizardNeckline";
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

function resolveCustomBuildNeckline(
  overrides: Partial<Record<string, string | number | undefined>>,
  pattern: ReturnType<typeof getCurrentPattern>,
): string {
  const fromArg = overrides.neckline;
  if (fromArg !== undefined && fromArg !== null && String(fromArg).trim() !== "") {
    return String(fromArg).trim();
  }
  const wizard = readCustomBuildWizardNeckline();
  if (wizard) return wizard;
  const stored = pattern.style?.neckline;
  return typeof stored === "string" ? stored.trim() : "";
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
  const neckline = resolveCustomBuildNeckline(overrides, pattern);
  const input: SleevelessCustomBuildMeasurements = {
    audience: resolveCustomBuildAudience(),
    ...body,
    ...(neckline ? { neckline } : {}),
  };

  for (const key of MEASUREMENT_OVERRIDE_KEYS) {
    if (key === "shoulderWidth" && isDropShoulderPatternRecord(pattern)) continue;
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
