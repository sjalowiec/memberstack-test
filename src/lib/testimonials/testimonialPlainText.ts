/** Plain text for public display. Tags and URLs are removed and nothing is executed. */
export function testimonialPlainText(value: string): string {
  const withoutBlocks = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return decoded
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type PublicQuoteParts = {
  before: string;
  highlight: string | null;
  after: string;
};

/** Split a saved display quote at a validated highlight. Invalid ranges are not emphasized. */
export function quoteWithHighlight(
  quote: string,
  start: number | null,
  end: number | null,
): PublicQuoteParts {
  if (
    start == null ||
    end == null ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > quote.length ||
    !quote.slice(start, end).trim()
  ) {
    return { before: quote, highlight: null, after: "" };
  }
  return {
    before: quote.slice(0, start),
    highlight: quote.slice(start, end),
    after: quote.slice(end),
  };
}

export function publicTestimonialCopy(input: {
  originalQuote: string;
  originalAttribution: string;
  displayQuote: string | null;
  displayAttribution: string | null;
}): { quote: string; attribution: string } {
  const quoteSource = input.displayQuote?.trim() ? input.displayQuote : input.originalQuote;
  const attributionSource = input.displayAttribution?.trim()
    ? input.displayAttribution
    : input.originalAttribution;
  return {
    quote: testimonialPlainText(quoteSource),
    attribution: testimonialPlainText(attributionSource),
  };
}

/** Editor starting text. A saved override stays exact so its highlight offsets still match. */
export function testimonialEditorFields(input: {
  originalQuote: string;
  originalAttribution: string;
  displayQuote: string | null;
  displayAttribution: string | null;
}): { name: string; quote: string } {
  const published = publicTestimonialCopy({
    originalQuote: input.originalQuote,
    originalAttribution: input.originalAttribution,
    displayQuote: null,
    displayAttribution: null,
  });
  return {
    name: input.displayAttribution?.trim() ? input.displayAttribution : published.attribution,
    quote: input.displayQuote?.trim() ? input.displayQuote : published.quote,
  };
}

/** One-line preview for the admin delete confirmation. */
export function shortQuotePreview(quote: string, limit = 80): string {
  const plain = testimonialPlainText(quote).replace(/\s+/g, " ").trim();
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit - 1).trimEnd()}…`;
}

export function testimonialDeleteConfirmation(attribution: string, quote: string): string {
  const name = testimonialPlainText(attribution).replace(/\s+/g, " ").trim() || "this member";
  return `Delete the testimonial from ${name}?\n\n“${shortQuotePreview(quote)}”`;
}
