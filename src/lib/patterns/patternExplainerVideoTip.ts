/**
 * Shared responsive Vimeo embed markup for pattern Quick Tips.
 *
 * Mirrors `src/components/media/VimeoEmbed.astro` (that Astro component can't render inside the
 * client-side pattern renderer). The iframe is hidden in print via
 * {@link PATTERN_TIP_MEDIA_NO_PRINT_CLASS}; tip summary/caption still follow normal tip print rules.
 */

/** Hide embedded media (iframe/player) in print; tip wrapper and text still print. */
export const PATTERN_TIP_MEDIA_NO_PRINT_CLASS = "pattern-tip-media-no-print";

export type PatternExplainerVideo = {
  vimeoId: string;
  title: string;
  /** Optional duration shown after the title in the caption (e.g. `"1:20"`). */
  duration?: string;
  /** Unlisted catalog `vimeo_hash`. Added to the player URL as `h=`. */
  privacyHash?: string;
  /** Catalog poster / fallback image URL (data attribute on the embed wrapper). */
  posterUrl?: string;
};

function privacyHashQueryValue(raw: string | undefined): string | undefined {
  const hash = String(raw ?? "").trim();
  return hash && /^[a-zA-Z0-9]+$/.test(hash) ? hash : undefined;
}

/** Player URL for a catalog-resolved explainer (privacy hash when present). */
export function patternExplainerVideoPlayerSrc(video: PatternExplainerVideo): string {
  const url = new URL(`https://player.vimeo.com/video/${encodeURIComponent(video.vimeoId)}`);
  url.searchParams.set("byline", "0");
  url.searchParams.set("portrait", "0");
  const hash = privacyHashQueryValue(video.privacyHash);
  if (hash) url.searchParams.set("h", hash);
  return url.toString();
}

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

export type BuildPatternExplainerVideoBodyHtmlOptions = {
  video: PatternExplainerVideo;
  /** Value for `data-explainer-video`. */
  explainerKey: string;
  /** Optional trusted intro HTML placed above the embed (e.g. a `<p>`). */
  introHtml?: string;
  /** BEM-ish class prefix for wrapper/frame/caption (default `pattern-explainer-video`). */
  classPrefix?: string;
};

/** Trusted body markup: optional intro + responsive Vimeo iframe + title caption. */
export function buildPatternExplainerVideoBodyHtml(
  options: BuildPatternExplainerVideoBodyHtmlOptions,
): string {
  const video = options.video;
  const prefix = options.classPrefix?.trim() || "pattern-explainer-video";
  const src = patternExplainerVideoPlayerSrc(video);
  const title = escapeAttr(video.title);
  const duration = String(video.duration ?? "").trim();
  const intro = String(options.introHtml ?? "").trim();
  const poster = String(video.posterUrl ?? "").trim();
  const posterAttr = poster ? ` data-poster-url="${escapeAttr(poster)}"` : "";
  const parts: string[] = [];
  if (intro) parts.push(intro);
  parts.push(
    `<div class="${prefix}" data-explainer-video="${escapeAttr(options.explainerKey)}"${posterAttr} style="max-width:640px;">`,
    `<div class="${prefix}__frame ${PATTERN_TIP_MEDIA_NO_PRINT_CLASS}" style="position:relative;width:100%;padding-bottom:56.25%;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(82,104,45,0.15);">`,
    `<iframe src="${escapeAttr(src)}" title="${title}" aria-label="${title}"`,
    ` frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write" allowfullscreen loading="lazy"`,
    ` style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>`,
    `</div>`,
    `<p class="${prefix}__caption" style="margin:0.5rem 0 0;font-size:0.85rem;color:#4b5563;">`,
    `<span style="font-weight:600;color:#374151;">${escapeText(video.title)}</span>`,
  );
  if (duration) {
    parts.push(
      ` <span aria-hidden="true">ù</span> <span>${escapeText(duration)}</span>`,
    );
  }
  parts.push(`</p>`, `</div>`);
  return parts.join("");
}
