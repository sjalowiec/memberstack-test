import type { FinishedLengthMatchRules, FinishedLengthSizeRule } from "./types";

/** Stable id so re-applying the dev seed does not create a second draft. */
export const BABY_KIDS_LENGTH_ERRATA_ID = "6f3c1a90-7b24-4e1d-9a55-0c8e2b7d4f61";

export const BABY_KIDS_LENGTH_ERRATA_SLUG = "baby-kids-finished-length";

/**
 * `ef6152d2` committed the corrected charts at 2026-09-26 06:04:04 Pacific
 * (13:04:04 UTC). Saved patterns are not rewritten by that commit.
 */
export const BABY_KIDS_LENGTH_CHART_CORRECTED_AT = "2026-09-26T13:04:04.000Z";

export const BABY_KIDS_LENGTH_ERRATA_TITLE = "Baby and kids finished sweater lengths";

export const BABY_KIDS_LENGTH_SIZE_RULES: readonly FinishedLengthSizeRule[] = [
  { audience: "baby", size: "3 mo", oldLengthInches: 6, newLengthInches: 8.75 },
  { audience: "baby", size: "6 mo", oldLengthInches: 7, newLengthInches: 9.75 },
  { audience: "baby", size: "12 mo", oldLengthInches: 7.5, newLengthInches: 10.25 },
  { audience: "baby", size: "18 mo", oldLengthInches: 8, newLengthInches: 10.75 },
  { audience: "baby", size: "24 mo", oldLengthInches: 8.5, newLengthInches: 11.25 },
  {
    audience: "kids",
    size: "2 yr",
    oldLengthInches: 18,
    newLengthInches: 11.25,
    oldUpperArmInches: 6,
    newUpperArmInches: 7.5,
  },
  { audience: "kids", size: "4 yr", oldLengthInches: 19.5, newLengthInches: 12.75 },
  { audience: "kids", size: "6 yr", oldLengthInches: 20.5, newLengthInches: 13.5 },
  { audience: "kids", size: "8 yr", oldLengthInches: 22, newLengthInches: 14.75 },
  { audience: "kids", size: "10 yr", oldLengthInches: 24, newLengthInches: 15.5 },
  { audience: "kids", size: "12 yr", oldLengthInches: 26, newLengthInches: 16.5 },
  { audience: "kids", size: "14 yr", oldLengthInches: 27, newLengthInches: 17.5 },
  { audience: "kids", size: "16 yr", oldLengthInches: 28, newLengthInches: 18.5 },
];

export const BABY_KIDS_LENGTH_MATCH_RULES: FinishedLengthMatchRules = {
  kind: "finished-length-defaults",
  correctedAt: BABY_KIDS_LENGTH_CHART_CORRECTED_AT,
  sizes: [...BABY_KIDS_LENGTH_SIZE_RULES],
};

export const BABY_KIDS_LENGTH_WHAT_CHANGED = [
  "New Drop Shoulder and Sleeveless patterns for Baby and Kids sizes now use finished hem-to-shoulder lengths. The previous defaults were body measurements: back-waist length for babies, and neck-to-wrist length for kids. Saved patterns still have the measurements they were saved with. Those measurements do not update automatically.",
  "",
  "The size table lists each corrected finished length. Kids size 2 also uses a 7.5 in upper arm so it follows Baby 24 mo. The previous kids size 2 upper arm was 6 in.",
  "",
  "Some Drop Shoulder V-neck cardigan shaping charts did not finish on the same shoulder stitch count as the written instructions. New patterns keep the instructions, shaping chart, and diagram on one shoulder. That chart correction is not assumed for every saved pattern.",
].join("\n");

export const BABY_KIDS_LENGTH_KNITTER_ACTION =
  "Review the finished length on your saved pattern, and the upper arm on a Kids size 2 pattern. If you want the corrected defaults, create a new pattern and choose the size again. Saved measurements do not update automatically.";
