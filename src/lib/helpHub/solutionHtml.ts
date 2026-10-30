/**
 * Supported tags that may appear as real markup in Help Hub solution text.
 * Ordinary prose is left alone, including &, quotes, and angle brackets.
 */
const ENCODED_SUPPORTED_TAG =
  /&(?:amp;)*lt;\s*\/?\s*(?:img|p|br|a|strong|em|b|i|u|ul|ol|li|h2|h3|figure|figcaption)\b/i;

const UNSAFE_URL = /^(?:javascript|data|vbscript):/i;

/**
 * One pass of the entities produced by HTML-escaping a previous pass.
 * Ampersands are decoded first so `&amp;lt;` becomes `&lt;` and a later pass
 * can reach the tag. This does not loop by itself.
 */
function decodeSolutionEntitiesOnce(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/**
 * Undo repeated escaping only when the text is encoded supported markup.
 * Prose such as `2 & 4` or `a < b` does not match and is returned unchanged.
 * At most eight passes, which covers the stacked `&amp;amp;…lt;` form.
 */
export function unwrapOverencodedSolutionMarkup(value: string): string {
  let current = value;
  for (let pass = 0; pass < 8; pass += 1) {
    if (!ENCODED_SUPPORTED_TAG.test(current)) break;
    const next = decodeSolutionEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function isUnsafeSolutionUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (UNSAFE_URL.test(trimmed)) return true;
  if (trimmed.startsWith("//")) return true;
  return false;
}

/**
 * Drop scripts, event handlers, and dangerous URLs.
 * Safe tags, attributes, and text are copied through unchanged so `&` in a
 * link is not escaped again on the next save.
 */
export function stripUnsafeHelpHubSolutionHtml(value: string): string {
  let html = value.replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  html = html.replace(
    /<\/?(?:script|style|iframe|object|embed|link|meta|base|form|input|textarea|button)\b[^>]*>/gi,
    "",
  );
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(
    /\s(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (match, _attr: string, dbl?: string, sgl?: string, bare?: string) => {
      const url = dbl ?? sgl ?? bare ?? "";
      if (isUnsafeSolutionUrl(url)) return "";
      return match;
    },
  );
  return html;
}

/**
 * Solution HTML stored and shown in the editor.
 * Repeatedly escaped tags are restored. A second call does not change the result.
 */
export function canonicalHelpHubSolutionHtml(value: string): string {
  return stripUnsafeHelpHubSolutionHtml(unwrapOverencodedSolutionMarkup(value)).trim();
}

function isSiteImagePath(url: string): boolean {
  const path = url.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false;
  return true;
}

/** Image tag inserted into the solution textarea. Null when the address is not a site path. */
export function helpHubSolutionImageTag(src: string, alt: string): string | null {
  const path = src.trim();
  if (!isSiteImagePath(path) || /[\s"'<>]/.test(path)) return null;
  const safeAlt = alt
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<img src="${path}" alt="${safeAlt}">`;
}
