/**
 * Favorites events for Tip of the Week and Knit-ables.
 *
 * Production custom domains only, matching the other GA4 helpers.
 * Local review, the dev server, and *.netlify.app do not send these events.
 * Events carry a content type, a stable content id, and a source location.
 * They do not include an email address or a member id.
 */
import { detectSiteEnvironment } from "../env/siteEnvironment";

export const CONTENT_FAVORITE_SAVE_EVENT = "content_favorite_save";
export const CONTENT_FAVORITE_UNSAVE_EVENT = "content_favorite_unsave";
export const CONTENT_FAVORITES_OPEN_EVENT = "content_favorites_open";
export const CONTENT_FAVORITE_OPEN_EVENT = "content_favorite_open";

export const CONTENT_FAVORITE_TYPE_PARAM = "content_type";
export const CONTENT_FAVORITE_ID_PARAM = "content_id";
export const CONTENT_FAVORITE_SOURCE_PARAM = "favorite_source";

export const CONTENT_FAVORITE_GA_EVENTS = [
  CONTENT_FAVORITE_SAVE_EVENT,
  CONTENT_FAVORITE_UNSAVE_EVENT,
  CONTENT_FAVORITES_OPEN_EVENT,
  CONTENT_FAVORITE_OPEN_EVENT,
] as const;

export type ContentFavoriteGaEventName = (typeof CONTENT_FAVORITE_GA_EVENTS)[number];

export const CONTENT_FAVORITE_SOURCES = [
  "tip-page",
  "tip-archive",
  "knit-able-page",
  "knit-able-card",
  "account",
  "page",
] as const;

export type ContentFavoriteSource = (typeof CONTENT_FAVORITE_SOURCES)[number];

const SAVED_CONTENT_TYPES = new Set(["tip-of-the-week", "knit-able"]);
const CONTENT_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const DEDUPE_MS = 400;

type GtagEvent = (
  command: "event",
  name: string,
  params: Record<string, string>,
) => void;

export type ContentFavoritesGaContext = {
  now?: number;
  gtag?: GtagEvent;
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
  measurementIdConfigured?: boolean;
};

const recentSends = new Map<string, number>();

export function resetContentFavoritesGaForTests(): void {
  recentSends.clear();
}

export function shouldReportContentFavoritesToProductionGa(input: {
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
}): boolean {
  return (
    detectSiteEnvironment(input.hostname, {
      isViteDev: input.isViteDev,
      publicSiteEnv: input.publicSiteEnv,
    }) === "production"
  );
}

function browserContext(): ContentFavoritesGaContext {
  const gtag =
    typeof window !== "undefined"
      ? (window as Window & { gtag?: GtagEvent }).gtag
      : undefined;
  return {
    now: Date.now(),
    gtag: typeof gtag === "function" ? gtag : undefined,
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
    isViteDev: import.meta.env.DEV === true,
    publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
    measurementIdConfigured: Boolean(import.meta.env.PUBLIC_GA4_ID),
  };
}

export function cleanFavoriteContentId(value: string): string | null {
  const id = value.trim();
  if (!CONTENT_ID.test(id)) return null;
  if (/@|mem_/i.test(id)) return null;
  return id;
}

export function cleanFavoriteSource(value: string | null | undefined): ContentFavoriteSource {
  const source = String(value || "").trim();
  return (CONTENT_FAVORITE_SOURCES as readonly string[]).includes(source)
    ? (source as ContentFavoriteSource)
    : "page";
}

function sendFavoriteEvent(
  name: ContentFavoriteGaEventName,
  params: Record<string, string>,
  context?: ContentFavoritesGaContext,
): boolean {
  const ctx = context ?? browserContext();
  if (
    !shouldReportContentFavoritesToProductionGa({
      hostname: ctx.hostname,
      isViteDev: ctx.isViteDev,
      publicSiteEnv: ctx.publicSiteEnv,
    })
  ) {
    return false;
  }
  if (!ctx.measurementIdConfigured || typeof ctx.gtag !== "function") return false;

  const now = ctx.now ?? Date.now();
  const key = `${name}\0${params[CONTENT_FAVORITE_TYPE_PARAM] || ""}\0${params[CONTENT_FAVORITE_ID_PARAM] || ""}\0${params[CONTENT_FAVORITE_SOURCE_PARAM] || ""}`;
  const previous = recentSends.get(key);
  if (previous != null && now >= previous && now - previous < DEDUPE_MS) return false;

  try {
    ctx.gtag("event", name, {
      ...params,
      transport_type: "beacon",
    });
  } catch {
    return false;
  }

  recentSends.set(key, now);
  return true;
}

export function trackSavedContentFavoriteChange(
  input: {
    contentType: string;
    contentId: string;
    isFavorite: boolean;
    source?: string | null;
  },
  context?: ContentFavoritesGaContext,
): boolean {
  if (!SAVED_CONTENT_TYPES.has(input.contentType)) return false;
  const contentId = cleanFavoriteContentId(input.contentId);
  if (!contentId) return false;
  return sendFavoriteEvent(
    input.isFavorite ? CONTENT_FAVORITE_SAVE_EVENT : CONTENT_FAVORITE_UNSAVE_EVENT,
    {
      [CONTENT_FAVORITE_TYPE_PARAM]: input.contentType,
      [CONTENT_FAVORITE_ID_PARAM]: contentId,
      [CONTENT_FAVORITE_SOURCE_PARAM]: cleanFavoriteSource(input.source),
    },
    context,
  );
}

export function reportContentFavoritesOpen(
  context?: ContentFavoritesGaContext,
): boolean {
  return sendFavoriteEvent(
    CONTENT_FAVORITES_OPEN_EVENT,
    { [CONTENT_FAVORITE_SOURCE_PARAM]: "account" },
    context,
  );
}

export function reportContentFavoriteOpen(
  input: { contentType: string; contentId: string; source?: string | null },
  context?: ContentFavoritesGaContext,
): boolean {
  if (!SAVED_CONTENT_TYPES.has(input.contentType)) return false;
  const contentId = cleanFavoriteContentId(input.contentId);
  if (!contentId) return false;
  return sendFavoriteEvent(
    CONTENT_FAVORITE_OPEN_EVENT,
    {
      [CONTENT_FAVORITE_TYPE_PARAM]: input.contentType,
      [CONTENT_FAVORITE_ID_PARAM]: contentId,
      [CONTENT_FAVORITE_SOURCE_PARAM]: cleanFavoriteSource(input.source),
    },
    context,
  );
}
