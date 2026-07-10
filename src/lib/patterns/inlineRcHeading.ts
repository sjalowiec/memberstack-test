/**
 * Inline presentation markers for instruction prose.
 *
 * Some grouped instructions (drop-shoulder neck execution) begin on a new row counter within a
 * single display block, and some carry internal side subheadings (RIGHT SIDE / LEFT SIDE). Instead
 * of embedding these in body text, the generator emits marker lines that the pattern renderers
 * promote to an RC heading or a small subheading — visually consistent everywhere the shared
 * instruction system is used. This is presentation only; no calculation depends on it.
 */

/** Sentinel prefix identifying a trusted-paragraph line that renders as an RC heading. */
const INLINE_RC_HEADING_PREFIX = "\u0000rc-heading:";
/** Sentinel prefix identifying a trusted-paragraph line that renders as an internal subheading. */
const INLINE_SUBHEADING_PREFIX = "\u0000subheading:";

/** Trusted-paragraph line the renderers display as an RC heading rather than a body line. */
export function inlineRcHeadingLine(rcLabel: string): string {
  return `${INLINE_RC_HEADING_PREFIX}${rcLabel}`;
}

/** Trusted-paragraph line the renderers display as a small internal subheading (e.g. RIGHT SIDE). */
export function inlineSubheadingLine(label: string): string {
  return `${INLINE_SUBHEADING_PREFIX}${label}`;
}

export type InlineMarkedLine =
  | { kind: "rc-heading"; text: string }
  | { kind: "subheading"; text: string };

/** Parsed marker when `line` is an inline RC heading / subheading marker, otherwise `undefined`. */
export function parseInlineMarkedLine(line: string): InlineMarkedLine | undefined {
  if (line.startsWith(INLINE_RC_HEADING_PREFIX)) {
    return { kind: "rc-heading", text: line.slice(INLINE_RC_HEADING_PREFIX.length) };
  }
  if (line.startsWith(INLINE_SUBHEADING_PREFIX)) {
    return { kind: "subheading", text: line.slice(INLINE_SUBHEADING_PREFIX.length) };
  }
  return undefined;
}
