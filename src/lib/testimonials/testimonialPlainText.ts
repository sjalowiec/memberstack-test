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
