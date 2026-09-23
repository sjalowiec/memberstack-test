function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Catalog poster URLs are public images. Player embeds, scripts, and
 * protocol-relative URLs are not permitted on the denied panel.
 */
export function permittedCatalogThumbnailUrl(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value || /[\s"'<>\\]/.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "";
  if (url.hostname === "player.vimeo.com") return "";
  return value;
}

export function lockedVideoPanelHtml(options: {
  thumbUrl?: string | null;
  showLogin: boolean;
  ctaHref: string;
  ctaText: string;
}): string {
  const thumbUrl = permittedCatalogThumbnailUrl(options.thumbUrl);
  const loginBtn = options.showLogin
    ? `<button type="button" class="kbm-video__cta kbm-video__cta--login" data-kbm-video-login>Already a member? Log in</button>`
    : "";
  const membershipCta = `<a href="${escapeHtml(options.ctaHref)}" class="kbm-video__cta">${escapeHtml(options.ctaText)}</a>`;
  const thumb = thumbUrl
    ? `<img class="kbm-video__thumb" src="${escapeHtml(thumbUrl)}" alt="" />`
    : "";
  const lockedClass = thumbUrl ? "kbm-video__locked kbm-video__locked--thumb" : "kbm-video__locked";
  return `<div class="${lockedClass}">${thumb}<div class="kbm-video__overlay"><div class="kbm-video__lockline"><strong>Members only</strong></div><p class="kbm-video__msg">This video is available with membership.</p><div class="kbm-video__actions">${membershipCta}${loginBtn}</div></div></div>`;
}
