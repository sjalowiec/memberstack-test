/**
 * Reusable Help Card markup for pattern instructional support (trusted HTML only — never user input).
 * Richer than a Quick Tip: multiple paragraphs, glossary placeholders, images, video links.
 * Pair with `pattern-help-card.css` and {@link patternTipWrapperHtml} (`tipPresentation: "help-card"`).
 */

export type PatternHelpCardOptions = {
  /** Collapsed header title (plain text). */
  title: string;
  /** Trusted HTML inside the expanded body. */
  bodyHtml: string;
  /**
   * Header icon: omit for default book-open; `false` for no icon;
   * or trusted `<i class="...">` markup only.
   */
  icon?: string | false;
  /** When true, `<details>` starts expanded on screen (print still forces open). */
  defaultOpen?: boolean;
};

const DEFAULT_HELP_CARD_ICON =
  '<i class="fa-solid fa-book-open pattern-help-card__icon" aria-hidden="true"></i>';

function resolveHelpCardIcon(icon: PatternHelpCardOptions["icon"]): string {
  if (icon === false) return "";
  if (typeof icon === "string" && icon.trim()) return icon.trim();
  return DEFAULT_HELP_CARD_ICON;
}

/** Inner `<details>` markup; wrapped by `.pattern-tip.pattern-help-card` in the pattern renderer. */
export function buildPatternHelpCardInnerHtml(options: PatternHelpCardOptions): string {
  const title = String(options.title ?? "").trim();
  const body = String(options.bodyHtml ?? "").trim();
  const openAttr = options.defaultOpen ? " open" : "";
  const iconMarkup = resolveHelpCardIcon(options.icon);
  const iconInSummary = iconMarkup
    ? `<span class="pattern-help-card__icon-wrap">${iconMarkup}</span>`
    : "";

  return (
    `<details class="pattern-help-card__details"${openAttr}>` +
    '<summary class="pattern-help-card__summary">' +
    '<span class="pattern-help-card__chevron" aria-hidden="true">' +
    '<i class="fa-solid fa-chevron-right"></i></span>' +
    '<span class="pattern-help-card__summary-inner">' +
    iconInSummary +
    `<span class="pattern-help-card__title">${title}</span>` +
    "</span></summary>" +
    `<div class="pattern-help-card__body">${body}</div>` +
    "</details>"
  );
}
