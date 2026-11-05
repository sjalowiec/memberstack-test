export const TESTIMONIAL_SOURCES = [
  "legacy_import",
  "member_submission",
  "admin_entry",
] as const;

export type TestimonialSource = (typeof TESTIMONIAL_SOURCES)[number];

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
  legacyShow: boolean | null;
  legacyViewed: boolean | null;
  legacyUseInEmail: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicTestimonial = {
  id: string;
  quote: string;
  attribution: string;
  reviewDate: string | null;
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
  "memberstack_member_id",
  "source",
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
) VALUES (
  $1, $2, $3, $4, $5, $6, 'legacy_import', FALSE, $7, $8, $9
)
ON CONFLICT (legacy_rating_id) DO UPDATE SET
  ${refresh}
WHERE testimonials.source = 'legacy_import'
`.trim();
}
