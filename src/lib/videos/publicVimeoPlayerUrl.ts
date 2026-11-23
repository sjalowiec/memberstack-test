export type PublicVimeoPlayerOptions = {
  vimeoId: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /** Unlisted-video privacy hash. Ignored unless it is only letters and digits. */
  privacyHash?: string | null;
  /** Set the player control bar on. Omit to leave Vimeo's default. */
  controls?: boolean;
  /** When false, hide the Vimeo title overlay. */
  showPlayerTitle?: boolean;
};

/**
 * Public player URL used by the shared Vimeo embed.
 * Autoplay stays off unless the caller asks for it.
 */
export function publicVimeoPlayerUrl(options: PublicVimeoPlayerOptions): string {
  const vimeoId = String(options.vimeoId ?? "").trim();
  const params = new URLSearchParams({
    ...(options.autoplay && { autoplay: "1" }),
    ...(options.loop && { loop: "1" }),
    ...(options.muted && { muted: "1" }),
    byline: "0",
    portrait: "0",
  });
  const privacyHash = String(options.privacyHash ?? "").trim();
  if (privacyHash && /^[A-Za-z0-9]+$/.test(privacyHash)) {
    params.set("h", privacyHash);
  }
  if (options.controls) params.set("controls", "1");
  if (options.showPlayerTitle === false) params.set("title", "0");
  return `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
}
