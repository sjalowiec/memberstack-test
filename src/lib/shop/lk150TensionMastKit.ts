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
import {
  availabilityLabel,
  type MachineAvailabilityStatus,
} from "../machines/machineAdminFields";

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

export type TensionMastCatalogAvailability = {
  status: MachineAvailabilityStatus;
  label: string;
};

const AVAILABILITY_CACHE_MS = 60_000;
const SHOPIFY_STOCK_TIMEOUT_MS = 2_500;

type AvailabilityCacheEntry = {
  expiresAt: number;
  status: MachineAvailabilityStatus;
};

const availabilityCache = new Map<string, AvailabilityCacheEntry>();

/** Test hook. Catalog pages cache Shopify stock for a short time. */
export function resetTensionMastAvailabilityCacheForTests(): void {
  availabilityCache.clear();
}

/** Public Shopify product JSON for the kit. Stock lives on that product. */
export function tensionMastShopifyProductJsonUrl(shopifyUrl: string): string | null {
  try {
    const parsed = new URL(shopifyUrl.trim());
    if (parsed.protocol !== "https:") return null;
    const match = parsed.pathname.match(/^\/products\/([^/]+)\/?$/);
    if (!match?.[1]) return null;
    return `${parsed.origin}/products/${match[1]}.js`;
  } catch {
    return null;
  }
}

function availabilityFromShopifyPayload(payload: unknown): MachineAvailabilityStatus | null {
  if (!payload || typeof payload !== "object") return null;
  const available = (payload as { available?: unknown }).available;
  if (typeof available !== "boolean") return null;
  return available ? "available" : "unavailable";
}

function fallbackAvailability(
  kit: Pick<TensionMastKitContent, "checkoutEnabled">,
): MachineAvailabilityStatus {
  return kit.checkoutEnabled ? "available" : "unavailable";
}

function toCatalogAvailability(status: MachineAvailabilityStatus): TensionMastCatalogAvailability {
  return {
    status,
    label: availabilityLabel({ availabilityStatus: status, expectedDate: null }),
  };
}

/**
 * Same badge text the accessories catalog uses for SRP 60N and TA-8200.
 * Status comes from the Shopify product's public availability. If that
 * request fails, checkout being on is the fallback so the card still renders.
 */
export async function tensionMastCatalogAvailability(
  kit: Pick<TensionMastKitContent, "checkoutEnabled" | "shopifyUrl"> = LK150_SECOND_TENSION_MAST_KIT,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<TensionMastCatalogAvailability> {
  const productUrl = tensionMastShopifyProductJsonUrl(kit.shopifyUrl);
  if (!productUrl) return toCatalogAvailability(fallbackAvailability(kit));

  const cached = availabilityCache.get(productUrl);
  if (cached && cached.expiresAt > now) return toCatalogAvailability(cached.status);

  try {
    const response = await fetchImpl(productUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(SHOPIFY_STOCK_TIMEOUT_MS),
    });
    if (!response.ok) return toCatalogAvailability(fallbackAvailability(kit));
    const status = availabilityFromShopifyPayload(await response.json());
    if (!status) return toCatalogAvailability(fallbackAvailability(kit));
    availabilityCache.set(productUrl, { expiresAt: now + AVAILABILITY_CACHE_MS, status });
    return toCatalogAvailability(status);
  } catch {
    return toCatalogAvailability(fallbackAvailability(kit));
  }
}
