import { queryTestimonials } from "./testimonialQuery";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { publicTestimonialCopy } from "./testimonialPlainText";
import type { PublicTestimonial, TestimonialRecord, TestimonialSource } from "./testimonialRules";

const ADMIN_COLUMNS = `
  id,
  legacy_rating_id,
  original_quote,
  original_attribution,
  display_quote,
  display_attribution,
  review_date,
  rating,
  legacy_member_id,
  memberstack_member_id,
  source,
  active,
  legacy_show,
  legacy_viewed,
  legacy_use_in_email,
  created_at,
  updated_at
`;

export const PUBLIC_TESTIMONIAL_SQL = `
SELECT
  id,
  original_quote,
  original_attribution,
  display_quote,
  display_attribution,
  review_date
FROM testimonials
WHERE active = TRUE
ORDER BY review_date DESC NULLS LAST, created_at DESC
`;

type Query = WatsonQueryFn;

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 10);
  return null;
}

function iso(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function nullableBool(value: unknown): boolean | null {
  if (value == null) return null;
  return bool(value);
}

function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function sourceOf(value: unknown): TestimonialSource {
  if (value === "legacy_import" || value === "member_submission" || value === "admin_entry") {
    return value;
  }
  return "legacy_import";
}

function mapAdmin(row: Record<string, unknown>): TestimonialRecord {
  return {
    id: text(row.id),
    legacyRatingId: intOrNull(row.legacy_rating_id),
    originalQuote: text(row.original_quote),
    originalAttribution: text(row.original_attribution),
    displayQuote: nullableText(row.display_quote),
    displayAttribution: nullableText(row.display_attribution),
    reviewDate: dateOnly(row.review_date),
    rating: intOrNull(row.rating),
    legacyMemberId: nullableText(row.legacy_member_id),
    memberstackMemberId: nullableText(row.memberstack_member_id),
    source: sourceOf(row.source),
    active: bool(row.active),
    legacyShow: nullableBool(row.legacy_show),
    legacyViewed: nullableBool(row.legacy_viewed),
    legacyUseInEmail: nullableBool(row.legacy_use_in_email),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listPublicTestimonials(query: Query = queryTestimonials): Promise<PublicTestimonial[]> {
  const rows = await query<Record<string, unknown>>(PUBLIC_TESTIMONIAL_SQL);
  return rows
    .map((row) => {
      const copy = publicTestimonialCopy({
        originalQuote: text(row.original_quote),
        originalAttribution: text(row.original_attribution),
        displayQuote: nullableText(row.display_quote),
        displayAttribution: nullableText(row.display_attribution),
      });
      if (!copy.quote || !copy.attribution) return null;
      return {
        id: text(row.id),
        quote: copy.quote,
        attribution: copy.attribution,
        reviewDate: dateOnly(row.review_date),
      };
    })
    .filter((row): row is PublicTestimonial => row !== null);
}

export async function listTestimonialsForAdmin(
  input: { q?: string; status?: "all" | "active" | "inactive"; limit?: number; offset?: number },
  query: Query = queryTestimonials,
): Promise<{ rows: TestimonialRecord[]; total: number }> {
  const q = (input.q ?? "").trim();
  const status = input.status ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const active = status === "active" ? true : status === "inactive" ? false : null;
  const pattern = q ? `%${escapeLike(q)}%` : null;
  const filters = `
    ($1::text IS NULL OR original_quote ILIKE $1 ESCAPE '\\'
      OR original_attribution ILIKE $1 ESCAPE '\\'
      OR COALESCE(display_quote, '') ILIKE $1 ESCAPE '\\'
      OR COALESCE(display_attribution, '') ILIKE $1 ESCAPE '\\'
      OR CAST(legacy_rating_id AS TEXT) = $2)
    AND ($3::boolean IS NULL OR active = $3)
  `;
  const params = [pattern, q || null, active];
  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM testimonials WHERE ${filters}`,
    params,
  );
  const rows = await query<Record<string, unknown>>(
    `SELECT ${ADMIN_COLUMNS} FROM testimonials WHERE ${filters}
     ORDER BY review_date DESC NULLS LAST, created_at DESC
     LIMIT $4 OFFSET $5`,
    [...params, limit, offset],
  );
  return {
    total: totalRows[0]?.total ?? 0,
    rows: rows.map(mapAdmin),
  };
}

export async function getTestimonialForAdmin(
  id: string,
  query: Query = queryTestimonials,
): Promise<TestimonialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT ${ADMIN_COLUMNS} FROM testimonials WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapAdmin(rows[0]) : null;
}

export async function setTestimonialActive(
  id: string,
  active: boolean,
  query: Query = queryTestimonials,
): Promise<TestimonialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `UPDATE testimonials
     SET active = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING ${ADMIN_COLUMNS}`,
    [id, active],
  );
  return rows[0] ? mapAdmin(rows[0]) : null;
}

export async function updateTestimonialDisplay(
  id: string,
  input: { displayQuote: string | null; displayAttribution: string | null },
  query: Query = queryTestimonials,
): Promise<TestimonialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `UPDATE testimonials
     SET display_quote = $2, display_attribution = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING ${ADMIN_COLUMNS}`,
    [id, input.displayQuote, input.displayAttribution],
  );
  return rows[0] ? mapAdmin(rows[0]) : null;
}

export async function createAdminTestimonial(
  input: { attribution: string; quote: string; reviewDate: string | null; rating: number | null },
  query: Query = queryTestimonials,
): Promise<TestimonialRecord> {
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO testimonials (
       original_quote, original_attribution, review_date, rating, source, active
     ) VALUES ($1, $2, $3, $4, 'admin_entry', FALSE)
     RETURNING ${ADMIN_COLUMNS}`,
    [input.quote, input.attribution, input.reviewDate, input.rating],
  );
  return mapAdmin(rows[0]);
}

export async function countRecentMemberSubmissions(
  memberstackMemberId: string,
  query: Query = queryTestimonials,
): Promise<number> {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total
     FROM testimonials
     WHERE memberstack_member_id = $1
       AND source = 'member_submission'
       AND created_at > NOW() - INTERVAL '1 hour'`,
    [memberstackMemberId],
  );
  return rows[0]?.total ?? 0;
}

export async function createMemberTestimonial(
  input: { memberstackMemberId: string; attribution: string; quote: string },
  query: Query = queryTestimonials,
): Promise<TestimonialRecord> {
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO testimonials (
       original_quote, original_attribution, memberstack_member_id, source, active
     ) VALUES ($1, $2, $3, 'member_submission', FALSE)
     RETURNING ${ADMIN_COLUMNS}`,
    [input.quote, input.attribution, input.memberstackMemberId],
  );
  return mapAdmin(rows[0]);
}
