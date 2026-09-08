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
    const playerId = String(options.iframePlayerId ?? "").trim();
    if (playerId) iframeUrl.searchParams.set("player_id", playerId);
  }
  return iframeUrl.toString();
}
