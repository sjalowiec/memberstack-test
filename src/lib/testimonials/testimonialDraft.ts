const ATTRIBUTION_MAX = 80;
const QUOTE_MIN = 20;
const QUOTE_MAX = 4000;
export const MEMBER_SUBMISSION_HOURLY_LIMIT = 3;

export type TestimonialDraft = {
  attribution: string;
  quote: string;
  reviewDate?: string | null;
  rating?: number | null;
};

export type DraftResult =
  | { ok: true; value: Required<Pick<TestimonialDraft, "attribution" | "quote">> & {
      reviewDate: string | null;
      rating: number | null;
    } }
  | { ok: false; error: string };

export function parseTestimonialDraft(input: unknown, options?: { requireDate?: boolean }): DraftResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Enter the testimonial and a name." };
  const body = input as Record<string, unknown>;
  const attribution = typeof body.attribution === "string" ? body.attribution.trim() : "";
  const quote = typeof body.quote === "string" ? body.quote.trim() : "";
  if (attribution.length < 2 || attribution.length > ATTRIBUTION_MAX) {
    return { ok: false, error: "Enter the name to show with this testimonial (2–80 characters)." };
  }
  if (quote.length < QUOTE_MIN || quote.length > QUOTE_MAX) {
    return { ok: false, error: "Enter a testimonial between 20 and 4000 characters." };
  }
  const reviewDate = parseOptionalDate(body.reviewDate);
  if (reviewDate === "invalid") return { ok: false, error: "Enter a valid review date." };
  const rating = parseOptionalRating(body.rating);
  if (rating === "invalid") return { ok: false, error: "Rating must be a whole number from 0 to 10." };
  if (options?.requireDate && !reviewDate) {
    return { ok: false, error: "Enter the date of the testimonial." };
  }
  return { ok: true, value: { attribution, quote, reviewDate, rating } };
}

export function parseDisplayCorrection(input: unknown):
  | { ok: true; displayQuote: string | null; displayAttribution: string | null }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Enter the display text." };
  const body = input as Record<string, unknown>;
  const displayQuote = typeof body.displayQuote === "string" ? body.displayQuote.trim() : "";
  const displayAttribution = typeof body.displayAttribution === "string" ? body.displayAttribution.trim() : "";
  if (displayQuote.length > QUOTE_MAX || displayAttribution.length > ATTRIBUTION_MAX) {
    return { ok: false, error: "That display text is too long." };
  }
  if ((displayQuote && !displayAttribution) || (!displayQuote && displayAttribution)) {
    return { ok: false, error: "Enter both the display quote and the display name, or clear both to use the original." };
  }
  return {
    ok: true,
    displayQuote: displayQuote || null,
    displayAttribution: displayAttribution || null,
  };
}

export function memberSubmissionAllowed(recentCount: number): boolean {
  return recentCount < MEMBER_SUBMISSION_HOURLY_LIMIT;
}

function parseOptionalDate(value: unknown): string | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return "invalid";
  return value;
}

function parseOptionalRating(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) return "invalid";
  return parsed;
}
