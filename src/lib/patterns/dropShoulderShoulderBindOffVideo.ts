/**
 * Single hardcoded explainer video for the Drop Shoulder pattern's shoulder
 * bind-off step. Intentionally minimal ù no JSON, admin UI, or video registry.
 *
 * It reuses the site's existing collapsible Pattern Tip (Quick Tip) system, so it
 * inherits the shared show/hide behaviour: it collapses/expands like other tips and
 * is hidden whenever pattern tips are hidden. It is screen-only and omitted from print
 * via the established `pattern-print-personalization-never-print` tip class.
 *
 * The embed mirrors the responsive iframe used by `src/components/media/VimeoEmbed.astro`
 * (that Astro component can't render inside the client-side pattern renderer, so the same
 * player embed is reproduced here as a trusted HTML string).
 */
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";

export const DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO = {
  vimeoId: "1208746621",
  title: "My Favorite Bind Off",
  duration: "1:20",
  heading: "Bind-Off Refresher",
} as const;

/** Stable id for the tip wrapper (`data-tip-id`) ù enables per-tip dismiss. */
export const DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID =
  "drop-shoulder-shoulder-bind-off-video";

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Trusted body markup shown inside the expanded Quick Tip (Vimeo embed + title + duration). */
export function dropShoulderShoulderBindOffVideoBodyHtml(
  video = DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO,
): string {
  const src = `https://player.vimeo.com/video/${encodeURIComponent(
    video.vimeoId,
  )}?byline=0&portrait=0`;
  const title = escapeAttr(video.title);
  return [
    `<div class="ds-bindoff-video" data-explainer-video="drop-shoulder-shoulder-bind-off" style="max-width:640px;">`,
    `<div class="ds-bindoff-video__frame" style="position:relative;width:100%;padding-bottom:56.25%;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(82,104,45,0.15);">`,
    `<iframe src="${escapeAttr(src)}" title="${title}" aria-label="${title}"`,
    ` frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" allowfullscreen loading="lazy"`,
    ` style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>`,
    `</div>`,
    `<p class="ds-bindoff-video__caption" style="margin:0.5rem 0 0;font-size:0.85rem;color:#4b5563;">`,
    `<span style="font-weight:600;color:#374151;">${escapeText(video.title)}</span>`,
    ` <span aria-hidden="true">ù</span> <span>${escapeText(video.duration)}</span>`,
    `</p>`,
    `</div>`,
  ].join("");
}

/**
 * A collapsible Pattern Tip (Quick Tip) display row carrying the explainer video.
 * Insert immediately before the shoulder bind-off instructions in the Drop Shoulder pattern.
 */
export function dropShoulderShoulderBindOffVideoRow(): Extract<
  SleevelessPatternDisplayRow,
  { kind: "block" }
> {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO.heading,
      bodyHtml: dropShoulderShoulderBindOffVideoBodyHtml(),
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: DROP_SHOULDER_SHOULDER_BIND_OFF_VIDEO_TIP_ID,
    // Screen-only: hidden in print via the shared "never print this tip" hook in pattern-tips.css.
    tipWrapperClass: "pattern-print-personalization-never-print",
  };
}
