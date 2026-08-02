const BLOCKED_TAG_PATTERN =
  /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|textarea|button|select|option)\b[\s\S]*?<\/\s*\1\s*>|<\s*(script|style|iframe|object|embed|link|meta|base|input|textarea|button|select|option)\b[^>]*\/?>/gi;

/** Strip legacy markup that breaks layout or exposes downloads/scripts. */
export function sanitizeLegacyEbookDescriptionHtml(html: string): string {
  if (!html) return "";

  let out = html.replace(BLOCKED_TAG_PATTERN, "");

  out = out.replace(/\s+on\w+\s*=\s*("(?:[^"]*)"|'(?:[^']*)'|[^\s>]+)/gi, "");
  out = out.replace(
    /\s(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, attr, _q, dbl, sgl, bare) => {
      const value = (dbl ?? sgl ?? bare ?? "").trim();
      if (/\.pdf(?:\?|#|$)/i.test(value) || /^javascript:/i.test(value)) {
        return attr === "href" ? ' href="#"' : "";
      }
      return match;
    }
  );

  out = out.replace(/\s(width|height)\s*=\s*("(?:[^"]*)"|'(?:[^']*)'|[^\s>]+)/gi, "");
  out = out.replace(/<\s*center\b[^>]*>/gi, "<div>");
  out = out.replace(/<\s*\/\s*center\s*>/gi, "</div>");

  return out.trim();
}

/**
 * Remove <img> tags from description HTML. Used for temporarily unavailable
 * products whose descriptions embed promotional/purchase imagery that should
 * not display while sales are disabled. Reversible: callers apply this only
 * when a product is flagged unavailable, so the original data is untouched.
 */
export function stripLegacyEbookDescriptionImages(html: string): string {
  if (!html) return "";
  return html.replace(/<\s*img\b[^>]*>/gi, "").trim();
}
