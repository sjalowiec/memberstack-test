/**
 * Help Hub events for the GA4 tag already installed in BaseLayout.
 *
 * The layout loads gtag only when PUBLIC_GA4_ID is set. These events use that
 * function. They do not add a second property, a consent banner, or a report.
 *
 * Looker Studio can break results down by slug and control only after these
 * event parameters are registered as event-scoped custom dimensions:
 *   help_hub_slug
 *   help_hub_location
 */

import { cleanHelpHubDiscoverySlug } from "../helpHub/discoverySlug";
import { helpHubSlugFromFavoriteContentId } from "../helpHub/discovery";
import { detectSiteEnvironment } from "../env/siteEnvironment";
import { FAVORITE_COMMITTED_EVENT, type FavoritesChangeDetail } from "../favorites/favoritesClient";

export const HELP_HUB_GA_EVENTS = [
  "surprise_me",
  "discovery_open",
  "favorite_save",
  "favorite_remove",
] as const;

export type HelpHubGaEventName = (typeof HELP_HUB_GA_EVENTS)[number];

/** Where the visitor used the control. */
export const HELP_HUB_GA_LOCATIONS = ["discovery_card", "accordion", "tip_page"] as const;

export type HelpHubGaLocation = (typeof HELP_HUB_GA_LOCATIONS)[number];

export const HELP_HUB_GA_SLUG_PARAM = "help_hub_slug";
export const HELP_HUB_GA_LOCATION_PARAM = "help_hub_location";

/** Same event, slug, and location inside this window is a second delivery of one action. */
export const HELP_HUB_GA_DEDUPE_MS = 400;

const CARD_OPEN_KEY = "kin_help_hub_ga_card_open";
const CARD_OPEN_TTL_MS = 30_000;

type GtagEvent = (
  command: "event",
  name: string,
  params: Record<string, string>,
) => void;

export type HelpHubGaStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type HelpHubGaContext = {
  now?: number;
  gtag?: GtagEvent;
  hostname?: string | null;
  isViteDev?: boolean;
  publicSiteEnv?: string | null;
  measurementIdConfigured?: boolean;
  storage?: HelpHubGaStorage | null;
};

type ControlNode = {
  closest(selector: string): unknown;
};

const recentSends = new Map<string, number>();
let favoriteAnalyticsInstalled = false;

export function resetHelpHubGaForTests(): void {
  recentSends.clear();
  favoriteAnalyticsInstalled = false;
}

export function isHelpHubGaEventName(value: unknown): value is HelpHubGaEventName {
  return typeof value === "string" && (HELP_HUB_GA_EVENTS as readonly string[]).includes(value);
}

export function isHelpHubGaLocation(value: unknown): value is HelpHubGaLocation {
  return typeof value === "string" && (HELP_HUB_GA_LOCATIONS as readonly string[]).includes(value);
}

/**
 * Production custom domains only. Localhost, the dev server, and *.netlify.app
 * (including kin-dev) stay out of the production property.
 */
export function shouldReportHelpHubToProductionGa(input: {
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

export function helpHubGaLocationFromControl(node: ControlNode | null | undefined): HelpHubGaLocation | null {
  if (!node || typeof node.closest !== "function") return null;
  if (node.closest("[data-help-hub-preview-audience]")) return null;
  if (node.closest("[data-help-hub-discovery]")) return "discovery_card";
  if (node.closest("[data-help-hub-article-slug]")) return "tip_page";
  if (node.closest("[data-help-hub-entry]")) return "accordion";
  return null;
}

function browserStorage(): HelpHubGaStorage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function browserContext(): HelpHubGaContext {
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
    storage: browserStorage(),
  };
}

function rememberCardOpen(slug: string, storage: HelpHubGaStorage | null | undefined, now: number): void {
  if (!storage) return;
  try {
    storage.setItem(CARD_OPEN_KEY, JSON.stringify({ slug, at: now }));
  } catch {
    /* The tip page may also record this open. One extra event is safer than throwing. */
  }
}

/** True when this tip page was just opened from the discovery card in this tab. */
export function consumeHelpHubCardOpen(
  slug: string,
  storage: HelpHubGaStorage | null | undefined,
  now: number,
): boolean {
  const clean = cleanHelpHubDiscoverySlug(slug);
  if (!clean || !storage) return false;
  let raw: string | null = null;
  try {
    raw = storage.getItem(CARD_OPEN_KEY);
    storage.removeItem(CARD_OPEN_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { slug?: unknown; at?: unknown };
    if (parsed.slug !== clean) return false;
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return false;
    if (now < parsed.at || now - parsed.at > CARD_OPEN_TTL_MS) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends one event through the existing gtag function.
 * Returns false when the event is skipped, duplicated, or gtag is absent.
 */
export function reportHelpHubAction(
  name: HelpHubGaEventName,
  slug: string,
  location: HelpHubGaLocation,
  context?: HelpHubGaContext,
): boolean {
  const ctx = context ?? browserContext();
  if (
    !shouldReportHelpHubToProductionGa({
      hostname: ctx.hostname,
      isViteDev: ctx.isViteDev,
      publicSiteEnv: ctx.publicSiteEnv,
    })
  ) {
    return false;
  }
  if (!ctx.measurementIdConfigured || typeof ctx.gtag !== "function") return false;
  const cleanSlug = cleanHelpHubDiscoverySlug(slug);
  if (!cleanSlug || cleanSlug.length > 100) return false;
  if (!isHelpHubGaLocation(location)) return false;

  const now = ctx.now ?? Date.now();
  const key = `${name}\0${cleanSlug}\0${location}`;
  const previous = recentSends.get(key);
  if (previous != null && now >= previous && now - previous < HELP_HUB_GA_DEDUPE_MS) return false;

  try {
    ctx.gtag("event", name, {
      [HELP_HUB_GA_SLUG_PARAM]: cleanSlug,
      [HELP_HUB_GA_LOCATION_PARAM]: location,
      transport_type: "beacon",
    });
  } catch {
    return false;
  }

  recentSends.set(key, now);
  if (name === "discovery_open" && location === "discovery_card") {
    rememberCardOpen(cleanSlug, ctx.storage, now);
  }
  return true;
}

/**
 * A tip-page view. Skipped when Read more on the discovery card already
 * recorded this slug, so that navigation is not counted twice.
 */
export function reportHelpHubTipPageOpen(slug: string, context?: HelpHubGaContext): boolean {
  const ctx = context ?? browserContext();
  const now = ctx.now ?? Date.now();
  if (consumeHelpHubCardOpen(slug, ctx.storage, now)) return false;
  return reportHelpHubAction("discovery_open", slug, "tip_page", ctx);
}

export function reportHelpHubFavoriteCommitted(
  detail: Partial<FavoritesChangeDetail> & { source?: ControlNode | null },
  context?: HelpHubGaContext,
): boolean {
  if (detail.contentType !== "reference") return false;
  if (detail.isFavorite !== true && detail.isFavorite !== false) return false;
  const location = helpHubGaLocationFromControl(detail.source);
  if (!location) return false;
  const slug = helpHubSlugFromFavoriteContentId(String(detail.contentId ?? ""));
  if (!slug) return false;
  return reportHelpHubAction(
    detail.isFavorite ? "favorite_save" : "favorite_remove",
    slug,
    location,
    context,
  );
}

/** One listener per page. Favorites are reported only from the committed event. */
export function installHelpHubFavoriteAnalytics(): void {
  if (favoriteAnalyticsInstalled || typeof window === "undefined") return;
  favoriteAnalyticsInstalled = true;
  window.addEventListener(FAVORITE_COMMITTED_EVENT, (event) => {
    try {
      const detail = (event as CustomEvent).detail;
      if (!detail || typeof detail !== "object") return;
      reportHelpHubFavoriteCommitted(detail as Partial<FavoritesChangeDetail> & { source?: ControlNode | null });
    } catch {
      /* Analytics must not break saving a favorite. */
    }
  });
}
