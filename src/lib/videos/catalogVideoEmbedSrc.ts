/**
 * Stable Vimeo iframe / Player API id. Prefer the numeric Vimeo id so the
 * iframe `id`, `player_id` query param, and seek lookup stay in sync.
 */
export function catalogVimeoIframePlayerId(
  vimeoId?: string | null,
  contentId?: string | null,
): string {
  const vimeo = String(vimeoId ?? "").trim();
  if (vimeo) return `kbm-gated-vimeo-${vimeo}`;
  const content = String(contentId ?? "").trim();
  return content ? `kbm-gated-vimeo-${content}` : "";
}

/**
 * Build the Vimeo player embed URL. Callers must not put this on member-only
 * pages until playback access is confirmed.
 */
export function buildCatalogVimeoEmbedSrc(options: {
  vimeoId: string;
  privacyHash?: string | null;
  enableVimeoPlayerApi?: boolean;
  iframePlayerId?: string;
}): string {
  const vimeoId = String(options.vimeoId ?? "").trim();
  if (!vimeoId) return "";
  const iframeUrl = new URL(`https://player.vimeo.com/video/${vimeoId}`);
  const privacyHash = String(options.privacyHash ?? "").trim();
  if (privacyHash && /^[a-zA-Z0-9]+$/.test(privacyHash)) {
    iframeUrl.searchParams.set("h", privacyHash);
  }
  if (options.enableVimeoPlayerApi) {
    iframeUrl.searchParams.set("api", "1");
    const playerId =
      String(options.iframePlayerId ?? "").trim() || catalogVimeoIframePlayerId(vimeoId);
    if (playerId) iframeUrl.searchParams.set("player_id", playerId);
  }
  return iframeUrl.toString();
}
