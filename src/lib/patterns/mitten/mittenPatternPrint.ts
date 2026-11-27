/**
 * Print/PDF heading for the finished Mitten Pattern page.
 *
 * Mittens use `kbm_mitten_draft`, not the sleeveless/sweater working draft.
 * A saved name is reused as the print title. Printing does not write the draft.
 */

import { readMittenDraft, type MittenDraft } from "./mittenDraft";
import { resolveMittenPatternDisplayName } from "./mittenSavedProject";

export type MittenPatternPrintFields = {
  title: string;
  notes: string;
};

export type ResolveMittenPatternPrintFieldsInput = {
  draft?: MittenDraft | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveMittenPatternPrintFields(
  input: ResolveMittenPatternPrintFieldsInput = {},
): MittenPatternPrintFields {
  const draft =
    input.draft !== undefined
      ? input.draft
      : typeof localStorage !== "undefined"
        ? readMittenDraft()
        : null;
  return {
    title: resolveMittenPatternDisplayName(draft),
    notes: draft?.patternProject?.notes?.trim() ?? "",
  };
}

/** Print at-a-glance: gauge only. Measurements and calculated counts stay off the printed pattern. */
export function buildMittenPatternPrintBasicsHtml(
  draft: Pick<MittenDraft, "stitchGaugePer4" | "rowGaugePer4">,
): string {
  const stitch = draft.stitchGaugePer4.trim();
  const row = draft.rowGaugePer4.trim();
  if (!stitch || !row) return "";
  const gauge = `${stitch} sts / ${row} rows per 4"`;
  return `<dl class="print-summary-dl print-summary-dl--basics"><dt>Gauge</dt><dd>${escapeHtml(gauge)}</dd></dl>`;
}
