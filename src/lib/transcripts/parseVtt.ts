/**
 * Convert a WebVTT caption file into readable plain text for on-page /
 * print transcripts. Does not emit HTML. Returns null when the input is
 * empty, not a caption file, or has no useful spoken text.
 */

const TIMESTAMP_LINE =
  /^(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}\b/;

const BLOCK_SKIP = /^(NOTE|STYLE|REGION)(\s|$)/;

const HTML_PREFIX = /^\s*<(!DOCTYPE|html|head|body)\b/i;

const PLACEHOLDER_ONLY = /^(key information can go here|dsfsd)$/i;

export function parseVttToReadableText(raw: string | null | undefined): string | null {
  if (raw == null) return null;

  const withoutBom = raw.replace(/^\uFEFF/, "").replace(/^\u200B/, "");
  const trimmed = withoutBom.trim();
  if (!trimmed) return null;
  if (HTML_PREFIX.test(trimmed) || /<html[\s>]/i.test(trimmed.slice(0, 400))) {
    return null;
  }

  const lines = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const cues = collectCueTexts(lines);
  const deduped = dedupeConsecutiveCues(cues);
  const useful = deduped.filter((cue) => cue.length > 0 && !PLACEHOLDER_ONLY.test(cue));
  if (useful.length === 0) return null;

  const readable = formatReadableParagraphs(useful);
  return readable || null;
}

function collectCueTexts(lines: string[]): string[] {
  const cues: string[] = [];
  let i = 0;

  if (isWebvttHeader(lines[i])) {
    i += 1;
    while (i < lines.length && lines[i].trim() !== "") i += 1;
    while (i < lines.length && lines[i].trim() === "") i += 1;
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "") {
      i += 1;
      continue;
    }

    if (isWebvttHeader(trimmed)) {
      i += 1;
      continue;
    }

    if (BLOCK_SKIP.test(trimmed)) {
      i += 1;
      while (i < lines.length && lines[i].trim() !== "") i += 1;
      continue;
    }

    if (TIMESTAMP_LINE.test(trimmed)) {
      i += 1;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        const body = lines[i].trim();
        if (!TIMESTAMP_LINE.test(body) && !isWebvttHeader(body) && !BLOCK_SKIP.test(body)) {
          textLines.push(body);
        }
        i += 1;
      }
      const cue = stripCaptionMarkup(textLines.join(" "));
      if (cue) cues.push(cue);
      continue;
    }

    const next = lines[i + 1]?.trim() ?? "";
    if (TIMESTAMP_LINE.test(next)) {
      i += 1;
      continue;
    }

    i += 1;
  }

  return cues;
}

function isWebvttHeader(line: string | undefined): boolean {
  if (!line) return false;
  const t = line.trim();
  return t === "WEBVTT" || t.startsWith("WEBVTT ");
}

function stripCaptionMarkup(value: string): string {
  let out = value.replace(/<\d{1,2}:\d{2}(?::\d{2})?\.\d{3}>/g, "");
  out = out.replace(/<\/?[^>]+>/g, "");
  out = out
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return out.replace(/\s+/g, " ").trim();
}

function dedupeConsecutiveCues(cues: string[]): string[] {
  const out: string[] = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(cue);
      continue;
    }
    if (cue === prev) continue;
    if (isRollingExpansion(prev, cue)) {
      out[out.length - 1] = cue;
      continue;
    }
    if (isRollingExpansion(cue, prev)) continue;
    out.push(cue);
  }
  return out;
}

function isRollingExpansion(shorter: string, longer: string): boolean {
  if (longer.length <= shorter.length) return false;
  if (longer === shorter) return false;
  if (longer.startsWith(shorter + " ")) return true;
  if (longer.startsWith(shorter) && /[\s,.;:!?']/.test(longer.charAt(shorter.length))) {
    return true;
  }
  return false;
}

function formatReadableParagraphs(cues: string[]): string {
  const body = cues.join(" ").replace(/\s+/g, " ").trim();
  if (!body) return "";
  const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    buffer.push(sentence);
    length += sentence.length;
    if (length >= 220) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
      length = 0;
    }
  }
  if (buffer.length) paragraphs.push(buffer.join(" "));
  return paragraphs.join("\n\n");
}
