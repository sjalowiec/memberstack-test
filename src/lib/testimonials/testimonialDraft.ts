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

export const HIGHLIGHT_RESELECT_MESSAGE =
  "The quote changed, so that highlight no longer matches. Select the words again.";

export function highlightWasInvalidated(
  previousQuote: string | null,
  previous: { start: number; end: number } | null,
  nextQuote: string | null,
  next: { start: number; end: number } | null,
): boolean {
  if (!previous || !next || !previousQuote || !nextQuote) return false;
  if (previous.start !== next.start || previous.end !== next.end) return false;
  return previousQuote.slice(previous.start, previous.end) !== nextQuote.slice(next.start, next.end);
}

export function parseDisplayHighlight(
  input: Record<string, unknown>,
  displayQuote: string | null,
): { ok: true; highlight: { start: number; end: number } | null } | { ok: false; error: string } {
  const raw = input.highlight;
  if (raw == null) return { ok: true, highlight: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: HIGHLIGHT_RESELECT_MESSAGE };
  }
  const range = raw as Record<string, unknown>;
  const start = range.start;
  const end = range.end;
  if (!displayQuote) return { ok: false, error: HIGHLIGHT_RESELECT_MESSAGE };
  if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 0 || (end as number) <= (start as number) || (end as number) > displayQuote.length) {
    return { ok: false, error: HIGHLIGHT_RESELECT_MESSAGE };
  }
  if (!displayQuote.slice(start as number, end as number).trim()) {
    return { ok: false, error: "Select the words to highlight." };
  }
  return { ok: true, highlight: { start: start as number, end: end as number } };
}

export function parseDisplayCorrection(input: unknown):
  | {
      ok: true;
      displayQuote: string | null;
      displayAttribution: string | null;
      highlight: { start: number; end: number } | null;
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Enter the display text." };
  const body = input as Record<string, unknown>;
  const rawQuote = typeof body.displayQuote === "string" ? body.displayQuote : "";
  const rawAttribution = typeof body.displayAttribution === "string" ? body.displayAttribution : "";
  if (rawQuote.length > QUOTE_MAX || rawAttribution.length > ATTRIBUTION_MAX) {
    return { ok: false, error: "That display text is too long." };
  }
  const quoteEmpty = rawQuote.trim() === "";
  const attributionEmpty = rawAttribution.trim() === "";
  if ((quoteEmpty && !attributionEmpty) || (!quoteEmpty && attributionEmpty)) {
    return { ok: false, error: "Enter both the display quote and the display name, or clear both to use the original." };
  }
  const quote = quoteEmpty ? null : rawQuote;
  const highlight = parseDisplayHighlight(body, quote);
  if (!highlight.ok) return highlight;
  return {
    ok: true,
    displayQuote: quote,
    displayAttribution: attributionEmpty ? null : rawAttribution.trim(),
    highlight: highlight.highlight,
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
