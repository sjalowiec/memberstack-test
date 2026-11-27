import type { MeasurementDisplayUnit } from "../patternMeasurementDisplayUnit";
import type { MittenCalcInput, MittenThumbStyle } from "./mittenMath";
import { gaugePerInchFromPer4Inches } from "./mittenMath";
import {
  defaultHand2LengthInches,
  mittenSizingRow,
  MITTEN_SIZING_CHART,
  type MittenSizingRow,
} from "./mittenSizingChart";

export const MITTEN_DRAFT_STORAGE_KEY = "kbm_mitten_draft";
export const MITTEN_DRAFT_VERSION = 1 as const;

export type MittenDraft = {
  version: typeof MITTEN_DRAFT_VERSION;
  patternType: "mittens";
  patternSystem: "mittens";
  sizeId: string;
  cuffCircumference: string;
  cuffLength: string;
  handCircumference: string;
  handLength: string;
  hand2Length: string;
  thumbLength: string;
  thumbCircumference: string;
  /** Missing values stay on the slotted construction. */
  thumbStyle?: MittenThumbStyle;
  /** Diagram unit chosen on Summary/Edit. Measurements stay stored in inches. */
  displayUnit?: MeasurementDisplayUnit;
  /** Hat gauge entry: stitches over 4 inches. */
  stitchGaugePer4: string;
  /** Hat gauge entry: rows over 4 inches. */
  rowGaugePer4: string;
  /** Saved-project name and print notes. Same shape as the other pattern builders. */
  patternProject?: {
    title?: string;
    notes?: string;
    titleCustomized?: boolean;
  };
  updatedAt: string;
};

export const MITTEN_BUILDER_HREF = "/patterns/mittens/builder";
export const MITTEN_SUMMARY_HREF = "/patterns/mittens/summary/";
export const MITTEN_PATTERN_HREF = "/patterns/mittens/pattern/";
export const MITTEN_PATTERN_NAME = "Slotted mittens";
export const MITTEN_WOMAN_SMALL_EXAMPLE_HREF = `${MITTEN_PATTERN_HREF}?example=woman-small`;

function text(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function draftFromSizingRow(
  row: MittenSizingRow,
  gauge: { stitchGaugePer4: string; rowGaugePer4: string; thumbStyle?: MittenThumbStyle } = {
    stitchGaugePer4: "",
    rowGaugePer4: "",
  },
): MittenDraft {
  return {
    version: MITTEN_DRAFT_VERSION,
    patternType: "mittens",
    patternSystem: "mittens",
    sizeId: row.size,
    cuffCircumference: text(row.cuffCircumferenceInches),
    cuffLength: text(row.cuffLengthInches),
    handCircumference: text(row.handCircumferenceInches),
    handLength: text(row.handLengthInches),
    hand2Length: text(defaultHand2LengthInches(row.handLengthInches)),
    thumbLength: text(row.thumbLengthInches),
    thumbCircumference: text(row.thumbCircumferenceInches),
    thumbStyle: gauge.thumbStyle === "gored" ? "gored" : "slotted",
    stitchGaugePer4: gauge.stitchGaugePer4,
    rowGaugePer4: gauge.rowGaugePer4,
    updatedAt: new Date().toISOString(),
  };
}

/** Woman Small with the hat gauge entry for 7 stitches and 10 rows per inch. */
export function womanSmallExampleDraft(): MittenDraft {
  const row = mittenSizingRow("woman_sm");
  if (!row) throw new Error("Woman Small is missing from the mitten chart.");
  return draftFromSizingRow(row, { stitchGaugePer4: "28", rowGaugePer4: "40" });
}

export function readMittenDraft(): MittenDraft | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(MITTEN_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MittenDraft>;
    if (parsed.version !== MITTEN_DRAFT_VERSION || parsed.patternType !== "mittens") return null;
    return parsed as MittenDraft;
  } catch {
    return null;
  }
}

export function writeMittenDraft(draft: MittenDraft): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    MITTEN_DRAFT_STORAGE_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  );
}

function numberFrom(raw: string): number {
  const value = Number(String(raw).trim());
  return Number.isFinite(value) ? value : NaN;
}

export function mittenInputFromDraft(draft: MittenDraft): MittenCalcInput {
  return {
    cuffCircumferenceInches: numberFrom(draft.cuffCircumference),
    cuffLengthInches: numberFrom(draft.cuffLength),
    handCircumferenceInches: numberFrom(draft.handCircumference),
    handLengthInches: numberFrom(draft.handLength),
    hand2LengthInches: numberFrom(draft.hand2Length),
    thumbLengthInches: numberFrom(draft.thumbLength),
    thumbCircumferenceInches: numberFrom(draft.thumbCircumference),
    thumbStyle: draft.thumbStyle === "gored" ? "gored" : "slotted",
    stitchGaugePerInch: gaugePerInchFromPer4Inches(numberFrom(draft.stitchGaugePer4)),
    rowGaugePerInch: gaugePerInchFromPer4Inches(numberFrom(draft.rowGaugePer4)),
  };
}

export function mittenSizingJson(): string {
  return JSON.stringify(MITTEN_SIZING_CHART);
}
