/**
 * Shared Triangle Scarf field ids and the same validation the pattern math uses.
 * Builder and Summary/Edit both read these ids.
 */

import { EXPRESS_AVAILABLE_NEEDLES_INPUT_ID } from "../sleevelessExpressAvailableNeedles";
import {
  calculateTriangleScarf,
  type TriangleScarfInputs,
  type TriangleUnit,
} from "../triangleScarfMath";
import type { TriangleScarfDraft } from "./triangleScarfDraft";

export const TRIANGLE_SCARF_LENGTH_ID = "triangle-scarf-length";
export const TRIANGLE_SCARF_DEPTH_ID = "triangle-scarf-depth";
export const TRIANGLE_SCARF_LENGTH_LABEL_ID = "triangle-scarf-length-label";
export const TRIANGLE_SCARF_DEPTH_LABEL_ID = "triangle-scarf-depth-label";
export const TRIANGLE_SCARF_GAUGE_ID = "triangle-scarf";
export const TRIANGLE_SCARF_STITCH_GAUGE_ID = "triangle-scarf-stitch-gauge";
export const TRIANGLE_SCARF_ROW_GAUGE_ID = "triangle-scarf-row-gauge";
export const TRIANGLE_SCARF_NEEDLES_ID = EXPRESS_AVAILABLE_NEEDLES_INPUT_ID;
export const TRIANGLE_SCARF_UNIT_TOGGLE_ID = "triangle-scarf";

export const TRIANGLE_SCARF_SIZE_PRESETS = [
  { length: "24", depth: "12", label: "Small 24 × 12" },
  { length: "36", depth: "18", label: "Medium 36 × 18" },
  { length: "45", depth: "20", label: "Large 45 × 20" },
] as const;

export type TriangleScarfFormFields = {
  length: string;
  depth: string;
  stitchGauge: string;
  rowGauge: string;
  needles: string;
  unit: TriangleUnit;
};

export function triangleScarfInputsFromFields(fields: TriangleScarfFormFields): TriangleScarfInputs {
  return {
    length: Number(fields.length),
    depth: Number(fields.depth),
    stitchGauge: Number(fields.stitchGauge),
    rowGauge: Number(fields.rowGauge),
    needles: Number.parseInt(fields.needles, 10),
    unit: fields.unit === "cm" ? "cm" : "in",
  };
}

export function triangleScarfFieldsFromDraft(draft: TriangleScarfDraft): TriangleScarfFormFields {
  return {
    length: draft.length,
    depth: draft.depth,
    stitchGauge: draft.stitchGauge,
    rowGauge: draft.rowGauge,
    needles: draft.needles,
    unit: draft.unit,
  };
}

export function triangleScarfDraftFromFields(
  fields: TriangleScarfFormFields,
  previous?: TriangleScarfDraft | null,
): TriangleScarfDraft {
  return {
    version: 1,
    patternType: "triangle-scarf",
    patternSystem: "triangle-scarf",
    length: fields.length.trim(),
    depth: fields.depth.trim(),
    stitchGauge: fields.stitchGauge.trim(),
    rowGauge: fields.rowGauge.trim(),
    needles: fields.needles.trim(),
    unit: fields.unit,
    ...(previous?.patternProject ? { patternProject: previous.patternProject } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function triangleScarfSizeComplete(fields: TriangleScarfFormFields): boolean {
  const length = Number(fields.length);
  const depth = Number(fields.depth);
  return Number.isFinite(length) && length > 0 && Number.isFinite(depth) && depth > 0;
}

export function triangleScarfNeedlesComplete(fields: TriangleScarfFormFields): boolean {
  const needles = Number.parseInt(fields.needles, 10);
  return Number.isInteger(needles) && needles >= 50 && needles <= 400;
}

export function triangleScarfGaugeComplete(fields: TriangleScarfFormFields): boolean {
  const stitchGauge = Number(fields.stitchGauge);
  const rowGauge = Number(fields.rowGauge);
  return Number.isFinite(stitchGauge) && stitchGauge > 0 && Number.isFinite(rowGauge) && rowGauge > 0;
}

export function triangleScarfStepComplete(step: 1 | 2 | 3, fields: TriangleScarfFormFields): boolean {
  if (step === 1) return triangleScarfSizeComplete(fields);
  if (step === 2) return triangleScarfNeedlesComplete(fields);
  return triangleScarfGaugeComplete(fields);
}

/** First step that still needs an entry. Null when every field is filled. */
export function triangleScarfFirstIncompleteStep(fields: TriangleScarfFormFields): 1 | 2 | 3 | null {
  if (!triangleScarfSizeComplete(fields)) return 1;
  if (!triangleScarfNeedlesComplete(fields)) return 2;
  if (!triangleScarfGaugeComplete(fields)) return 3;
  return null;
}

export function triangleScarfIncompleteStepMessage(step: 1 | 2 | 3): string {
  if (step === 1) return "Enter a point-to-point length and a scarf depth greater than zero.";
  if (step === 2) return "Enter available needles (50–400), matching your machine bed.";
  return "Enter stitch gauge and row gauge from your swatch.";
}

/**
 * Full pattern check. Incomplete fields return the step message.
 * Filled fields return the pattern math message, or null when the pattern can be made.
 */
export function triangleScarfFormError(fields: TriangleScarfFormFields): string | null {
  const incomplete = triangleScarfFirstIncompleteStep(fields);
  if (incomplete) return triangleScarfIncompleteStepMessage(incomplete);
  const result = calculateTriangleScarf(triangleScarfInputsFromFields(fields));
  return result.ok ? null : result.message;
}
