/** Glossary entry for traditional stitches–rows–times diagram notation. */
export const JAPANESE_NOTATION_TRADITIONAL_GLOSSARY_ID = 1779400000001;

/** Glossary entry for Knit It Now shaping notation charts (row-by-row wording). */
export const SHAPING_NOTATION_KIN_GLOSSARY_ID = 1779400000002;

/** Vimeo tutorial embedded above shaping notation garment diagrams. */
export const SHAPING_NOTATION_CHART_HELP_VIMEO_ID = "1195771788";

const SHAPING_NOTATION_CHART_HELP_VIDEO_TITLE = "Watch How This Chart Works";

/** Inline Vimeo player URL (no autoplay; matches site embed query params). */
export function buildShapingNotationChartHelpVimeoSrc(vimeoId: string): string {
  const id = String(vimeoId || "").trim();
  if (!/^\d+$/.test(id)) return "";
  const params = new URLSearchParams({ byline: "0", portrait: "0" });
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

/**
 * Help panel above inline shaping notation diagrams (shown in Shaping Notation diagram mode).
 */
/**
 * Compact help trigger for Visual Guides and other inline notation contexts.
 * Opens the same Vimeo walkthrough via the page's sleeveless video modal.
 */
export function buildShapingNotationChartHelpTriggerHtml(
  escapeAttr: (s: string) => string,
  escapeText: (s: string) => string,
): string {
  const title = escapeText(SHAPING_NOTATION_CHART_HELP_VIDEO_TITLE);
  const titleAttr = escapeAttr(SHAPING_NOTATION_CHART_HELP_VIDEO_TITLE);
  const vimeoId = escapeAttr(SHAPING_NOTATION_CHART_HELP_VIMEO_ID);
  return `<p class="ns-visual-guides__notation-help no-print">
  <button type="button" class="pattern-help-link__button" data-sleeveless-video-id="${vimeoId}" data-video-title="${titleAttr}" aria-haspopup="dialog">
    <i class="fa-solid fa-play" aria-hidden="true"></i> ${title}
  </button>
</p>`;
}

export function buildShapingNotationChartHelpHtml(
  escapeAttr: (s: string) => string,
  escapeText: (s: string) => string,
): string {
  const vimeoId = SHAPING_NOTATION_CHART_HELP_VIMEO_ID;
  const iframeSrc = buildShapingNotationChartHelpVimeoSrc(vimeoId);
  const title = escapeAttr(SHAPING_NOTATION_CHART_HELP_VIDEO_TITLE);
  const heading = escapeText("Watch How This Chart Works");
  const supporting = escapeText(
    "See how the shaping notation matches the row-by-row instructions while knitting.",
  );
  return `<div class="sleeveless-shaping-notation-help no-print" data-sleeveless-shaping-notation-help hidden>
  <h3 class="sleeveless-shaping-notation-help__heading">${heading}</h3>
  <p class="sleeveless-shaping-notation-help__text">${supporting}</p>
  <div class="sleeveless-shaping-notation-help__video">
    <div class="sleeveless-shaping-notation-help__video-aspect">
      <iframe
        src="${escapeAttr(iframeSrc)}"
        title="${title}"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
      ></iframe>
    </div>
  </div>
  <p class="sleeveless-shaping-notation-help__actions">
    <button
      type="button"
      class="sleeveless-shaping-notation-help__watch-larger"
      data-sleeveless-video-id="${escapeAttr(vimeoId)}"
      data-video-title="${title}"
    >Watch larger</button>
  </p>
</div>`;
}
