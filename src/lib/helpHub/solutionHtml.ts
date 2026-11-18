import { sanitizeBillboardHtml } from "../whatsNew/sanitizeBillboardHtml";

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

/**
 * Display-only repair. An unquoted image address that ends with a quotation
 * mark is requested as `file.png%22` and never loads. Stored Help Hub text is
 * left unchanged until a later save.
 */
export function solutionHtmlWithLoadableImages(html: string): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (full, prefix: string, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
      const raw = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
      const cleaned = raw.replace(/(?:&quot;|%22|")+$/i, "");
      if (!cleaned || cleaned === raw) return full;
      return `${prefix}"${cleaned}"`;
    },
  );
}

function explanationHasMarkup(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** The visual editor uses divs for Enter. Treat those as paragraphs. */
function editorDivsToParagraphs(html: string): string {
  return html.replace(/<\s*div\b/gi, "<p").replace(/<\s*\/\s*div\s*>/gi, "</p>");
}

const HELP_HUB_SPLIT_CLASS = "help-hub-split";

function attributeValue(attrs: string, name: string): string | null {
  const match = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function hasClass(attrs: string, className: string): boolean {
  const value = attributeValue(attrs, "class") ?? "";
  return value.split(/\s+/).some((token) => token.toLowerCase() === className);
}

function containsHelpHubSplit(html: string): boolean {
  return /<div\b[^>]*\bclass\s*=\s*(?:"[^"]*\bhelp-hub-split\b[^"]*"|'[^']*\bhelp-hub-split\b[^']*')/i.test(
    html,
  );
}

/** End of the div that opened just before `from`. Nested divs stay inside it. */
function matchingDivEnd(html: string, from: number): { closeStart: number; closeEnd: number } | null {
  let depth = 1;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = from;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(html)) !== null) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      return { closeStart: match.index, closeEnd: match.index + match[0].length };
    }
  }
  return null;
}

/**
 * Lift text-and-image layouts out before ordinary editor divs become paragraphs.
 * The slot is plain text so the sanitizer cannot treat it as a tag.
 */
function extractHelpHubSplits(html: string): { html: string; splits: string[] } {
  const splits: string[] = [];
  let out = "";
  let index = 0;
  const openTags = /<div\b([^>]*)>/gi;
  while (index < html.length) {
    openTags.lastIndex = index;
    const match = openTags.exec(html);
    if (!match) {
      out += html.slice(index);
      break;
    }
    const openEnd = openTags.lastIndex;
    if (!hasClass(match[1] || "", HELP_HUB_SPLIT_CLASS)) {
      out += html.slice(index, openEnd);
      index = openEnd;
      continue;
    }
    const close = matchingDivEnd(html, openEnd);
    if (!close) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, match.index);
    out += `help-hub-split-slot-${splits.length}`;
    splits.push(html.slice(openEnd, close.closeStart));
    index = close.closeEnd;
  }
  return { html: out, splits };
}

/** Drop the layout columns so their wrappers are not turned into extra paragraphs. */
function unwrapLayoutColumns(html: string): string {
  let out = "";
  let index = 0;
  const openTags = /<div\b([^>]*)>/gi;
  while (index < html.length) {
    openTags.lastIndex = index;
    const match = openTags.exec(html);
    if (!match) {
      out += html.slice(index);
      break;
    }
    const openEnd = openTags.lastIndex;
    const column =
      hasClass(match[1] || "", `${HELP_HUB_SPLIT_CLASS}__text`) ||
      hasClass(match[1] || "", `${HELP_HUB_SPLIT_CLASS}__image`);
    if (!column) {
      out += html.slice(index, openEnd);
      index = openEnd;
      continue;
    }
    const close = matchingDivEnd(html, openEnd);
    if (!close) {
      out += html.slice(index);
      break;
    }
    out += html.slice(index, match.index);
    out += unwrapLayoutColumns(html.slice(openEnd, close.closeStart));
    index = close.closeEnd;
  }
  return out;
}

/**
 * A paragraph cannot contain another paragraph. Close the outer one first,
 * matching what the editor does when it reads the HTML back.
 */
function closeNestedParagraphs(html: string): string {
  let out = "";
  let paragraphOpen = false;
  const tokens = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|[^<]+/g;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(html)) !== null) {
    if (match[1] == null) {
      out += match[0];
      continue;
    }
    const name = match[1].toLowerCase();
    const closing = match[0].startsWith("</");
    if (closing && name === "p" && !paragraphOpen) continue;
    if (!closing && paragraphOpen && (name === "p" || name === "ul" || name === "ol")) {
      out += "</p>";
      paragraphOpen = false;
    }
    out += match[0];
    if (name === "p") paragraphOpen = !closing;
  }
  if (paragraphOpen) out += "</p>";
  return out.replace(/<p>\s*<\/p>/g, "");
}

function sanitizeExplanationText(html: string): string {
  const clean = sanitizeBillboardHtml(
    decodeHrefAmpersands(editorDivsToParagraphs(unwrapLayoutColumns(html))),
  );
  return closeNestedParagraphs(clean);
}

function safeExplanationImage(tag: string): string {
  const clean = sanitizeBillboardHtml(tag);
  return clean.match(/<img\b[^>]*>/i)?.[0] ?? "";
}

/** One text column and one safe site image. Anything else is ordinary explanation HTML. */
function renderHelpHubSplit(inner: string): string {
  const imageTag = inner.match(/<img\b[^>]*>/i)?.[0] ?? "";
  const image = imageTag ? safeExplanationImage(imageTag) : "";
  if (!image) return sanitizeExplanationText(inner);
  const text = sanitizeExplanationText(inner.replace(imageTag, "")).trim();
  if (!text) return sanitizeBillboardHtml(image);
  return (
    `<div class="${HELP_HUB_SPLIT_CLASS}">` +
    `<div class="${HELP_HUB_SPLIT_CLASS}__text">${text}</div>` +
    `<div class="${HELP_HUB_SPLIT_CLASS}__image" contenteditable="false">${image}</div>` +
    `</div>`
  );
}

function restoreHelpHubSplits(html: string, splits: string[]): string {
  if (!splits.length) return html;
  return html.replace(
    /<p>\s*help-hub-split-slot-(\d+)\s*<\/p>|help-hub-split-slot-(\d+)/g,
    (_full, paragraphSlot?: string, textSlot?: string) =>
      renderHelpHubSplit(splits[Number(paragraphSlot ?? textSlot)] ?? ""),
  );
}

/**
 * Turn one level of `&amp;` inside hrefs back into `&` before the sanitizer
 * escapes it again. A second save then stays on a single `&amp;`.
 */
function decodeHrefAmpersands(html: string): string {
  return html.replace(
    /(\bhref\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi,
    (full, prefix: string, doubleQuoted?: string, singleQuoted?: string) => {
      const href = doubleQuoted ?? singleQuoted ?? "";
      const decoded = href.replace(/&amp;/gi, "&");
      if (decoded === href) return full;
      return `${prefix}"${decoded}"`;
    },
  );
}

/**
 * Explanation HTML that is safe to store and show.
 * Paragraphs, line breaks, bold, italic, lists, links, and site images are kept.
 * Scripts and unsafe URLs are removed.
 * Plain text is returned unchanged so existing Help Hub entries stay as written.
 */
export function renderHelpHubExplanation(value: string): string {
  const canonical = canonicalHelpHubSolutionHtml(value);
  if (!canonical) return "";
  const loadable = solutionHtmlWithLoadableImages(canonical);
  if (!explanationHasMarkup(loadable)) return loadable;
  const extracted = extractHelpHubSplits(loadable);
  return restoreHelpHubSplits(sanitizeExplanationText(extracted.html), extracted.splits);
}

/**
 * Put the explanation's text on the left and one site image on the right.
 * An image already in the explanation is moved. A new image tag is used when
 * the explanation does not have one yet.
 */
export function helpHubExplanationWithImageOnRight(html: string, imageTag?: string): string {
  const canonical = canonicalHelpHubSolutionHtml(html);
  const requested = imageTag?.trim() || "";
  if (containsHelpHubSplit(canonical) && !requested) return renderHelpHubExplanation(canonical);
  const existing = canonical.match(/<img\b[^>]*>/i)?.[0] ?? "";
  const image = requested || existing;
  if (!image) return renderHelpHubExplanation(canonical);
  const text = canonical.replace(/<img\b[^>]*>/gi, "");
  return renderHelpHubExplanation(
    `<div class="${HELP_HUB_SPLIT_CLASS}"><div class="${HELP_HUB_SPLIT_CLASS}__text">${text}</div><div class="${HELP_HUB_SPLIT_CLASS}__image">${image}</div></div>`,
  );
}
