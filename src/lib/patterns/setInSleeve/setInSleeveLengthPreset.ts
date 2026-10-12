/**
 * Set-In sleeve-length preset.
 *
 * Choosing Long, 3/4, Elbow, or Short clears only the custom sleeve-length flag.
 * A custom upper arm and a custom cuff stay. Unedited fields return to the chart
 * values, and the resolver scales an unedited cuff for the new preset.
 * Drop Shoulder's preset handler is separate and still clears the cuff flag.
 */

import { reconcileDropShoulderSleeveOverridesForSizeChange } from "../dropShoulderSleeveMeasurementOverrides";
import type { DropShoulderUserEditedSleeveFields } from "../dropShoulderUserEditedSleeveFields";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";

export function setInSleeveSleeveStateAfterLengthPreset(args: {
  overrides: Record<string, string>;
  userEdited: DropShoulderUserEditedSleeveFields;
  chartRow: ChartRow;
  fitPreference: string;
  chartAudience?: string;
  bodyShape?: string;
}): {
  overrides: Record<string, string>;
  userEdited: DropShoulderUserEditedSleeveFields;
} {
  const userEdited: DropShoulderUserEditedSleeveFields = {
    upperArm: args.userEdited.upperArm === true,
    cuffCircumference: args.userEdited.cuffCircumference === true,
    sleeveLength: false,
  };
  const overrides = reconcileDropShoulderSleeveOverridesForSizeChange(
    args.overrides,
    args.chartRow,
    args.fitPreference,
    userEdited,
    { bodyShape: args.bodyShape, chartAudience: args.chartAudience },
  );
  return { overrides, userEdited };
}
