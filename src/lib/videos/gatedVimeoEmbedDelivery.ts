import { catalogVideoPlaybackAccess, type CatalogVideoPlaybackAccess } from "./catalogVideoPlaybackAccess";
import { buildCatalogVimeoEmbedSrc } from "./catalogVideoEmbedSrc";

export type GatedVimeoEmbedDelivery = {
  accessLevel: CatalogVideoPlaybackAccess;
  /** True only for intentionally public/open videos (SSR iframe is allowed). */
  renderIframe: boolean;
  /** Full player URL in HTML. Null for member-only so the page cannot leak it. */
  iframeSrcAttr: string | null;
  /** Numeric Vimeo id attribute. Omitted for member-only when a catalog content id is available. */
  videoIdAttr: string | null;
  contentIdAttr: string | null;
  iframeSrc: string;
};

export type GatedVimeoPlaybackDecision =
  | { action: "unlock"; iframeSrc: string }
  | { action: "lock"; showLogin: boolean }
  | { action: "wait" };

/**
 * What the server may put on the delivered page. Member-only videos never
 * include an iframe or `data-iframe-src` (or the Vimeo id when `contentId` is set).
 */
export function gatedVimeoEmbedDelivery(options: {
  accessLevel: CatalogVideoPlaybackAccess;
  videoId?: string | null;
  contentId?: string | null;
  privacyHash?: string | null;
  enableVimeoPlayerApi?: boolean;
  iframePlayerId?: string;
  /** Local Astro-dev bypass only. Never true on Netlify/production builds. */
  videoDevBypass?: boolean;
}): GatedVimeoEmbedDelivery {
  const accessLevel = options.accessLevel === "open" ? "open" : "member";
  const videoId = String(options.videoId ?? "").trim();
  const contentId = String(options.contentId ?? "").trim();
  const iframePlayerId =
    String(options.iframePlayerId ?? "").trim() || (videoId ? `kbm-gated-vimeo-${videoId}` : "");
  const iframeSrc = videoId
    ? buildCatalogVimeoEmbedSrc({
        vimeoId: videoId,
        privacyHash: options.privacyHash,
        enableVimeoPlayerApi: options.enableVimeoPlayerApi,
        iframePlayerId,
      })
    : "";
  const exposePlayer = accessLevel === "open" || options.videoDevBypass === true;
  return {
    accessLevel,
    renderIframe: exposePlayer && Boolean(iframeSrc),
    iframeSrcAttr: exposePlayer && iframeSrc ? iframeSrc : null,
    videoIdAttr: exposePlayer || !contentId ? videoId || null : null,
    contentIdAttr: contentId || null,
    iframeSrc,
  };
}

/**
 * Client playback decision. Never unlocks until membership is resolved and, for
 * member videos, an embed URL is in hand. Login alone is not enough.
 */
export function decideGatedVimeoPlayback(options: {
  accessLevel: CatalogVideoPlaybackAccess;
  videoDevBypass: boolean;
  membershipResolved: boolean;
  hasMemberAccess: boolean;
  isLoggedIn: boolean;
  embedSrc: string | null;
}): GatedVimeoPlaybackDecision {
  if (options.accessLevel === "open") {
    if (options.embedSrc) return { action: "unlock", iframeSrc: options.embedSrc };
    return { action: "wait" };
  }
  if (options.videoDevBypass && options.embedSrc) {
    return { action: "unlock", iframeSrc: options.embedSrc };
  }
  if (!options.membershipResolved) return { action: "wait" };
  if (!options.hasMemberAccess) {
    return { action: "lock", showLogin: !options.isLoggedIn };
  }
  if (options.embedSrc) return { action: "unlock", iframeSrc: options.embedSrc };
  return { action: "lock", showLogin: false };
}

export function catalogRowGatedVimeoDelivery(
  video: {
    access_level?: unknown;
    isTipOfWeek?: boolean;
    tipOfWeek?: boolean;
    content_id?: string | number;
    vimeoId?: string;
    privacyHash?: string;
  },
  options: { enableVimeoPlayerApi?: boolean; videoDevBypass?: boolean } = {},
): GatedVimeoEmbedDelivery {
  return gatedVimeoEmbedDelivery({
    accessLevel: catalogVideoPlaybackAccess(video),
    videoId: video.vimeoId,
    contentId: video.content_id != null ? String(video.content_id) : null,
    privacyHash: video.privacyHash,
    enableVimeoPlayerApi: options.enableVimeoPlayerApi,
    videoDevBypass: options.videoDevBypass,
  });
}
