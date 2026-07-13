/**
 * Custom Build measurement summary — which diagram fields appear per construction.
 *
 * Drop shoulder cross-shoulder / flat body width is derived at pattern generation
 * (finished bust ÷ 2) and must not appear on the summary blueprint.
 */

/** Hidden on drop-shoulder summary (not editable, not display-only). */
export function isDropShoulderHiddenSummaryField(key: string): boolean {
  return key === "shoulderWidth";
}

/**
 * Shown read-only on drop-shoulder summary (derived / picker-driven, not directly editable):
 * - `armholeDepth`: derived = upper arm ÷ 2.
 * - `sleeveLength`: on the initial builder/review path, driven by the sleeve-length picker (full
 *   chart length × chosen proportion) as a scaled read-only value. On the Edit Pattern workspace,
 *   `sleeveLength` is an editable numeric field instead (see {@link isDropShoulderSleeveLengthEditableOnEditWorkspace}).
 */
export function isDropShoulderDisplayOnlySummaryField(
  key: string,
  options?: { dropShoulderEditWorkspace?: boolean },
): boolean {
  if (key === "armholeDepth") return true;
  if (key === "sleeveLength") {
    return !isDropShoulderSleeveLengthEditableOnEditWorkspace(options?.dropShoulderEditWorkspace);
  }
  return false;
}

/** Drop Shoulder Edit Pattern workspace — sleeve length is a numeric input, not a preset picker. */
export function isDropShoulderSleeveLengthEditableOnEditWorkspace(
  dropShoulderEditWorkspace?: boolean,
): boolean {
  return dropShoulderEditWorkspace === true;
}

/** Editable / validated / persisted fields for the active construction. */
export function isCustomBuildDiagramFieldActiveForConstruction(
  field: { key: string; dropShoulderOnly?: boolean },
  isDropShoulder: boolean,
  options?: { dropShoulderEditWorkspace?: boolean },
): boolean {
  if (field.dropShoulderOnly && !isDropShoulder) return false;
  if (isDropShoulder && isDropShoulderHiddenSummaryField(field.key)) return false;
  if (isDropShoulder && isDropShoulderDisplayOnlySummaryField(field.key, options)) return false;
  return true;
}

/** All overlay chips rendered on the summary blueprint (includes display-only). */
export function isCustomBuildDiagramFieldRenderedOnSummary(
  field: { key: string; dropShoulderOnly?: boolean },
  isDropShoulder: boolean,
): boolean {
  if (field.dropShoulderOnly && !isDropShoulder) return false;
  if (isDropShoulder && isDropShoulderHiddenSummaryField(field.key)) return false;
  return true;
}
