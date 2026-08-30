/**
 * Socks Summary/Edit measurement helpers for the shared chip overlay.
 * Applies Perfect Fit fields onto the existing draft and previews calc.
 * Does not recreate Socks math.
 */

import type { SockDraft, SockDraftUnit } from "./sockDraft";
import { createEmptySockDraft } from "./sockDraft";
import { convertSockMeasurementDisplay } from "./sockBuilderUnits";
import {
  buildSockSummaryFromDraft,
  type SockSummaryResult,
} from "./sockPatternFromDraft";
import type { SockSizingAdapter } from "./sockSizing";

export type SockSummaryMeasureFields = {
  footCircumference: string;
  footLength: string;
  legCircumference: string;
  legLength: string;
};

export function sockSummaryUnitSuffix(unit: SockDraftUnit): string {
  return unit === "cm" ? "cm" : '"';
}

export function sockSummaryMeasureFieldsFromDraft(draft: SockDraft): SockSummaryMeasureFields {
  return {
    footCircumference: String(draft.footCircumference ?? "").trim(),
    footLength: String(draft.footLength ?? "").trim(),
    legCircumference: String(draft.legCircumference ?? "").trim(),
    legLength: String(draft.legLength ?? "").trim(),
  };
}

export function convertSockSummaryMeasurements(
  measures: SockSummaryMeasureFields,
  fromUnit: SockDraftUnit,
  toUnit: SockDraftUnit,
): SockSummaryMeasureFields {
  return {
    footCircumference: convertSockMeasurementDisplay(measures.footCircumference, fromUnit, toUnit),
    footLength: convertSockMeasurementDisplay(measures.footLength, fromUnit, toUnit),
    legCircumference: convertSockMeasurementDisplay(measures.legCircumference, fromUnit, toUnit),
    legLength: convertSockMeasurementDisplay(measures.legLength, fromUnit, toUnit),
  };
}

export function applySockSummaryMeasurementsToDraft(
  previous: SockDraft,
  measures: SockSummaryMeasureFields,
  unit: SockDraftUnit = previous.unit,
): SockDraft {
  return createEmptySockDraft({
    ...previous,
    unit,
    footCircumference: String(measures.footCircumference ?? "").trim(),
    footLength: String(measures.footLength ?? "").trim(),
    legCircumference: String(measures.legCircumference ?? "").trim(),
    legLength: String(measures.legLength ?? "").trim(),
  });
}

/**
 * Preview Summary/Edit from unsaved chip values. Does not write storage.
 * Invalid intermediate input returns the same failure shape as a saved draft.
 */
export function buildSockSummaryEditPreview(
  previous: SockDraft,
  measures: SockSummaryMeasureFields,
  adapter: SockSizingAdapter,
  unit: SockDraftUnit = previous.unit,
): SockSummaryResult {
  return buildSockSummaryFromDraft(
    applySockSummaryMeasurementsToDraft(previous, measures, unit),
    adapter,
  );
}
