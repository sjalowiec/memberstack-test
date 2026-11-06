import { randomBytes } from "node:crypto";
import { queryTestimonials } from "./testimonialQuery";
import type { WatsonQueryFn } from "../watson/memberSearch";
import { publicTestimonialCopy, quoteWithHighlight } from "./testimonialPlainText";
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
  display_highlight_start,
  display_highlight_end,
  created_at,
  updated_at
`;

export const PUBLIC_TESTIMONIAL_BATCH_SIZE = 8;
export const PUBLIC_TESTIMONIAL_ORDER_COOKIE = "kin_testimonial_order";

const PUBLIC_TESTIMONIAL_WHERE = `
active = TRUE
  AND btrim(COALESCE(NULLIF(btrim(COALESCE(display_quote, '')), ''), original_quote)) <> ''
  AND btrim(COALESCE(NULLIF(btrim(COALESCE(display_attribution, '')), ''), original_attribution)) <> ''
`.trim();

export const PUBLIC_TESTIMONIAL_SQL = `
SELECT
  original_quote,
  original_attribution,
  display_quote,
  display_attribution,
  display_highlight_start,
  display_highlight_end,
  review_date
FROM testimonials
WHERE ${PUBLIC_TESTIMONIAL_WHERE}
`;

type Query = WatsonQueryFn;

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function storedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() ? value : null;
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
    displayQuote: storedText(row.display_quote),
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
    displayHighlightStart: intOrNull(row.display_highlight_start),
    displayHighlightEnd: intOrNull(row.display_highlight_end),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export type PublicTestimonialBatch = {
  testimonials: PublicTestimonial[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number;
  hasMore: boolean;
};

export function normalizePublicTestimonialSeed(value: string | null | undefined): string | null {
  if (!value || !/^[a-f0-9]{32}$/.test(value)) return null;
  return value;
}

export function createPublicTestimonialSeed(): string {
  return randomBytes(16).toString("hex");
}

type OrderCookieStore = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax"; path?: string },
  ): void;
};

/** Session cookie. The same visit keeps one shuffle; a new visit receives a new one. */
export function ensurePublicTestimonialOrderSeed(cookies: OrderCookieStore, secure: boolean): string {
  const existing = normalizePublicTestimonialSeed(cookies.get(PUBLIC_TESTIMONIAL_ORDER_COOKIE)?.value);
  if (existing) return existing;
  const seed = createPublicTestimonialSeed();
  cookies.set(PUBLIC_TESTIMONIAL_ORDER_COOKIE, seed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
  return seed;
}

function mapPublicTestimonial(row: Record<string, unknown>): PublicTestimonial | null {
  const copy = publicTestimonialCopy({
    originalQuote: text(row.original_quote),
    originalAttribution: text(row.original_attribution),
    displayQuote: nullableText(row.display_quote),
    displayAttribution: nullableText(row.display_attribution),
  });
  const displayQuote = storedText(row.display_quote);
  const parts = displayQuote
    ? quoteWithHighlight(
        displayQuote,
        intOrNull(row.display_highlight_start),
        intOrNull(row.display_highlight_end),
      )
    : { before: copy.quote, highlight: null, after: "" };
  if (!(displayQuote || copy.quote) || !copy.attribution) return null;
  return {
    before: parts.before,
    highlight: parts.highlight,
    after: parts.after,
    attribution: copy.attribution,
    reviewDate: dateOnly(row.review_date),
  };
}

export async function listPublicTestimonials(
  input: { seed: string; offset?: number },
  query: Query = queryTestimonials,
): Promise<PublicTestimonialBatch> {
  const seed = normalizePublicTestimonialSeed(input.seed) ?? createPublicTestimonialSeed();
  const limit = PUBLIC_TESTIMONIAL_BATCH_SIZE;
  const offset = Math.max(Math.floor(input.offset ?? 0) || 0, 0);
  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM testimonials WHERE ${PUBLIC_TESTIMONIAL_WHERE}`,
  );
  const rows = await query<Record<string, unknown>>(
    `${PUBLIC_TESTIMONIAL_SQL}
     ORDER BY md5($1 || id::text), id
     LIMIT $2 OFFSET $3`,
    [seed, limit, offset],
  );
  const total = totalRows[0]?.total ?? 0;
  const nextOffset = offset + rows.length;
  return {
    testimonials: rows
      .map(mapPublicTestimonial)
      .filter((row): row is PublicTestimonial => row !== null),
    total,
    offset,
    limit,
    nextOffset,
    hasMore: nextOffset < total,
  };
}

export type TestimonialAdminSort = "inactive" | "active";

/** Inactive or active group first, then the existing newest-first order inside each group. */
export function testimonialAdminListOrder(sort: TestimonialAdminSort = "inactive"): string {
  const statusGroup = sort === "active" ? "active DESC" : "active ASC";
  return `${statusGroup}, review_date DESC NULLS LAST, created_at DESC`;
}

/** Default collection: legacy Show = 1, plus every member submission and admin entry. */
export function testimonialAdminCollectionClause(includeUnpublishedLegacy: boolean): string {
  if (includeUnpublishedLegacy) return "TRUE";
  return "(source <> 'legacy_import' OR legacy_show IS TRUE)";
}

export async function listTestimonialsForAdmin(
  input: {
    q?: string;
    status?: "all" | "active" | "inactive";
    sort?: TestimonialAdminSort;
    includeUnpublishedLegacy?: boolean;
    limit?: number;
    offset?: number;
  },
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
    AND ${testimonialAdminCollectionClause(input.includeUnpublishedLegacy === true)}
  `;
  const params = [pattern, q || null, active];
  const totalRows = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM testimonials WHERE ${filters}`,
    params,
  );
  const rows = await query<Record<string, unknown>>(
    `SELECT ${ADMIN_COLUMNS} FROM testimonials WHERE ${filters}
     ORDER BY ${testimonialAdminListOrder(input.sort)}
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
  input: {
    displayQuote: string | null;
    displayAttribution: string | null;
    highlight: { start: number; end: number } | null;
    /** Null leaves the current publication status unchanged. */
    active?: boolean | null;
  },
  query: Query = queryTestimonials,
): Promise<TestimonialRecord | null> {
  const rows = await query<Record<string, unknown>>(
    `UPDATE testimonials
     SET display_quote = $2,
         display_attribution = $3,
         display_highlight_start = $4,
         display_highlight_end = $5,
         active = CASE WHEN $6::boolean IS NULL THEN active ELSE $6::boolean END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${ADMIN_COLUMNS}`,
    [
      id,
      input.displayQuote,
      input.displayAttribution,
      input.highlight?.start ?? null,
      input.highlight?.end ?? null,
      input.active ?? null,
    ],
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

export const DELETE_TESTIMONIAL_SQL = `
WITH removed AS (
  DELETE FROM testimonials
  WHERE id = $1
  RETURNING id, legacy_rating_id
), marked AS (
  INSERT INTO testimonial_deleted_legacy_ids (legacy_rating_id)
  SELECT legacy_rating_id
  FROM removed
  WHERE legacy_rating_id IS NOT NULL
  ON CONFLICT (legacy_rating_id) DO NOTHING
  RETURNING legacy_rating_id
)
SELECT removed.id, removed.legacy_rating_id, (SELECT COUNT(*)::int FROM marked) AS marked_count
FROM removed
`;

export async function deleteTestimonial(
  id: string,
  query: Query = queryTestimonials,
): Promise<{ legacyRatingId: number | null } | null> {
  const rows = await query<{ id: string; legacy_rating_id: number | null; marked_count: number }>(
    DELETE_TESTIMONIAL_SQL,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return { legacyRatingId: intOrNull(row.legacy_rating_id) };
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
