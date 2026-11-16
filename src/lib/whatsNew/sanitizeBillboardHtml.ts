import { normalizeWhatsNewDestinationUrl } from "./destinationUrl";

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "a", "img"]);
/** Card messages use the same formatting, links, and safe site images. */
const CARD_ALLOWED_TAGS = ALLOWED_TAGS;
const VOID_TAGS = new Set(["br", "img"]);
/** Encoded `<img` only. Ordinary text, including `&lt;` that is not an image, stays put. */
const ENCODED_IMAGE_TAG = /&(?:amp;)*lt;\s*img\b/i;
/** Escaped message tags, used only when the value has no real tags yet. */
const ENCODED_MESSAGE_TAG = /&(?:amp;)*lt;\s*\/?\s*(?:p|br|strong|em|b|i|ul|ol|li|a|img)\b/i;
/** Site path only: one leading slash, no scheme, traversal, query, or spaces. */
const SAFE_SITE_IMAGE_SRC = /^\/(?!\/)(?!.*\.\.)[A-Za-z0-9/._~-]+$/;
/** Drop these tags and their inner content entirely. */
const SKIP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "svg",
  "math",
  "textarea",
  "title",
  "template",
]);

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Decode each entity once. `&amp;lt;` becomes `&lt;`, not `<`, so a later escape
 * does not add another `&amp;` and does not turn ordinary text into a tag.
 */
function decodeMarkupEntitiesOnce(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos);/gi, (entity) => {
    switch (entity.toLowerCase()) {
      case "&amp;":
        return "&";
      case "&lt;":
        return "<";
      case "&gt;":
        return ">";
      case "&quot;":
        return '"';
      case "&#39;":
      case "&apos;":
        return "'";
      default:
        return entity;
    }
  });
}

function escapeTextNode(text: string): string {
  return escapeText(decodeMarkupEntitiesOnce(text));
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function looksLikeHtml(input: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

/**
 * One pass of the entities produced by HTML-escaping a previous pass.
 * Ampersands are decoded first so `&amp;lt;` becomes `&lt;`.
 */
function decodeEscapedMarkupOnce(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#x0*26;/gi, "&")
    .replace(/&lt;/g, "<")
    .replace(/&#0*60;/g, "<")
    .replace(/&#x0*3c;/gi, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*62;/g, ">")
    .replace(/&#x0*3e;/gi, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*34;/g, '"')
    .replace(/&#x0*22;/gi, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/**
 * Restore a repeatedly escaped `<img` tag so a later save does not escape it again.
 * Stops as soon as a real image tag is present. Text without an encoded image is unchanged.
 */
function unwrapEncodedCardImages(value: string): string {
  let current = value;
  for (let pass = 0; pass < 8; pass += 1) {
    if (!ENCODED_IMAGE_TAG.test(current)) break;
    const next = decodeEscapedMarkupOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Restore HTML that was saved as visible text. A message that already has real
 * tags is left alone except for an encoded image. Plain `&amp;` and `&lt;` stay
 * one level deep so saving again does not keep escaping them.
 */
function prepareMessageHtml(value: string): string {
  if (ENCODED_IMAGE_TAG.test(value)) return unwrapEncodedCardImages(value);
  if (looksLikeHtml(value) || !ENCODED_MESSAGE_TAG.test(value)) return value;
  let current = value;
  for (let pass = 0; pass < 8; pass += 1) {
    if (looksLikeHtml(current)) break;
    const next = decodeEscapedMarkupOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function readAttribute(attrs: string, name: string): string | null {
  const match = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

/** Pixel widths an editor may save. 202px is 30% smaller than the 288px billboard preview. */
const IMAGE_WIDTH_PX_MIN = 32;
const IMAGE_WIDTH_PX_MAX = 800;

/**
 * A pixel width or a 10–100% width. Anything else, including extra style
 * properties, is dropped so the saved tag stays editable and safe.
 */
function safeImageWidth(attrs: string): string | null {
  const style = readAttribute(attrs, "style") ?? "";
  const styleWidth = style.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "";
  const raw = styleWidth || (readAttribute(attrs, "width") ?? "");
  if (!raw) return null;
  const percent = raw.match(/^(\d{1,3})%$/);
  if (percent) {
    const value = Number(percent[1]);
    if (value < 10 || value > 100) return null;
    return `${value}%`;
  }
  const pixels = raw.match(/^(\d{1,4})(?:px)?$/i);
  if (!pixels) return null;
  const value = Number(pixels[1]);
  if (value < IMAGE_WIDTH_PX_MIN || value > IMAGE_WIDTH_PX_MAX) return null;
  return String(value);
}

/** True when the image asks to be centered. Other classes and styles are not kept. */
function imageIsCentered(attrs: string): boolean {
  const align = (readAttribute(attrs, "align") ?? "").toLowerCase();
  if (align === "center" || align === "middle") return true;
  const className = readAttribute(attrs, "class") ?? "";
  return className.split(/\s+/).some((token) => token.toLowerCase() === "center");
}

/** A site image tag, or null when the address is not a local path. Event handlers are dropped. */
function safeCardImageTag(attrs: string): string | null {
  const src = readAttribute(attrs, "src");
  if (!src || !SAFE_SITE_IMAGE_SRC.test(src)) return null;
  const alt = escapeText(
    decodeBasicEntities(readAttribute(attrs, "alt") ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim(),
  );
  const center = imageIsCentered(attrs) ? ' class="center"' : "";
  const width = safeImageWidth(attrs);
  const widthAttr =
    width == null ? "" : width.endsWith("%") ? ` style="width: ${width}"` : ` width="${width}"`;
  return `<img src="${src}" alt="${alt}"${center}${widthAttr}>`;
}

function normalizeTagName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower === "b") return "strong";
  if (lower === "i") return "em";
  if (ALLOWED_TAGS.has(lower)) return lower;
  return null;
}

function normalizeCardTagName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower === "b") return "strong";
  if (lower === "i") return "em";
  if (CARD_ALLOWED_TAGS.has(lower)) return lower;
  return null;
}

function extractHref(attrs: string): string | null {
  const match = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) return null;
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

/** Visible text used for emptiness checks (not for rendering). */
export function billboardMessagePlainText(html: string): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeBasicEntities(withBreaks).replace(/\s+/g, " ").trim();
}

export function billboardMessageHasText(html: string): boolean {
  return billboardMessagePlainText(html).length > 0;
}

/** Normalize plain text into safe paragraph markup. */
export function plainTextToBillboardHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((para) => {
      const lines = para.split("\n").map((line) => escapeText(line));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

type TagToken = {
  type: "tag";
  name: string;
  closing: boolean;
  attrs: string;
};

type TextToken = {
  type: "text";
  value: string;
};

type Token = TagToken | TextToken;

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[3] != null) {
      tokens.push({ type: "text", value: match[3] });
      continue;
    }
    const raw = match[0];
    tokens.push({
      type: "tag",
      name: match[1],
      closing: raw.startsWith("</"),
      attrs: match[2] || "",
    });
  }
  return tokens;
}

/**
 * Sanitize What's New billboard message HTML.
 * Allows only: p, br, strong (b→strong), em (i→em), ul, ol, li, a[href], and img
 * whose src is a site path. Plain text is wrapped in safe paragraphs.
 */
export function sanitizeBillboardHtml(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = prepareMessageHtml(input).trim();
  if (!trimmed) return "";

  if (!looksLikeHtml(trimmed)) {
    return plainTextToBillboardHtml(trimmed);
  }

  const cleaned = trimmed.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  const tokens = tokenize(cleaned);
  const stack: string[] = [];
  let out = "";
  let skipUntil: string | null = null;
  /** Closing tags for anchors we refused to open (bad href). */
  let skippedAnchorDepth = 0;

  const closeUntil = (tag: string): void => {
    while (stack.length) {
      const top = stack.pop()!;
      out += `</${top}>`;
      if (top === tag) break;
    }
  };

  for (const tok of tokens) {
    if (skipUntil) {
      if (tok.type === "tag" && tok.closing && tok.name.toLowerCase() === skipUntil) {
        skipUntil = null;
      }
      continue;
    }

    if (tok.type === "text") {
      out += escapeTextNode(tok.value);
      continue;
    }

    const lowerName = tok.name.toLowerCase();

    if (!tok.closing && SKIP_CONTENT_TAGS.has(lowerName)) {
      skipUntil = lowerName;
      continue;
    }

    const tag = normalizeTagName(tok.name);
    if (!tag) {
      continue;
    }

    if (tok.closing) {
      if (VOID_TAGS.has(tag)) continue;
      if (tag === "a" && skippedAnchorDepth > 0 && !stack.includes("a")) {
        skippedAnchorDepth -= 1;
        continue;
      }
      if (stack.includes(tag)) closeUntil(tag);
      continue;
    }

    if (tag === "br") {
      out += "<br>";
      continue;
    }

    if (tag === "img") {
      const image = safeCardImageTag(tok.attrs);
      if (image) out += image;
      continue;
    }

    if (tag === "a") {
      const hrefRaw = extractHref(tok.attrs);
      const hrefResult = normalizeWhatsNewDestinationUrl(hrefRaw);
      if (!hrefResult.ok || !hrefResult.value) {
        skippedAnchorDepth += 1;
        continue;
      }
      const href = hrefResult.value;
      const isExternal = href.startsWith("https://");
      const rel = isExternal ? ' rel="noopener noreferrer"' : "";
      out += `<a href="${escapeText(href)}"${rel}>`;
      stack.push("a");
      continue;
    }

    out += `<${tag}>`;
    stack.push(tag);
  }

  while (stack.length) {
    out += `</${stack.pop()}>`;
  }

  if (!billboardMessageHasText(out) && !/<img\b/i.test(out)) return "";

  // Ensure block structure for orphan inline fragments (e.g. pasted "hello <b>there</b>").
  if (!/<(?:p|ul|ol)\b/i.test(out)) {
    return `<p>${out}</p>`;
  }

  return out;
}

/** Visible text summary for a card description (admin previews, length checks). */
export function cardDescriptionPlainText(html: string): string {
  return billboardMessagePlainText(html);
}

/**
 * Sanitize What's New card description HTML.
 * Allows p, br, strong (b→strong), em (i→em), ul, ol, li, safe links, and img
 * whose src is a site path such as /images/thank-you.jpg. Unsafe HTML is removed.
 * Saving the same message again does not escape its tags into visible text.
 * Plain text is wrapped in safe paragraphs.
 */
export function sanitizeCardDescriptionHtml(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = prepareMessageHtml(input).trim();
  if (!trimmed) return "";

  if (!looksLikeHtml(trimmed)) {
    return plainTextToBillboardHtml(trimmed);
  }

  const cleaned = trimmed.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  const tokens = tokenize(cleaned);
  const stack: string[] = [];
  let out = "";
  let skipUntil: string | null = null;
  /** Closing tags for anchors we refused to open (bad href). */
  let skippedAnchorDepth = 0;

  const closeUntil = (tag: string): void => {
    while (stack.length) {
      const top = stack.pop()!;
      out += `</${top}>`;
      if (top === tag) break;
    }
  };

  for (const tok of tokens) {
    if (skipUntil) {
      if (tok.type === "tag" && tok.closing && tok.name.toLowerCase() === skipUntil) {
        skipUntil = null;
      }
      continue;
    }

    if (tok.type === "text") {
      out += escapeTextNode(tok.value);
      continue;
    }

    const lowerName = tok.name.toLowerCase();

    if (!tok.closing && SKIP_CONTENT_TAGS.has(lowerName)) {
      skipUntil = lowerName;
      continue;
    }

    const tag = normalizeCardTagName(tok.name);
    // Unsupported tags are dropped; their text is preserved.
    if (!tag) {
      continue;
    }

    if (tok.closing) {
      if (VOID_TAGS.has(tag)) continue;
      if (tag === "a" && skippedAnchorDepth > 0 && !stack.includes("a")) {
        skippedAnchorDepth -= 1;
        continue;
      }
      if (stack.includes(tag)) closeUntil(tag);
      continue;
    }

    if (tag === "br") {
      out += "<br>";
      continue;
    }

    if (tag === "img") {
      const image = safeCardImageTag(tok.attrs);
      if (image) out += image;
      continue;
    }

    if (tag === "a") {
      const hrefRaw = extractHref(tok.attrs);
      const hrefResult = normalizeWhatsNewDestinationUrl(hrefRaw);
      if (!hrefResult.ok || !hrefResult.value) {
        skippedAnchorDepth += 1;
        continue;
      }
      const href = hrefResult.value;
      const isExternal = href.startsWith("https://");
      const rel = isExternal ? ' rel="noopener noreferrer"' : "";
      out += `<a href="${escapeText(href)}"${rel}>`;
      stack.push("a");
      continue;
    }

    out += `<${tag}>`;
    stack.push(tag);
  }

  while (stack.length) {
    out += `</${stack.pop()}>`;
  }

  if (!billboardMessageHasText(out) && !/<img\b/i.test(out)) return "";

  // Ensure block structure for orphan inline fragments (e.g. pasted "hello <b>there</b>").
  if (!/<(?:p|ul|ol)\b/i.test(out)) {
    return `<p>${out}</p>`;
  }

  return out;
}
