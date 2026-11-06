export const TESTIMONIAL_SOURCES = [
  "legacy_import",
  "member_submission",
  "admin_entry",
] as const;

export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];

export const TESTIMONIAL_PUBLICATION_STATES = ["active", "inactive", "archived"] as const;

export type TestimonialPublicationState = (typeof TESTIMONIAL_PUBLICATION_STATES)[number];

export type TestimonialSaveAction =
  | "save"
  | "activate"
  | "inactivate"
  | "archive"
  | "restore"
  | "review";

/** Changes a save action applies. Plain Save returns an empty object so reviewed status stays as it is. */
export function testimonialSaveChanges(
  action: TestimonialSaveAction,
): { publication?: TestimonialPublicationState; reviewed?: true } {
  if (action === "activate") return { publication: "active", reviewed: true };
  if (action === "inactivate") return { publication: "inactive", reviewed: true };
  if (action === "archive") return { publication: "archived", reviewed: true };
  if (action === "restore") return { publication: "inactive" };
  if (action === "review") return { reviewed: true };
  return {};
}

/** Archive and activation mark a submission reviewed. Restore and plain Save do not. */
export function testimonialUpdateMarksReviewed(input: {
  publication: TestimonialPublicationState | null;
  reviewed: true | null;
}): boolean {
  return input.reviewed === true || input.publication === "active" || input.publication === "archived";
}

export type TestimonialRecord = {
  id: string;
  legacyRatingId: number | null;
  originalQuote: string;
  originalAttribution: string;
  displayQuote: string | null;
  displayAttribution: string | null;
  reviewDate: string | null;
  rating: number | null;
  legacyMemberId: string | null;
  memberstackMemberId: string | null;
  source: TestimonialSource;
  active: boolean;
  publicationState: TestimonialPublicationState;
  reviewed: boolean;
  staffNotifiedAt: string | null;
  staffNotificationError: string | null;
  legacyShow: boolean | null;
  legacyViewed: boolean | null;
  legacyUseInEmail: boolean | null;
  displayHighlightStart: number | null;
  displayHighlightEnd: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicTestimonial = {
  before: string;
  highlight: string | null;
  after: string;
  attribution: string;
  reviewDate: string | null;
};

export type DisplayHighlight = {
  start: number;
  end: number;
};

/** Columns a repeat legacy import may refresh. Publication and display edits are absent. */
export const LEGACY_IMPORT_REFRESH_COLUMNS = [
  "original_quote",
  "original_attribution",
  "review_date",
  "rating",
  "legacy_member_id",
  "legacy_show",
  "legacy_viewed",
  "legacy_use_in_email",
] as const;

/** Kept on conflict so a rerun cannot publish a row or undo an admin correction. */
export const LEGACY_IMPORT_PRESERVED_COLUMNS = [
  "active",
  "display_quote",
  "display_attribution",
  "display_highlight_start",
  "display_highlight_end",
  "memberstack_member_id",
  "source",
  "publication_state",
  "reviewed",
  "staff_notified_at",
  "staff_notification_error",
  "staff_notification_claimed_at",
  "created_at",
  "updated_at",
] as const;

export function legacyImportUpsertSql(): string {
  const refresh = LEGACY_IMPORT_REFRESH_COLUMNS.map(
    (column) => `${column} = EXCLUDED.${column}`,
  ).join(",\n  ");
  return `
INSERT INTO testimonials (
  legacy_rating_id,
  original_quote,
  original_attribution,
  review_date,
  rating,
  legacy_member_id,
  source,
  active,
  legacy_show,
  legacy_viewed,
  legacy_use_in_email
)
SELECT $1, $2, $3, $4, $5, $6, 'legacy_import', FALSE, $7, $8, $9
WHERE NOT EXISTS (
  SELECT 1
  FROM testimonial_deleted_legacy_ids
  WHERE legacy_rating_id = $1
)
ON CONFLICT (legacy_rating_id) DO UPDATE SET
  ${refresh}
WHERE testimonials.source = 'legacy_import'
`.trim();
}
