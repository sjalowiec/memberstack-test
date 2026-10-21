/**
 * Draft visibility and asset gates for the LK150 Second Tension Mast Kit page.
 * Empty photos, video URLs, and instructions stay off the page.
 * Checkout stays off until `checkoutEnabled` is set. Production stays closed
 * until `published` is set.
 */
import {
  LK150_SECOND_TENSION_MAST_KIT,
  type TensionMastKitContent,
  type TensionMastPhoto,
} from "../../data/shop/lk150SecondTensionMastKit";
import {
  detectSiteEnvironment,
  type DetectSiteEnvironmentOptions,
} from "../env/siteEnvironment";

export const LK150_TENSION_MAST_KIT_PATH = LK150_SECOND_TENSION_MAST_KIT.path;

export function isLk150TensionMastKitRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === LK150_TENSION_MAST_KIT_PATH;
}

/**
 * Unpublished drafts 404 on production custom domains.
 * Localhost, Astro dev, and Netlify preview hosts stay available for review.
 * A published kit is served on production.
 */
export function isLk150TensionMastProductionBlocked(
  hostname: string | null | undefined,
  options: DetectSiteEnvironmentOptions = {},
  kit: Pick<TensionMastKitContent, "published"> = LK150_SECOND_TENSION_MAST_KIT,
): boolean {
  if (kit.published) return false;
  return detectSiteEnvironment(hostname, options) === "production";
}

/** Shopify destination only after draft review turns checkout on. */
export function tensionMastCheckoutHref(
  kit: Pick<TensionMastKitContent, "checkoutEnabled" | "shopifyUrl"> = LK150_SECOND_TENSION_MAST_KIT,
): string | null {
  if (!kit.checkoutEnabled) return null;
  const href = kit.shopifyUrl.trim();
  if (!/^https:\/\//i.test(href)) return null;
  return href;
}

export function tensionMastPhotos(kit: Pick<TensionMastKitContent, "photos">): TensionMastPhoto[] {
  return kit.photos.filter((photo) => photo.src.trim().length > 0 && photo.alt.trim().length > 0);
}

/** Numeric Vimeo id only. Blank or non-numeric values stay hidden. */
export function tensionMastVimeoId(kit: Pick<TensionMastKitContent, "vimeoId">): string | null {
  const id = kit.vimeoId.trim();
  return /^[0-9]+$/.test(id) ? id : null;
}

export function tensionMastVimeoPrivacyHash(
  kit: Pick<TensionMastKitContent, "vimeoPrivacyHash">,
): string {
  const hash = kit.vimeoPrivacyHash.trim();
  return /^[a-zA-Z0-9]+$/.test(hash) ? hash : "";
}

/** Optional public YouTube link. Blank or non-YouTube values stay hidden. */
export function tensionMastYoutubeUrl(
  kit: Pick<TensionMastKitContent, "youtubeUrl">,
): string | null {
  const url = kit.youtubeUrl.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be" || host === "www.youtube.com" || host === "youtube.com") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function tensionMastInstructionsHtml(
  kit: Pick<TensionMastKitContent, "installationInstructionsHtml">,
): string | null {
  const html = kit.installationInstructionsHtml.trim();
  return html || null;
}
