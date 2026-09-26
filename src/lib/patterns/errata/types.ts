/** Pattern errata records. Drafts stay in admin. Published rows are what knitters can see. */

export const PATTERN_ERRATA_STATUSES = ["draft", "published"] as const;
export type PatternErrataStatus = (typeof PATTERN_ERRATA_STATUSES)[number];

export const PATTERN_ERRATA_BUILDERS = ["drop-shoulder", "sleeveless"] as const;
export type PatternErrataBuilder = (typeof PATTERN_ERRATA_BUILDERS)[number];

export const FINISHED_LENGTH_DEFAULTS_KIND = "finished-length-defaults" as const;

export type ErrataMatchedMeasurement = "finished-length" | "upper-arm";

export type FinishedLengthSizeRule = {
  audience: "baby" | "kids";
  size: string;
  oldLengthInches: number;
  newLengthInches: number;
  /** Set only when this size's upper-arm default changed as well. */
  oldUpperArmInches?: number;
  newUpperArmInches?: number;
};

/** How a saved pattern is compared. This does not change the saved pattern. */
export type FinishedLengthMatchRules = {
  kind: typeof FINISHED_LENGTH_DEFAULTS_KIND;
  /**
   * Instant the corrected chart defaults were committed.
   * Used only to avoid calling a post-correction default a customized length.
   */
  correctedAt: string;
  sizes: FinishedLengthSizeRule[];
};

export type PatternErrataMatchRules = FinishedLengthMatchRules;

export type PatternErrataRecord = {
  id: string;
  slug: string;
  status: PatternErrataStatus;
  title: string;
  whatChanged: string;
  knitterAction: string;
  /** Calendar date (YYYY-MM-DD), or null while unpublished. */
  publishedOn: string | null;
  affectedBuilders: PatternErrataBuilder[];
  /** Chart audience → size labels, derived from the length rules. */
  affectedSizes: Record<string, string[]>;
  matchRules: PatternErrataMatchRules;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type SavedPatternErrataClassification =
  | "old_default"
  | "customized"
  | "current_default"
  | "uncertain"
  | "out_of_scope";

export type SavedPatternErrataMatch = {
  classification: SavedPatternErrataClassification;
  builder: PatternErrataBuilder | null;
  audience: string | null;
  size: string | null;
  lengthInches: number | null;
  upperArmInches: number | null;
  /** Which saved measurements still equal a previous default. Empty unless classification is old_default. */
  matchedMeasurements: ErrataMatchedMeasurement[];
  reason: string;
};
