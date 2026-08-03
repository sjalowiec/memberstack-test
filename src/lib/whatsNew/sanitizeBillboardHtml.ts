import { normalizeWhatsNewDestinationUrl } from "./destinationUrl";

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "a"]);
/** Card descriptions reuse the billboard allowlist minus links. */
const CARD_ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "ul", "ol", "li"]);
const VOID_TAGS = new Set(["br"]);
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
 * Allows only: p, br, strong (b?strong), em (i?em), ul, ol, li, a[href].
 * Plain text is wrapped in safe paragraphs.
 */
export function sanitizeBillboardHtml(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
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
      out += escapeText(tok.value);
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

  if (!billboardMessageHasText(out)) return "";

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
 * Mirrors sanitizeBillboardHtml but drops links: card CTAs use dedicated fields.
 * Allows only: p, br, strong (b?strong), em (i?em), ul, ol, li.
 * Plain text is wrapped in safe paragraphs.
 */
export function sanitizeCardDescriptionHtml(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (!looksLikeHtml(trimmed)) {
    return plainTextToBillboardHtml(trimmed);
  }

  const cleaned = trimmed.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  const tokens = tokenize(cleaned);
  const stack: string[] = [];
  let out = "";
  let skipUntil: string | null = null;

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
      out += escapeText(tok.value);
      continue;
    }

    const lowerName = tok.name.toLowerCase();

    if (!tok.closing && SKIP_CONTENT_TAGS.has(lowerName)) {
      skipUntil = lowerName;
      continue;
    }

    const tag = normalizeCardTagName(tok.name);
    // Unsupported tags (including links) are dropped; their text is preserved.
    if (!tag) {
      continue;
    }

    if (tok.closing) {
      if (VOID_TAGS.has(tag)) continue;
      if (stack.includes(tag)) closeUntil(tag);
      continue;
    }

    if (tag === "br") {
      out += "<br>";
      continue;
    }

    out += `<${tag}>`;
    stack.push(tag);
  }

  while (stack.length) {
    out += `</${stack.pop()}>`;
  }

  if (!billboardMessageHasText(out)) return "";

  // Ensure block structure for orphan inline fragments (e.g. pasted "hello <b>there</b>").
  if (!/<(?:p|ul|ol)\b/i.test(out)) {
    return `<p>${out}</p>`;
  }

  return out;
}
