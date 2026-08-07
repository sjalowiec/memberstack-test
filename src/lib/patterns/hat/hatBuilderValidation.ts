/**
 * Hat Express builder validation — ported from `requiredPatternInputsComplete` in hat.astro.
 * Pure helpers; no sweater validation imports.
 */

export const HAT_BUILDER_ALLOWED_CROWNS = ["gathered", "wedge-4-decrease", "spiral"] as const;
export type HatBuilderAllowedCrown = (typeof HAT_BUILDER_ALLOWED_CROWNS)[number];

export const HAT_BUILDER_INCOMPLETE_MESSAGE =
  "Finish the required sections to generate your pattern.";

export const HAT_BUILDER_DRAFT_READY_MESSAGE =
  "Draft saved. Pattern page coming next — your choices are stored in this browser.";

export type HatBuilderFieldSnapshot = {
  sizeSel: string;
  customCircumference: string;
  brimType: string;
  brimLength: string;
  crownShaping: string;
  fit: string;
  customHatLength: string;
  stitchGauge: string;
  rowGauge: string;
};

export type HatBuilderSizeRow = {
  size: string;
  finishedSizeInches: number;
};

function positiveNumber(raw: string): boolean {
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0;
}

/** True when size choice alone is complete (accordion step 1). */
export function isHatBuilderSizeComplete(
  fields: Pick<HatBuilderFieldSnapshot, "sizeSel" | "customCircumference">,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  const size = fields.sizeSel.trim();
  if (!size) return false;
  if (size === "custom") {
    return positiveNumber(fields.customCircumference);
  }
  const selected = sizingRows.find((s) => s.size === size);
  return Boolean(selected && Number(selected.finishedSizeInches) > 0);
}

/** True when length/fit choice alone is complete (accordion step 2). */
export function isHatBuilderLengthComplete(
  fields: Pick<HatBuilderFieldSnapshot, "fit" | "customHatLength">,
): boolean {
  const fit = fields.fit.trim();
  if (!fit) return false;
  if (fit === "custom") {
    return positiveNumber(fields.customHatLength);
  }
  return ["beanie", "watchcap", "slouchy", "relaxed"].includes(fit);
}

/** True when brim type + visible height are complete (accordion step 3). */
export function isHatBuilderBrimComplete(
  fields: Pick<HatBuilderFieldSnapshot, "brimType" | "brimLength">,
): boolean {
  const bt = fields.brimType.trim();
  if (bt !== "single" && bt !== "folded") return false;
  return positiveNumber(fields.brimLength);
}

/** True when crown choice is one of the release crowns (accordion step 4). */
export function isHatBuilderCrownComplete(
  fields: Pick<HatBuilderFieldSnapshot, "crownShaping">,
): boolean {
  return (HAT_BUILDER_ALLOWED_CROWNS as readonly string[]).includes(
    fields.crownShaping.trim(),
  );
}

/** True when stitch + row gauge are valid positives (accordion step 5). */
export function isHatBuilderGaugeComplete(
  fields: Pick<HatBuilderFieldSnapshot, "stitchGauge" | "rowGauge">,
): boolean {
  return positiveNumber(fields.stitchGauge) && positiveNumber(fields.rowGauge);
}

/**
 * All required Create My Pattern inputs — same rules as hat.astro
 * `requiredPatternInputsComplete`.
 */
export function isHatBuilderInputComplete(
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  return (
    isHatBuilderSizeComplete(fields, sizingRows) &&
    isHatBuilderLengthComplete(fields) &&
    isHatBuilderBrimComplete(fields) &&
    isHatBuilderCrownComplete(fields) &&
    isHatBuilderGaugeComplete(fields)
  );
}

/** Per-step completion for accordion lock / checkmarks (steps 1–5). */
export function hatBuilderStepComplete(
  step: number,
  fields: HatBuilderFieldSnapshot,
  sizingRows: ReadonlyArray<HatBuilderSizeRow>,
): boolean {
  switch (step) {
    case 1:
      return isHatBuilderSizeComplete(fields, sizingRows);
    case 2:
      return isHatBuilderLengthComplete(fields);
    case 3:
      return isHatBuilderBrimComplete(fields);
    case 4:
      return isHatBuilderCrownComplete(fields);
    case 5:
      return isHatBuilderGaugeComplete(fields);
    default:
      return false;
  }
}
