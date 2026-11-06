import type { DropShoulderSleeveMatchRules, PatternErrataRecord } from "./types";
import { DROP_SHOULDER_SLEEVE_MEASUREMENTS_KIND } from "./types";

/** Stable id so a dev seed does not create a second row. */
export const DROP_SHOULDER_SLEEVE_ERRATA_ID = "a7c3e891-4d2b-4f6a-8e15-0b9c6d3f2a47";

export const DROP_SHOULDER_SLEEVE_ERRATA_SLUG = "drop-shoulder-sleeve-stitches";

/**
 * Calculation correction prepared for kin-dev review on 2026-11-05 Pacific.
 * Patterns created at or after this instant already calculate from the saved finished sleeve.
 */
export const DROP_SHOULDER_SLEEVE_CORRECTED_AT = "2026-11-06T04:00:00.000Z";

export const DROP_SHOULDER_SLEEVE_ERRATA_TITLE = "Drop Shoulder sleeve stitches";

export const DROP_SHOULDER_SLEEVE_WHAT_CHANGED = [
  "Some saved Drop Shoulder patterns stored a finished cuff and upper arm, but the instructions used the smaller body measurements when those fields had not been edited by hand. Opening an affected pattern now calculates the cuff stitches, upper-arm stitches, and armhole depth from the saved finished measurements.",
  "",
  "The measurement editor still shows the finished cuff and upper arm that were saved. The sleeve diagram shows the width of the rounded stitch count. Saved measurements are not rewritten.",
].join("\n");

export const DROP_SHOULDER_SLEEVE_KNITTER_ACTION =
  "Cuff stitches, upper-arm stitches, and armhole depth may change. If you are already knitting, review those changes before you continue.";

export const DROP_SHOULDER_SLEEVE_MATCH_RULES: DropShoulderSleeveMatchRules = {
  kind: DROP_SHOULDER_SLEEVE_MEASUREMENTS_KIND,
  correctedAt: DROP_SHOULDER_SLEEVE_CORRECTED_AT,
};

/** Published correction. Member notices read this even before the dev database has the row. */
export function dropShoulderSleeveErrataRecord(): PatternErrataRecord {
  return {
    id: DROP_SHOULDER_SLEEVE_ERRATA_ID,
    slug: DROP_SHOULDER_SLEEVE_ERRATA_SLUG,
    status: "published",
    title: DROP_SHOULDER_SLEEVE_ERRATA_TITLE,
    whatChanged: DROP_SHOULDER_SLEEVE_WHAT_CHANGED,
    knitterAction: DROP_SHOULDER_SLEEVE_KNITTER_ACTION,
    publishedOn: "2026-11-05",
    affectedBuilders: ["drop-shoulder"],
    affectedSizes: {},
    matchRules: DROP_SHOULDER_SLEEVE_MATCH_RULES,
    createdAt: DROP_SHOULDER_SLEEVE_CORRECTED_AT,
    updatedAt: DROP_SHOULDER_SLEEVE_CORRECTED_AT,
    updatedBy: null,
  };
}
