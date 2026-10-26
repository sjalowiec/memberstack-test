/**
 * Shared print-footer text for `@bottom-left` in pattern-print-footer.css.
 * The pattern URL is a second line so it cannot run through the page number.
 */

export const PATTERN_PRINT_FOOTER_ATTRIBUTION = "Created by Knit It Now LLC";

const LEADING_SEPARATOR = /^[\s·•|–—-]+/u;

/** Pattern URL passed through `footerBottomLeftExtra`, without the leading separator. */
export function patternPrintFooterUrl(extra?: string | null): string {
  if (typeof extra !== "string") return "";
  return extra.trim().replace(LEADING_SEPARATOR, "").trim();
}

/** Quote a value for a CSS custom property. Newlines become the `\A` escape. */
export function patternPrintFooterCssString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\A ");
  return `"${escaped}"`;
}

/**
 * One CSS string token for `--pattern-print-footer-bottom-left`.
 * Includes the surrounding quotes. A URL is after a CSS newline escape.
 */
export function patternPrintFooterBottomLeftCssValue(extra?: string | null): string {
  const url = patternPrintFooterUrl(extra);
  const text = url
    ? `${PATTERN_PRINT_FOOTER_ATTRIBUTION}\n${url}`
    : PATTERN_PRINT_FOOTER_ATTRIBUTION;
  return patternPrintFooterCssString(text);
}
